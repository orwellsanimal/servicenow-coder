/**
 * ATF Test: Verify PC Auto Request plumbing
 *
 * Smoke test for the nightly-pc-request job. Verifies:
 *   1. The MacBook Pro catalog item exists and is active.
 *   2. The catalog item is openable + orderable via the Cart pathway
 *      the scheduled script uses.
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
        description: 'Verifies the MacBook Pro catalog item is available and orderable.',
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

        // 2. Open the catalog item
        atf.catalog.openCatalogItem({
            $id: 'open-pc-item',
            catalogItem: '2ab7077237153000158bbfc8bcbe5da9',
        })

        // 3. Order it - exercises the same Cart pathway the script uses
        const orderResult = atf.catalog.orderCatalogItem({
            $id: 'order-pc-item',
            assert: 'form_submitted_to_server',
        })

        // 4. Verify an sc_request was created
        atf.server.recordValidation({
            $id: 'validate-request',
            table: 'sc_request',
            recordId: orderResult.request_id,
            fieldValues: 'active=true^EQ',
            assert: 'record_validated',
        })
    },
)
