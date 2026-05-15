import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['CartHelper'],
    name: 'CartHelper',
    script: Now.include('../../server/script-includes/cart-helper.js'),
    description: 'Wraps sn_sc.CartJS for module consumption (sn_sc is not available in module context).',
    accessibleFrom: 'package_private',
})
