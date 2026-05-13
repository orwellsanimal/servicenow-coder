import { ScheduledScript } from '@servicenow/sdk/core'
import { nightlyPcRequest } from '../server/nightly-pc-request.js'

// Nightly job: for each active human user without a PC asset, submit a
// catalog request for a MacBook Pro (requested_for = admin).
export const NightlyPcRequest = ScheduledScript({
    $id: Now.ID['nightly_pc_request'],
    name: 'Nightly PC Request',
    active: true,
    frequency: 'daily',
    executionTime: { hours: 2, minutes: 0, seconds: 0 },
    timeZone: 'UTC',
    runAs: 'admin',
    script: nightlyPcRequest,
})
