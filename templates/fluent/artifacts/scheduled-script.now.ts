/**
 * Scheduled Script: {{scriptName}}
 * {{description}}
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READ BEFORE EDITING — three SDK landmines that silently produce a broken
 * sys_trigger record (next_action stuck in year ~2082):
 *
 *   1. executionTime MUST be wrapped in Time(...). A bare object literal
 *      like { hours: 2, minutes: 0, seconds: 0 } compiles fine but the SDK
 *      .toString()'s it to "[object Object]" in the XML, and the install
 *      processor falls back to the install moment.
 *
 *   2. executionStart MUST be set explicitly. Without it, run_start
 *      defaults to install time and next_action overflows to a sentinel
 *      date ~56 years out.
 *
 *   3. runAs by username (e.g. 'admin') DOES NOT WORK. The SDK doesn't
 *      translate usernames to sys_ids, so run_as ends up as a broken
 *      sys_user reference. Either omit runAs (script runs as install
 *      context) or pass the actual sys_user sys_id.
 *
 * After your first build, verify by grepping:
 *     grep run_time apps/<app>/dist/app/update/sysauto_script_*.xml
 * The expected output is `1970-01-01 02:00:00` (only time portion matters).
 * If you see `[object Object]` you forgot Time().
 *
 * Full reference: docs/guides/troubleshooting.md → "ScheduledScript deploys
 * but next_action is set to year 2082".
 * ─────────────────────────────────────────────────────────────────────────
 */
import { ScheduledScript } from '@servicenow/sdk/core';
import { {{functionName}} } from '../server/{{moduleName}}';

ScheduledScript({
    $id: Now.ID['{{scriptId}}'],
    name: '{{scriptName}}',
    active: true,
    // frequency: 'daily' | 'weekly' | 'monthly' | 'periodically' | 'onDemand'
    frequency: 'daily',
    // Stable past anchor — install moves forward from here to the next
    // valid run. Don't use a future date or the schedule won't fire until
    // that date arrives.
    executionStart: '2026-01-01 02:00:00',
    // Time() is a Fluent global helper — no import needed.
    // Second arg must match `timeZone` below.
    executionTime: Time({ hours: 2, minutes: 0, seconds: 0 }, 'UTC'),
    timeZone: 'UTC',
    // runAs: omit unless you have a specific sys_user sys_id to pin to.
    // The script runs as the install user's context by default (admin on a
    // dev instance). Passing a username string does NOT work — see #3 above.
    script: {{functionName}},
});
