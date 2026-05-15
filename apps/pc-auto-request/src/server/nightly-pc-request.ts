import { gs, GlideRecord } from '@servicenow/glide'
// @ts-expect-error — CartHelper is a Script Include in our scope; type defs
// are only available after deploy + `now-sdk dependencies`. Runtime resolution works.
import { CartHelper } from '@servicenow/glide/x_1111454_pcreq'

const PC_CATALOG_ITEM = '2ab7077237153000158bbfc8bcbe5da9'
const HARDWARE_MODEL_CATEGORY = '81feb9c137101000deeabfc8bcbe5dc4'

// install_status values to count as "user already has a PC":
//   1 = In use, 2 = On order, 6 = In stock, 10 = Consumed
// Excludes 7 (Retired), 8 (Missing), 3 (In maintenance), 9 (In transit), 11 (Build)
const ACTIVE_INSTALL_STATUSES = '1,2,6,10'

export const nightlyPcRequest = (): void => {
    const adminSysId = lookupAdminSysId()
    if (!adminSysId) {
        gs.error('[pc-auto-request] admin user not found; aborting')
        return
    }

    const userGr = new GlideRecord('sys_user')
    userGr.addQuery('active', true)
    userGr.addQuery('identity_type', 'human')
    userGr.query()

    let ordered = 0
    let skipped = 0
    let failed = 0

    while (userGr.next()) {
        const userSysId = userGr.getUniqueValue()
        const userName = userGr.getValue('user_name')

        if (hasActivePcAsset(userSysId)) {
            skipped++
            continue
        }

        try {
            const helper = new CartHelper()
            const result = helper.orderForUser(PC_CATALOG_ITEM, userSysId)
            if (result) {
                gs.info('[pc-auto-request] Ordered PC for ' + userName + ' (request=' + (result.request_number || result.request_id) + ')')
                ordered++
            } else {
                gs.error('[pc-auto-request] Cart order returned null for ' + userName)
                failed++
            }
        } catch (e) {
            gs.error('[pc-auto-request] Failed for ' + userName + ': ' + e)
            failed++
        }
    }

    gs.info('[pc-auto-request] Done. ordered=' + ordered + ', skipped=' + skipped + ', failed=' + failed)
}

function lookupAdminSysId(): string | null {
    const gr = new GlideRecord('sys_user')
    gr.addQuery('user_name', 'admin')
    gr.setLimit(1)
    gr.query()
    return gr.next() ? gr.getUniqueValue() : null
}

function hasActivePcAsset(userSysId: string): boolean {
    const asset = new GlideRecord('alm_asset')
    asset.addQuery('assigned_to', userSysId)
    asset.addQuery('model_category', HARDWARE_MODEL_CATEGORY)
    asset.addQuery('install_status', 'IN', ACTIVE_INSTALL_STATUSES)
    asset.setLimit(1)
    asset.query()
    return asset.next()
}
