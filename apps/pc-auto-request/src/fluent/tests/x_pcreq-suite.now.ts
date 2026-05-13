/**
 * ATF Test Suite for the pc-auto-request app.
 *
 * Per project convention, one suite per app named `<scope>-suite`.
 * The CI test stage runs this by name via POST /api/sn_cicd/testsuite/run.
 */
import { Record } from '@servicenow/sdk/core'

// The suite itself
Record({
    $id: Now.ID['x_pcreq_suite'],
    table: 'sys_atf_test_suite',
    data: {
        name: 'x_1111454_pcreq-suite',
        description: 'All ATF tests for the pc-auto-request app.',
        active: true,
    },
})

// Membership: the catalog smoke test
Record({
    $id: Now.ID['x_pcreq_suite_member_smoke'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: Now.ID['x_pcreq_suite'],
        test: Now.ID['atf_pc_request_smoke'],
        order: 100,
    },
})
