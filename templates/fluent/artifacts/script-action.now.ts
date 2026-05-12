/**
 * Script Action: {{actionName}}
 * {{description}}
 */
import { ScriptAction } from '@servicenow/sdk/core';
import { {{functionName}} } from '../server/{{moduleName}}';

ScriptAction({
    $id: Now.ID['{{actionId}}'],
    name: '{{actionName}}',
    active: true,
    description: '{{description}}',
    eventName: 'x_{{scope}}.{{eventName}}',
    script: {{functionName}},
    order: 100,
    // conditionScript: "gs.hasRole('admin')",
});
