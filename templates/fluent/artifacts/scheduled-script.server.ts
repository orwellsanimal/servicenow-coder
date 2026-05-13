/**
 * Server module for Scheduled Script: {{scriptName}}
 *
 * `gs` must be imported alongside GlideRecord — it's not a built-in global
 * in this typing model (you'll get TS2304 otherwise).
 */
import { gs, GlideRecord } from '@servicenow/glide';

export function {{functionName}}(): void {
    gs.info('[{{moduleName}}] starting');
    // Scheduled script logic here. Example pattern:
    //
    // const gr = new GlideRecord('<table>');
    // gr.addQuery('active', true);
    // gr.query();
    // while (gr.next()) {
    //     // ...do work per row...
    // }
    gs.info('[{{moduleName}}] done');
}
