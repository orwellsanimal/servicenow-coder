/**
 * Fix Script: {{scriptName}}
 * {{description}}
 *
 * WARNING: Fix scripts run once and modify data directly. Test in sub-prod first.
 *
 * Available objects:
 *   gs - GlideSystem utilities
 */

// Safety: log what will be changed before committing
var DRY_RUN = true;

var gr = new GlideRecord('{{tableName}}');
gr.addQuery('field_name', 'old_value');
// gr.addEncodedQuery('encoded_query_here');
gr.query();

gs.info('Fix Script: Found ' + gr.getRowCount() + ' records to update');

var count = 0;
while (gr.next()) {
    if (DRY_RUN) {
        gs.info('  [DRY RUN] Would update: ' + gr.getDisplayValue() + ' (' + gr.getUniqueValue() + ')');
    } else {
        // gr.setValue('field_name', 'new_value');
        // gr.update();
    }
    count++;
}

gs.info('Fix Script: ' + (DRY_RUN ? '[DRY RUN] ' : '') + 'Processed ' + count + ' records');
