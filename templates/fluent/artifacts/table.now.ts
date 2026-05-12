/**
 * Table: {{tableName}}
 * {{description}}
 */
import { Table, StringColumn, IntegerColumn, DateTimeColumn, ReferenceColumn, BooleanColumn } from '@servicenow/sdk/core';

export const {{tableVar}} = Table({
    name: '{{tableName}}',
    label: '{{tableLabel}}',
    // extends: 'task',              // Extend an existing table
    // extensible: true,             // Allow other tables to extend this one
    // display: 'name',              // Display field
    // auto_number: {
    //     prefix: '{{prefix}}',
    //     number: 100,
    //     number_of_digits: 7,
    // },
    schema: {
        name: StringColumn({ label: 'Name', mandatory: true, maxLength: 100 }),
        // description: StringColumn({ label: 'Description', maxLength: 1000 }),
        // status: StringColumn({
        //     label: 'Status',
        //     dropdown: 'suggestion',
        //     choices: {
        //         new: { label: 'New' },
        //         active: { label: 'Active' },
        //         closed: { label: 'Closed' },
        //     },
        // }),
        // count: IntegerColumn({ label: 'Count', default: 0 }),
        // active: BooleanColumn({ label: 'Active', default: true }),
        // created: DateTimeColumn({ label: 'Created' }),
        // assigned_to: ReferenceColumn({ label: 'Assigned To', referenceTable: 'sys_user' }),
    },
});
