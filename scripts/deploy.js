#!/usr/bin/env node

/**
 * Deploy all Fluent apps to the ServiceNow dev instance.
 *
 * Usage:
 *   node scripts/deploy.js [--app <name>] [--reinstall] [--auth <alias>]
 *
 * Environment:
 *   SN_INSTANCE  — Instance URL (required if auth not already configured)
 *   SN_USER      — Username (for auto-configuring basic auth)
 *   SN_PASSWORD   — Password (for auto-configuring basic auth)
 *
 * The SDK stores auth credentials via `now-sdk auth`. If already configured,
 * no env vars are needed. Pass --auth <alias> to use a specific credential.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APPS_DIR = path.resolve(__dirname, '..', 'apps');

// Parse args
const args = process.argv.slice(2);
const appFilter = args.includes('--app') ? args[args.indexOf('--app') + 1] : null;
const reinstall = args.includes('--reinstall');
const authAlias = args.includes('--auth') ? args[args.indexOf('--auth') + 1] : null;
const dryRun = args.includes('--dry-run');

function run(cmd, opts = {}) {
    console.log(`  $ ${cmd}`);
    if (dryRun) {
        console.log('  [dry-run] skipped');
        return '';
    }
    return execSync(cmd, { stdio: 'inherit', ...opts });
}

function findApps() {
    if (!fs.existsSync(APPS_DIR)) {
        console.error('No apps/ directory found.');
        process.exit(1);
    }

    const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true });
    return entries
        .filter((e) => e.isDirectory())
        .filter((e) => {
            const configPath = path.join(APPS_DIR, e.name, 'now.config.json');
            return fs.existsSync(configPath);
        })
        .map((e) => ({
            name: e.name,
            path: path.join(APPS_DIR, e.name),
        }));
}

function main() {
    let apps = findApps();

    if (apps.length === 0) {
        console.log('No Fluent apps found in apps/. Nothing to deploy.');
        return;
    }

    if (appFilter) {
        apps = apps.filter((a) => a.name === appFilter);
        if (apps.length === 0) {
            console.error(`App "${appFilter}" not found in apps/.`);
            process.exit(1);
        }
    }

    console.log(`\nDeploying ${apps.length} app(s):\n`);
    apps.forEach((a) => console.log(`  - ${a.name}`));
    console.log();

    // Build + deploy each app
    const results = [];

    for (const app of apps) {
        console.log(`\n[${'='.repeat(40)}]`);
        console.log(`Deploying: ${app.name}`);
        console.log(`[${'='.repeat(40)}]\n`);

        // Step 1: Build
        console.log('[build]');
        try {
            run(`npx @servicenow/sdk build --source "${app.path}"`);
        } catch (e) {
            console.error(`Build failed for ${app.name}`);
            results.push({ name: app.name, status: 'build-failed' });
            continue;
        }

        // Step 2: Install
        console.log('\n[install]');
        let installCmd = `npx @servicenow/sdk install --source "${app.path}"`;
        if (authAlias) installCmd += ` --auth ${authAlias}`;
        if (reinstall) installCmd += ' --reinstall';

        try {
            run(installCmd);
            results.push({ name: app.name, status: 'deployed' });
        } catch (e) {
            console.error(`Install failed for ${app.name}`);
            results.push({ name: app.name, status: 'install-failed' });
        }
    }

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('Deployment Summary:');
    console.log('='.repeat(50));
    for (const r of results) {
        const icon = r.status === 'deployed' ? '[OK]' : '[FAIL]';
        console.log(`  ${icon} ${r.name} — ${r.status}`);
    }

    const failed = results.filter((r) => r.status !== 'deployed');
    if (failed.length > 0) {
        process.exit(1);
    }
}

main();
