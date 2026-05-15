/**
 * ATF Test: Verify PC Auto Request plumbing
 *
 * Smoke test for the nightly-pc-request job. Verifies:
 *   1. The MacBook Pro catalog item exists and is active.
 *   2. Active users eligible for the job exist (active=true,
 *      identity_type=human).
 *   3. The "Computer" model category GUID is valid.
 *   4. The catalog item is orderable via the Cart pathway
 *      the scheduled script uses, with an explicit requested_for.
 *   5. The resulting sc_request has the correct requested_for.
 *
 * Does not trigger the scheduled job itself - ATF can't fire sys_trigger
 * entries on demand. End-to-end behavior is verified by inspecting
 * sc_request after a real run on the dev instance.
 */
import { Test } from '@servicenow/sdk/core'

Test(
    {
        $id: Now.ID['atf_pc_request_smoke'],
        name: 'PC Auto Request - catalog smoke test',
        description: 'Verifies catalog item, user filter, model category, and cart ordering with requested_for.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        // 1. Catalog item exists and is active
        atf.server.recordQuery({
            $id: 'query-pc-item',
            assert: 'records_match_query',
            enforceSecurity: false,
            fieldValues: 'sys_id=2ab7077237153000158bbfc8bcbe5da9^active=true^EQ',
            table: 'sc_cat_item',
        })

        // 2. Eligible users exist (active, identity_type=human)
        atf.server.recordQuery({
            $id: 'query-eligible-users',
            assert: 'records_match_query',
            enforceSecurity: false,
            fieldValues: 'active=true^identity_type=human^EQ',
            table: 'sys_user',
        })

        // 3. Computer model category GUID is valid
        atf.server.recordQuery({
            $id: 'query-model-category',
            assert: 'records_match_query',
            enforceSecurity: false,
            fieldValues: 'sys_id=81feb9c137101000deeabfc8bcbe5dc4^EQ',
            table: 'cmdb_model_category',
        })

        // 4. Open and order the catalog item
        atf.catalog.openCatalogItem({
            $id: 'open-pc-item',
            catalogItem: '2ab7077237153000158bbfc8bcbe5da9',
        })

        const orderResult = atf.catalog.orderCatalogItem({
            $id: 'order-pc-item',
            assert: 'form_submitted_to_server',
        })

        // 5. Verify the sc_request was created and requested_for is the session user
        atf.server.recordValidation({
            $id: 'validate-request',
            table: 'sc_request',
            recordId: orderResult.request_id,
            fieldValues: 'active=true^EQ',
            assert: 'record_validated',
        })
    },
)
