#!/usr/bin/env node

/**
 * Interactive setup walkthrough for the ServiceNow Coder workspace.
 *
 * Walks a fresh clone through:
 *   1. Tool version checks (Node, pnpm)
 *   2. Submodule initialization
 *   3. pnpm install
 *   4. .env creation (instance URL + credentials)
 *   5. SDK auth alias registration (`now-sdk auth --add ... --alias dev`)
 *   6. Optional instance-config grounding harvest
 *   7. Optional verification (`pnpm run ci`)
 *
 * Idempotent: detects what's already done and skips it.
 *
 * Usage:
 *   node scripts/setup.js                 interactive
 *   node scripts/setup.js -y              non-interactive (use defaults; reads SN_* from env)
 *   node scripts/setup.js --help
 *
 * Zero npm dependencies — runs on Node built-ins so it works before pnpm install.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Setup walkthrough for the ServiceNow Coder workspace.

Usage:
  node scripts/setup.js                 interactive
  node scripts/setup.js -y              non-interactive (SN_* env vars used for .env)
  node scripts/setup.js --help

Idempotent: re-run anytime to fill in missing pieces.
`);
    process.exit(0);
}

const nonInteractive = args.includes('-y') || args.includes('--non-interactive');

// ─── Output helpers ──────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (color, s) => (useColor ? `${c[color]}${s}${c.reset}` : s);
const icon = {
    ok: wrap('green', '[OK]'),
    skip: wrap('dim', '[SKIP]'),
    fail: wrap('red', '[FAIL]'),
    todo: wrap('yellow', '[TODO]'),
};

function heading(n, title) {
    console.log(`\n${wrap('bold', `Step ${n}: ${title}`)}`);
    console.log(wrap('dim', '─'.repeat(60)));
}

// ─── Prompt helpers ──────────────────────────────────────────────────────────
const rl = nonInteractive
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
    return new Promise((resolve) => rl.question(q, (a) => resolve(a)));
}

async function confirm(q, defaultYes = false) {
    if (nonInteractive) return defaultYes;
    const def = defaultYes ? 'Y/n' : 'y/N';
    const a = (await ask(`${q} [${def}]: `)).trim().toLowerCase();
    if (!a) return defaultYes;
    return a.startsWith('y');
}

// ─── Process helpers ─────────────────────────────────────────────────────────
function run(cmd, cmdArgs, opts = {}) {
    const r = spawnSync(cmd, cmdArgs, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        cwd: ROOT,
        ...opts,
    });
    return r.status === 0;
}

function tryExec(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return null;
    }
}

function parseEnv(content) {
    const out = {};
    for (const line of content.split('\n')) {
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function step1_versions() {
    heading(1, 'Check Node and pnpm versions');
    const node = process.versions.node;
    const nodeMajor = parseInt(node.split('.')[0], 10);
    if (nodeMajor < 20) {
        console.log(`  ${icon.fail} Node ${node} — need 20+. Install: https://nodejs.org`);
        return { status: 'fail', note: `Node ${node} < 20` };
    }
    console.log(`  ${icon.ok} Node ${node}`);

    const pnpm = tryExec('pnpm --version');
    if (!pnpm) {
        console.log(`  ${icon.fail} pnpm not found. Install: npm install -g pnpm`);
        return { status: 'fail', note: 'pnpm missing' };
    }
    const pnpmMajor = parseInt(pnpm.split('.')[0], 10);
    if (pnpmMajor < 10) {
        console.log(`  ${icon.fail} pnpm ${pnpm} — need 10+. Install: npm install -g pnpm@latest`);
        return { status: 'fail', note: `pnpm ${pnpm} < 10` };
    }
    console.log(`  ${icon.ok} pnpm ${pnpm}`);
    return { status: 'ok', note: `Node ${node}, pnpm ${pnpm}` };
}

async function step2_submodules() {
    heading(2, 'Initialize git submodules');
    const submodules = ['servicenow-sdk', 'servicenow-sdk-examples', 'servicenow-docs'];
    const missing = submodules.filter((s) => {
        const p = path.join(ROOT, s);
        if (!fs.existsSync(p)) return true;
        const entries = fs.readdirSync(p).filter((e) => e !== '.git');
        return entries.length === 0;
    });
    if (missing.length === 0) {
        console.log(`  ${icon.skip} all submodules already initialized`);
        return { status: 'skip', note: 'already initialized' };
    }
    console.log(`  ${icon.todo} missing: ${missing.join(', ')}`);
    const ok = await confirm('Run `git submodule update --init --recursive`?', true);
    if (!ok) return { status: 'skip', note: 'declined' };
    const success = run('git', ['submodule', 'update', '--init', '--recursive']);
    return success
        ? { status: 'ok', note: 'submodules initialized' }
        : { status: 'fail', note: 'git submodule update failed' };
}

async function step3_install() {
    heading(3, 'Install workspace dependencies');
    const marker = path.join(ROOT, 'node_modules', '.modules.yaml');
    if (fs.existsSync(marker)) {
        console.log(`  ${icon.skip} node_modules present (delete to force reinstall)`);
        return { status: 'skip', note: 'node_modules present' };
    }
    const ok = await confirm('Run `pnpm install`?', true);
    if (!ok) return { status: 'skip', note: 'declined' };
    const success = run('pnpm', ['install']);
    return success
        ? { status: 'ok', note: 'dependencies installed' }
        : { status: 'fail', note: 'pnpm install failed' };
}

async function step4_env() {
    heading(4, 'Configure instance credentials (.env)');
    const envPath = path.join(ROOT, '.env');
    if (fs.existsSync(envPath)) {
        console.log(`  ${icon.skip} .env already exists (delete to recreate)`);
        return { status: 'skip', note: '.env exists' };
    }
    console.log(
        '  Need a ServiceNow instance? Sign up for a free PDI at https://developer.servicenow.com\n',
    );

    let SN_INSTANCE, SN_USER, SN_PASSWORD;
    if (nonInteractive) {
        SN_INSTANCE = process.env.SN_INSTANCE;
        SN_USER = process.env.SN_USER || 'admin';
        SN_PASSWORD = process.env.SN_PASSWORD;
        if (!SN_INSTANCE || !SN_PASSWORD) {
            console.log(`  ${icon.skip} SN_INSTANCE/SN_PASSWORD not in env — set them and re-run, or run interactively`);
            return { status: 'skip', note: 'no env vars in non-interactive mode' };
        }
    } else {
        SN_INSTANCE = (await ask('  Instance URL (e.g. https://dev123456.service-now.com): ')).trim();
        if (!SN_INSTANCE) {
            console.log(`  ${icon.skip} no URL entered — re-run setup when ready`);
            return { status: 'skip', note: 'no URL entered' };
        }
        SN_USER = (await ask('  Username [admin]: ')).trim() || 'admin';
        console.log(`  ${wrap('dim', '(password will be visible — it gets stored in .env anyway)')}`);
        SN_PASSWORD = (await ask('  Password: ')).trim();
    }

    const content = `# ServiceNow dev instance credentials
# Used by: scripts/deploy.js, scripts/run-tests.js, instance-config/scripts/export-instance.js
SN_INSTANCE=${SN_INSTANCE}
SN_USER=${SN_USER}
SN_PASSWORD=${SN_PASSWORD}
`;
    fs.writeFileSync(envPath, content);
    try {
        fs.chmodSync(envPath, 0o600);
    } catch (e) {
        // chmod is a no-op on Windows; ignore
    }
    console.log(`  ${icon.ok} .env written for ${SN_INSTANCE}`);
    return { status: 'ok', note: `.env written for ${SN_INSTANCE}` };
}

async function step5_auth() {
    heading(5, 'Register SDK auth alias `dev`');
    const out = tryExec('npx --no-install @servicenow/sdk auth --list') || tryExec('npx @servicenow/sdk auth --list');
    if (out && /\[dev\]/.test(out)) {
        console.log(`  ${icon.skip} alias "dev" already registered`);
        return { status: 'skip', note: 'alias dev registered' };
    }
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) {
        console.log(`  ${icon.skip} .env not found — re-run after step 4`);
        return { status: 'skip', note: '.env missing' };
    }
    const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
    if (!env.SN_INSTANCE) {
        console.log(`  ${icon.skip} SN_INSTANCE not set in .env`);
        return { status: 'skip', note: 'SN_INSTANCE missing' };
    }
    const ok = await confirm(`Register alias "dev" for ${env.SN_INSTANCE}?`, true);
    if (!ok) return { status: 'skip', note: 'declined' };
    console.log(`  ${wrap('dim', '(SDK will prompt for username and password)')}`);
    const success = run('npx', [
        '@servicenow/sdk',
        'auth',
        '--add',
        env.SN_INSTANCE,
        '--type',
        'basic',
        '--alias',
        'dev',
    ]);
    return success
        ? { status: 'ok', note: 'alias dev registered' }
        : { status: 'fail', note: 'now-sdk auth failed' };
}

async function step6_harvest() {
    heading(6, 'Harvest instance config for AI grounding (optional)');
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) {
        console.log(`  ${icon.skip} .env not found — skipping`);
        return { status: 'skip', note: '.env missing' };
    }
    const ok = await confirm('Run instance-config export now? (~30s)', false);
    if (!ok) {
        console.log(`  ${icon.skip} skipped — run later: node instance-config/scripts/export-instance.js`);
        return { status: 'skip', note: 'declined' };
    }
    const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
    const success = run('node', ['instance-config/scripts/export-instance.js'], {
        env: { ...process.env, ...env },
    });
    return success
        ? { status: 'ok', note: 'instance-config populated' }
        : { status: 'fail', note: 'harvest failed' };
}

async function step7_verify() {
    heading(7, 'Verify install (optional)');
    const ok = await confirm('Run `pnpm run ci` to verify?', false);
    if (!ok) {
        console.log(`  ${icon.skip} skipped — run later: pnpm run ci`);
        return { status: 'skip', note: 'declined' };
    }
    const success = run('pnpm', ['run', 'ci']);
    return success
        ? { status: 'ok', note: 'verification passed' }
        : { status: 'fail', note: 'verification failed' };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log(wrap('bold', '\nServiceNow Coder — Setup Walkthrough'));
    console.log(wrap('dim', `Mode: ${nonInteractive ? 'non-interactive' : 'interactive'}\n`));

    const results = {};

    results.versions = await step1_versions();
    if (results.versions.status === 'fail') {
        console.log(`\n${icon.fail} Cannot continue without correct Node and pnpm. Fix the above and re-run.`);
        if (rl) rl.close();
        process.exit(1);
    }

    results.submodules = await step2_submodules();
    results.install = await step3_install();
    results.env = await step4_env();
    results.auth = await step5_auth();
    results.harvest = await step6_harvest();
    results.verify = await step7_verify();

    // Summary
    console.log(`\n${wrap('bold', 'Summary')}\n${wrap('dim', '─'.repeat(60))}`);
    for (const [k, v] of Object.entries(results)) {
        console.log(`  ${icon[v.status]} ${k.padEnd(12)} ${wrap('dim', v.note || '')}`);
    }

    // Next steps
    console.log(`\n${wrap('bold', 'Next steps')}\n${wrap('dim', '─'.repeat(60))}`);
    console.log(`  • Read ${wrap('cyan', 'CLAUDE.md')} or ${wrap('cyan', 'GEMINI.md')} for AI-tool–specific guidance`);
    console.log(`  • Scaffold your first app:`);
    console.log(`      ${wrap('dim', 'cd apps && npx @servicenow/sdk init --appName "Hello" --packageName hello --scopeName x_hello --template base --auth dev')}`);
    console.log(`  • Deploy: ${wrap('dim', 'node scripts/deploy.js --auth dev')}`);
    console.log(`  • Run ATF tests: ${wrap('dim', 'node scripts/run-tests.js --all')}`);
    console.log();
    console.log(`  ${wrap('bold', 'Claude Code:')} install the official Fluent plugin once per machine:`);
    console.log(`      ${wrap('dim', '/plugin marketplace add servicenow/sdk')}`);
    console.log(`      ${wrap('dim', '/plugin install fluent')}`);
    console.log(`      ${wrap('dim', '/reload-plugins')}`);
    console.log();
    console.log(`  ${wrap('bold', 'Gemini CLI:')} point it at ${wrap('cyan', 'GEMINI.md')} as starting context.`);
    console.log();

    if (rl) rl.close();

    const failed = Object.values(results).filter((r) => r.status === 'fail');
    process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(`\n${icon.fail} Unexpected error: ${e.message}`);
    if (rl) rl.close();
    process.exit(1);
});
