#!/usr/bin/env node

/**
 * Run a full instance discovery sync — both the Node schema/config export
 * and the PySNC runtime export — then show the delta.
 *
 * Use this after activating a new plugin (CSM, FSM, etc.) to refresh
 * the grounding layer so generated code can reference the new tables,
 * choices, scopes, etc.
 *
 * Usage:
 *   node scripts/sync-instance-config.js
 *   node scripts/sync-instance-config.js --skip-python   # Node export only
 *   node scripts/sync-instance-config.js --skip-node     # Python export only
 *
 * Reads SN_INSTANCE / SN_USER / SN_PASSWORD from .env.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')
const INSTANCE_CONFIG = path.join(REPO_ROOT, 'instance-config')

const args = process.argv.slice(2)
const skipNode = args.includes('--skip-node')
const skipPython = args.includes('--skip-python')

// Load .env into process.env so child_process exports inherit credentials.
function loadDotEnv() {
    const envFile = path.join(REPO_ROOT, '.env')
    if (!fs.existsSync(envFile)) {
        console.error('ERROR: .env not found at repo root. Copy .env.example and fill in credentials.')
        process.exit(2)
    }
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 0) continue
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim()
        if (!process.env[key]) process.env[key] = val
    }
}

function fileExists(p) {
    try { fs.accessSync(p); return true } catch { return false }
}

function fileBytes(p) {
    try { return fs.statSync(p).size } catch { return 0 }
}

function readJson(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

// Capture pre-sync state for delta calculation
function snapshotState() {
    const files = [
        'instance.json',
        'schema/tables.json',
        'schema/columns.json',
        'schema/choices.json',
        'platform/plugins.json',
        'platform/scopes.json',
        'platform/properties.json',
        'security/roles.json',
        'services/rest-apis.json',
        'catalog/items.json',
        'catalog/model-categories.json',
        'automation/scheduled-jobs.json',
        'users/distribution.json',
        'assets/summary.json',
    ]
    const state = {}
    for (const f of files) {
        const full = path.join(INSTANCE_CONFIG, f)
        state[f] = { exists: fileExists(full), bytes: fileBytes(full) }
        if (state[f].exists) {
            const data = readJson(full)
            if (data) {
                // Count top-level entities for delta reporting
                const dataKey = Object.keys(data).find((k) => !k.startsWith('_') && !k.startsWith('$') && typeof data[k] === 'object')
                if (dataKey) {
                    state[f].entityKey = dataKey
                    state[f].entityCount = Array.isArray(data[dataKey])
                        ? data[dataKey].length
                        : Object.keys(data[dataKey]).length
                }
            }
        }
    }
    return state
}

function reportDelta(before, after) {
    console.log('\n=== Delta vs pre-sync snapshot ===')
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    let anyChange = false
    for (const f of allKeys) {
        const b = before[f] || { exists: false, bytes: 0, entityCount: 0 }
        const a = after[f] || { exists: false, bytes: 0, entityCount: 0 }
        if (!b.exists && a.exists) {
            console.log(`  NEW  ${f} (${a.entityCount ?? '?'} ${a.entityKey ?? 'entries'})`)
            anyChange = true
        } else if (b.exists && !a.exists) {
            console.log(`  GONE ${f}`)
            anyChange = true
        } else if (b.exists && a.exists) {
            const countDelta = (a.entityCount ?? 0) - (b.entityCount ?? 0)
            const byteDelta = a.bytes - b.bytes
            if (countDelta !== 0) {
                const sign = countDelta > 0 ? '+' : ''
                console.log(`  CHG  ${f}: ${b.entityCount} -> ${a.entityCount} ${a.entityKey} (${sign}${countDelta})`)
                anyChange = true
            } else if (Math.abs(byteDelta) > 1024) {
                // Significant byte change but same entity count — values changed
                const sign = byteDelta > 0 ? '+' : ''
                console.log(`  CHG  ${f}: ${b.bytes} -> ${a.bytes} bytes (${sign}${byteDelta})`)
                anyChange = true
            }
        }
    }
    if (!anyChange) {
        console.log('  (no significant changes)')
    }
}

function showGitStatus() {
    console.log('\n=== Git status (instance-config/) ===')
    try {
        const status = execSync('git status --short instance-config/', { cwd: REPO_ROOT, encoding: 'utf8' })
        if (status.trim()) {
            console.log(status.trimEnd())
            console.log('\nSuggested next steps:')
            console.log('  git add instance-config/')
            console.log('  git commit -m "sync: instance-config after <plugin> activation"')
        } else {
            console.log('  (no changes to commit)')
        }
    } catch (e) {
        console.log(`  (git not available: ${e.message})`)
    }
}

function runStep(name, cmd) {
    console.log(`\n[ ${name} ]`)
    console.log(`  $ ${cmd}`)
    try {
        execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit', env: process.env })
        return true
    } catch (e) {
        console.error(`  FAILED: ${name}`)
        return false
    }
}

function main() {
    loadDotEnv()

    if (!process.env.SN_INSTANCE || !process.env.SN_USER || !process.env.SN_PASSWORD) {
        console.error('ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env')
        process.exit(2)
    }

    console.log(`Syncing instance-config from: ${process.env.SN_INSTANCE}`)
    console.log(`Steps: ${[!skipNode && 'node-export', !skipPython && 'python-export'].filter(Boolean).join(' -> ')}`)

    const before = snapshotState()

    const results = []

    if (!skipNode) {
        results.push(['node-export', runStep(
            'Node export (schema, platform, security, services)',
            'node instance-config/scripts/export-instance.js',
        )])
    }

    if (!skipPython) {
        // Find the python interpreter — prefer venv if present
        const venvPython = process.platform === 'win32'
            ? path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe')
            : path.join(REPO_ROOT, '.venv', 'bin', 'python')
        const pythonCmd = fileExists(venvPython) ? `"${venvPython}"` : 'python'

        results.push(['python-export', runStep(
            'PySNC export (catalog, automation, users, assets)',
            `${pythonCmd} scripts/python/export-runtime.py`,
        )])
    }

    const after = snapshotState()
    reportDelta(before, after)
    showGitStatus()

    console.log('\n=== Summary ===')
    for (const [step, ok] of results) {
        console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${step}`)
    }

    const allOk = results.every(([, ok]) => ok)
    process.exit(allOk ? 0 : 1)
}

main()
