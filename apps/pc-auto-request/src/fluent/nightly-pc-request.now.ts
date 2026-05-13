import { ScheduledScript } from '@servicenow/sdk/core'
import { nightlyPcRequest } from '../server/nightly-pc-request.js'

// Nightly job: for each active human user without a PC asset, submit a
// catalog request for a MacBook Pro.
//
// NOTE: `executionTime` MUST be wrapped in `Time(...)` — a bare object literal
// like `{ hours: 2, minutes: 0, seconds: 0 }` gets `.toString()`'d to
// `[object Object]` by the SDK, which the platform then reinterprets as the
// install timestamp. `executionStart` must also be set (in the past) or
// run_start defaults to the install moment and `next_action` overflows to
// a sentinel date in 2082.
//
// `runAs` is intentionally omitted: the SDK does not translate usernames to
// sys_user sys_ids, and passing `'admin'` ends up stored as a broken reference.
// With `run_as` unset, the script runs as the install user's context (admin
// on this PDI), which is functionally what we want anyway.
export const NightlyPcRequest = ScheduledScript({
    $id: Now.ID['nightly_pc_request'],
    name: 'Nightly PC Request',
    active: true,
    frequency: 'daily',
    executionStart: '2026-01-01 02:00:00',
    executionTime: Time({ hours: 2, minutes: 0, seconds: 0 }, 'UTC'),
    timeZone: 'UTC',
    script: nightlyPcRequest,
})
