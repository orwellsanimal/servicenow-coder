/**
 * Record: {{recordName}}
 * Seed data for {{tableName}}
 */
import { Record } from '@servicenow/sdk/core';

Record({
    $id: Now.ID['{{recordId}}'],
    table: '{{tableName}}',
    data: {
        name: '{{recordName}}',
        // field_name: 'value',
    },
    // $meta: {
    //     installMethod: 'demo', // 'demo' | 'always'
    // },
});
