/**
 * ATF Test Suite: {{suiteName}}
 * {{description}}
 *
 * Convention: one suite per app, named `<scope>-suite` (e.g. `x_inchelper-suite`).
 * The CI test stage runs this by name via `POST /api/sn_cicd/testsuite/run`.
 *
 * Tests are added to the suite via `sys_atf_test_suite_test` membership records.
 * Each membership record references a test by its $id.
 */
import { Record } from '@servicenow/sdk/core';

// The suite itself
Record({
    $id: Now.ID['{{suiteId}}'],
    table: 'sys_atf_test_suite',
    data: {
        name: '{{suiteName}}',
        description: '{{description}}',
        active: true,
        // run_parallel: true,
        // abort_on_failure: false,
    },
});

// Suite membership — one Record() per test to include.
// Duplicate the block below for each test, referencing the test's $id.
//
// Record({
//     $id: Now.ID['{{suiteId}}-member-<test-id>'],
//     table: 'sys_atf_test_suite_test',
//     data: {
//         test_suite: Now.ID['{{suiteId}}'],
//         test: Now.ID['<test-id>'],
//         order: 100,
//     },
// });
