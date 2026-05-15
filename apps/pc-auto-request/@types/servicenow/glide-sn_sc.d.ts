// Type declarations for CartHelper Script Include (x_1111454_pcreq scope)
// This allows the module to import CartHelper from '@servicenow/glide/x_1111454_pcreq'
declare module '@servicenow/glide/x_1111454_pcreq' {
    export class CartHelper {
        orderForUser(
            catalogItemId: string,
            requestedForSysId: string,
        ): { request_id?: string; request_number?: string } | null
    }
}
