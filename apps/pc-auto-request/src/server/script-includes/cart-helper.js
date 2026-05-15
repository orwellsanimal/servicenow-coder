/* global sn_sc, gs, Class */
// Script Include: wraps sn_sc.CartJS for use by modules.
// sn_sc is auto-available in Script Include context but NOT in module context.
var CartHelper = Class.create()

CartHelper.prototype = {
    initialize: function () {},

    /**
     * Submit a catalog order for a given user.
     * @param {string} catalogItemId - sys_id of the sc_cat_item
     * @param {string} requestedForSysId - sys_id of the target sys_user
     * @returns {{ request_id: string, request_number: string } | null}
     */
    orderForUser: function (catalogItemId, requestedForSysId) {
        try {
            var cart = new sn_sc.CartJS()
            cart.empty()
            cart.addToCart({
                sysparm_id: catalogItemId,
                sysparm_quantity: '1',
            })
            return cart.submitOrder({ requested_for: requestedForSysId })
        } catch (e) {
            gs.error('[CartHelper] orderForUser failed: ' + e)
            return null
        }
    },

    type: 'CartHelper',
}
