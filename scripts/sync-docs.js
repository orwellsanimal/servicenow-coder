#!/usr/bin/env node

/**
 * Keep CLAUDE.md and GEMINI.md in sync.
 *
 * Strategy: bidirectional — whichever file has the newer mtime wins.
 * If contents already match, this is a no-op.
 *
 * Run manually:  pnpm run sync-docs
 * Run via hook:  see .githooks/pre-commit and .claude/settings.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['CLAUDE.md', 'GEMINI.md'].map((f) => path.join(ROOT, f));

function main() {
    const [a, b] = FILES;

    // If either is missing, copy from the existing one
    const aExists = fs.existsSync(a);
    const bExists = fs.existsSync(b);

    if (!aExists && !bExists) {
        console.error('Neither CLAUDE.md nor GEMINI.md exists. Nothing to sync.');
        process.exit(1);
    }
    if (!aExists) {
        fs.copyFileSync(b, a);
        console.log(`Created CLAUDE.md from GEMINI.md`);
        return;
    }
    if (!bExists) {
        fs.copyFileSync(a, b);
        console.log(`Created GEMINI.md from CLAUDE.md`);
        return;
    }

    // Both exist — compare contents first (cheaper than mtime check for small files)
    const aContent = fs.readFileSync(a);
    const bContent = fs.readFileSync(b);
    if (aContent.equals(bContent)) {
        return; // silent no-op
    }

    // Contents differ — newer mtime wins
    const aStat = fs.statSync(a);
    const bStat = fs.statSync(b);

    if (aStat.mtimeMs > bStat.mtimeMs) {
        fs.copyFileSync(a, b);
        console.log(`Synced: CLAUDE.md → GEMINI.md`);
    } else if (bStat.mtimeMs > aStat.mtimeMs) {
        fs.copyFileSync(b, a);
        console.log(`Synced: GEMINI.md → CLAUDE.md`);
    } else {
        // Same mtime but different content — pick CLAUDE.md as canonical
        fs.copyFileSync(a, b);
        console.log(`Synced (tiebreaker): CLAUDE.md → GEMINI.md`);
    }
}

main();
