/**
 * Scheduled Script Execution: {{jobName}}
 * Run: Daily / Weekly / Monthly / On Demand
 *
 * {{description}}
 *
 * Available objects:
 *   gs - GlideSystem utilities
 */

// Example: process records in batches
var gr = new GlideRecord('{{tableName}}');
gr.addQuery('active', true);
// gr.addEncodedQuery('state=1^created_onRELATIVEGT@dayofweek@ago@7');
gr.query();

var count = 0;
while (gr.next()) {
    // Process each record
    // gr.setValue('field_name', 'value');
    // gr.update();
    count++;
}

gs.info('{{jobName}}: Processed ' + count + ' records');
