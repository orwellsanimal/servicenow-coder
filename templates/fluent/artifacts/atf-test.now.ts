/**
 * ATF Test: {{testName}}
 * {{description}}
 *
 * Convention: place ATF tests at `apps/<app>/src/fluent/tests/<test-id>.now.ts`.
 * The SDK only scans `src/fluent/**/*.now.ts`; files under `src/tests/` are silently skipped.
 * Tests are grouped into a per-app suite (see `atf-test-suite.now.ts`).
 *
 * Step namespaces (see servicenow-sdk-examples/test-atf-sample for full set):
 *   atf.server.*   — record CRUD, query, impersonation, server-side scripts
 *   atf.form.*     — open/submit forms, set field values, assert UI state
 *   atf.rest.*     — send REST requests, assert status/JSON payload
 */
import { Test } from '@servicenow/sdk/core';

export default Test(
    {
        $id: Now.ID['{{testId}}'],
        name: '{{testName}}',
        description: '{{description}}',
        active: true,
    },
    (atf) => {
        // Example: impersonate before exercising the feature
        // atf.server.impersonate({ $id: 'impersonate', user: '<user-sys-id>' });

        // Example: assert seed/config exists
        // atf.server.recordQuery({
        //     $id: 'verify-config',
        //     assert: 'records_match_query',
        //     enforceSecurity: false,
        //     fieldValues: 'active=true^EQ',
        //     table: '{{tableName}}',
        // });

        // Example: insert a record under test
        // atf.server.recordInsert({
        //     $id: 'create-record',
        //     assert: 'record_successfully_inserted',
        //     enforceSecurity: false,
        //     fieldValues: { short_description: '{{testName}} fixture' },
        //     table: '{{tableName}}',
        // });

        // Example: verify behavior via REST
        // atf.rest.sendRestRequest({
        //     $id: 'fetch-record',
        //     method: 'get',
        //     path: "/api/now/v2/table/{{tableName}}/{{step['create-record'].record_id}}",
        //     headers: { Accept: 'application/json' },
        //     basicAuthentication: '',
        //     body: '',
        //     queryParameters: {},
        // });
        // atf.rest.assertStatusCode({ $id: 'rest-status', operation: 'equals', statusCode: 200 });

        // Replace the placeholders above with the actual steps that exercise
        // the feature this test covers.
    },
);
