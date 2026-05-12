#!/usr/bin/env node

/**
 * Run ATF test suites on the ServiceNow dev instance via the CI/CD REST API.
 *
 * Usage:
 *   node scripts/run-tests.js --suite <name>            Run a single suite by name
 *   node scripts/run-tests.js --suite-id <sys_id>       Run a single suite by sys_id
 *   node scripts/run-tests.js --app <name>              Run the default suite for an app (<scope>-suite)
 *   node scripts/run-tests.js --all                     Discover and run one suite per app in apps/
 *   node scripts/run-tests.js --dry-run                 Print what would run, don't call the API
 *
 * Environment:
 *   SN_INSTANCE   Instance URL (e.g. https://dev392282.service-now.com) — required
 *   SN_USER       Username — required
 *   SN_PASSWORD   Password — required
 *
 * Exit codes:
 *   0  all suites passed
 *   1  one or more suites failed or errored
 *   2  usage / configuration error
 *
 * Requires the user to have role `sn_cicd.sys_ci_automation` or admin on the instance.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const APPS_DIR = path.resolve(__dirname, '..', 'apps');
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : null;
}
function bool(name) {
    return args.includes(`--${name}`);
}

const suiteName = flag('suite');
const suiteId = flag('suite-id');
const appName = flag('app');
const runAll = bool('all');
const dryRun = bool('dry-run');

if (!suiteName && !suiteId && !appName && !runAll) {
    console.error('Specify one of: --suite <name>, --suite-id <sys_id>, --app <name>, --all');
    process.exit(2);
}

// ─── Config ──────────────────────────────────────────────────────────────────
const instance = process.env.SN_INSTANCE;
const user = process.env.SN_USER;
const password = process.env.SN_PASSWORD;

if (!dryRun && (!instance || !user || !password)) {
    console.error('SN_INSTANCE, SN_USER, and SN_PASSWORD must be set in the environment.');
    process.exit(2);
}

// ─── HTTP ────────────────────────────────────────────────────────────────────
function request(method, urlStr, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const auth = Buffer.from(`${user}:${password}`).toString('base64');
        const opts = {
            method,
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            headers: {
                Authorization: `Basic ${auth}`,
                Accept: 'application/json',
            },
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
        }
        const req = https.request(opts, (res) => {
            let chunks = '';
            res.on('data', (c) => (chunks += c));
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = chunks ? JSON.parse(chunks) : null;
                } catch (e) {
                    return reject(new Error(`Non-JSON response from ${urlStr}: ${chunks.slice(0, 200)}`));
                }
                if (res.statusCode >= 400) {
                    const msg = parsed && parsed.error ? JSON.stringify(parsed.error) : chunks;
                    return reject(new Error(`HTTP ${res.statusCode} from ${urlStr}: ${msg}`));
                }
                resolve(parsed);
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ─── ATF API ─────────────────────────────────────────────────────────────────
async function startSuite({ suite_name, suite_sys_id }) {
    const params = new URLSearchParams();
    if (suite_sys_id) params.set('test_suite_sys_id', suite_sys_id);
    else if (suite_name) params.set('test_suite_name', suite_name);
    const url = `${instance}/api/sn_cicd/testsuite/run?${params.toString()}`;
    const res = await request('POST', url, {});
    const progressId = res && res.result && res.result.links && res.result.links.progress && res.result.links.progress.id;
    if (!progressId) {
        throw new Error(`Suite start response missing progress.id: ${JSON.stringify(res)}`);
    }
    return { progressId, resultId: res.result.links.results && res.result.links.results.id };
}

async function pollProgress(progressId) {
    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT_MS) {
        const res = await request('GET', `${instance}/api/sn_cicd/progress/${progressId}`);
        const r = res && res.result;
        if (!r) throw new Error(`Empty progress response`);
        // state: 0=pending, 1=running, 2=successful, 3=failed, 4=canceled
        const stateNum = String(r.status || r.state || '');
        const stateLabel = r.status_label || r.state_label || stateNum;
        const pct = r.percent_complete != null ? `${r.percent_complete}%` : '';
        process.stdout.write(`    progress: ${stateLabel} ${pct}\r`);
        if (stateNum === '2') {
            process.stdout.write('\n');
            return { ok: true, raw: r };
        }
        if (stateNum === '3' || stateNum === '4') {
            process.stdout.write('\n');
            return { ok: false, raw: r };
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(`Suite polling timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function fetchResults(resultId) {
    if (!resultId) return null;
    try {
        const res = await request('GET', `${instance}/api/sn_cicd/testsuite/results/${resultId}`);
        return res && res.result;
    } catch (e) {
        console.warn(`    (could not fetch result detail: ${e.message})`);
        return null;
    }
}

// ─── Suite discovery ─────────────────────────────────────────────────────────
function discoverAppSuites() {
    if (!fs.existsSync(APPS_DIR)) return [];
    const suites = [];
    for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const cfgPath = path.join(APPS_DIR, entry.name, 'now.config.json');
        if (!fs.existsSync(cfgPath)) continue;
        try {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            if (cfg.scope) suites.push({ app: entry.name, suiteName: `${cfg.scope}-suite` });
        } catch (e) {
            console.warn(`Skipping ${entry.name}: invalid now.config.json — ${e.message}`);
        }
    }
    return suites;
}

function suiteNameForApp(name) {
    const cfgPath = path.join(APPS_DIR, name, 'now.config.json');
    if (!fs.existsSync(cfgPath)) {
        console.error(`App "${name}" not found in apps/ or missing now.config.json`);
        process.exit(2);
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (!cfg.scope) {
        console.error(`App "${name}" config has no scope`);
        process.exit(2);
    }
    return `${cfg.scope}-suite`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function runOne(spec) {
    const label = spec.suiteId ? `id=${spec.suiteId}` : spec.suiteName;
    console.log(`\n→ Running suite: ${label}`);
    if (dryRun) {
        console.log('  [dry-run] would POST /api/sn_cicd/testsuite/run');
        return { label, ok: true, dryRun: true };
    }
    try {
        const { progressId, resultId } = await startSuite({
            suite_name: spec.suiteName,
            suite_sys_id: spec.suiteId,
        });
        console.log(`  started; progress_id=${progressId}`);
        const { ok, raw } = await pollProgress(progressId);
        const detail = await fetchResults(resultId);
        if (detail) {
            const summary = [
                `passed=${detail.successful_tests ?? detail.passed ?? '?'}`,
                `failed=${detail.failed_tests ?? detail.failed ?? '?'}`,
                `errored=${detail.errored_tests ?? detail.errored ?? '?'}`,
                `skipped=${detail.skipped_tests ?? detail.skipped ?? '?'}`,
            ].join(' ');
            console.log(`  results: ${summary}`);
        }
        if (!ok) {
            console.log(`  FAILED — ${raw.status_message || raw.state_message || 'see instance for details'}`);
        } else {
            console.log(`  PASSED`);
        }
        return { label, ok };
    } catch (e) {
        console.error(`  ERROR — ${e.message}`);
        return { label, ok: false, error: e.message };
    }
}

(async () => {
    let toRun = [];
    if (suiteId) toRun.push({ suiteId });
    else if (suiteName) toRun.push({ suiteName });
    else if (appName) toRun.push({ suiteName: suiteNameForApp(appName) });
    else if (runAll) {
        const discovered = discoverAppSuites();
        if (discovered.length === 0) {
            console.log('No apps with now.config.json found; nothing to test.');
            process.exit(0);
        }
        toRun = discovered.map((d) => ({ suiteName: d.suiteName }));
    }

    const results = [];
    for (const spec of toRun) {
        results.push(await runOne(spec));
    }

    console.log(`\n${'='.repeat(50)}\nATF Summary\n${'='.repeat(50)}`);
    for (const r of results) {
        const icon = r.ok ? '[PASS]' : '[FAIL]';
        console.log(`  ${icon} ${r.label}${r.error ? ` — ${r.error}` : ''}`);
    }
    const failed = results.filter((r) => !r.ok);
    process.exit(failed.length > 0 ? 1 : 0);
})();
