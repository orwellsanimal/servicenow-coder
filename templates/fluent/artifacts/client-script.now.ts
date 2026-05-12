/**
 * Client Script: {{scriptName}}
 * {{description}}
 */
import { ClientScript } from '@servicenow/sdk/core';

export default ClientScript({
    $id: Now.ID['{{scriptId}}'],
    name: '{{scriptName}}',
    type: 'onLoad', // 'onLoad' | 'onChange' | 'onSubmit' | 'onCellEdit'
    ui_type: 'all', // 'all' | 'desktop' | 'mobile'
    table: '{{tableName}}',
    active: true,
    // global: false,
    // applies_extended: false,
    // field_name: 'field_name',    // Required for onChange
    description: '{{description}}',
    isolate_script: false,
    script: Now.include('./{{scriptFile}}.client.js'),
});
