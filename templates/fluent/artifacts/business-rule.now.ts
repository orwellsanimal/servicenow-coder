/**
 * Business Rule: {{ruleName}}
 * {{description}}
 */
import { BusinessRule } from '@servicenow/sdk/core';
import { {{functionName}} } from '../server/{{moduleName}}';

BusinessRule({
    $id: Now.ID['{{ruleId}}'],
    name: '{{ruleName}}',
    active: true,
    table: '{{tableName}}',
    when: 'before', // 'before' | 'after' | 'async' | 'display'
    // insert: true,
    // update: true,
    // delete: true,
    // query: true,
    // filter_condition: 'active=true',
    // order: 100,
    script: {{functionName}},
});
