/**
 * Business Rule: {{ruleName}}
 * Table: {{tableName}}
 * When: before/after insert/update/delete/query
 *
 * {{description}}
 *
 * Available objects:
 *   current  - GlideRecord of the current record
 *   previous - GlideRecord of the record before the update (update only)
 *   gs       - GlideSystem utilities
 */
(function executeRule(/** @type {GlideRecord} */ current, /** @type {GlideRecord} */ previous) {

    // Guard: skip if running in background or by system
    // if (gs.isInteractive() === false) return;

    // Example: set a field value
    // current.setValue('field_name', 'value');

    // Example: abort the operation
    // current.setAbortAction(true);
    // gs.addErrorMessage('Cannot perform this action.');

    // Example: query related records
    // var gr = new GlideRecord('related_table');
    // gr.addQuery('reference_field', current.getUniqueValue());
    // gr.query();
    // while (gr.next()) {
    //     // process related records
    // }

})(current, previous);
