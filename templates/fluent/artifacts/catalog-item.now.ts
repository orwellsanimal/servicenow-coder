/**
 * Catalog Item: {{itemName}}
 * {{description}}
 */
import {
    CatalogItem,
    SingleLineTextVariable,
    MultiLineTextVariable,
    SelectBoxVariable,
    CheckboxVariable,
    ReferenceVariable,
} from '@servicenow/sdk/core';

export const {{itemVar}} = CatalogItem({
    $id: Now.ID['{{itemId}}'],
    name: '{{itemName}}',
    shortDescription: '{{description}}',
    // description: 'Detailed description with HTML support',

    // Catalog placement
    // catalogs: [catalogRef],
    // categories: [categoryRef],

    // Fulfillment
    fulfillmentAutomationLevel: 'semiAutomated',
    // flow: flowReference,

    // Portal behavior
    requestMethod: 'order',
    hideQuantitySelector: true,
    mandatoryAttachment: false,

    // Access
    // accessType: 'available',
    // roles: [roleRef],

    // Variables (the form fields users fill out)
    variables: {
        short_description: SingleLineTextVariable({
            question: 'Short Description',
            order: 100,
            mandatory: true,
            maxLength: 160,
        }),
        // details: MultiLineTextVariable({
        //     question: 'Details',
        //     order: 200,
        // }),
        // category: SelectBoxVariable({
        //     question: 'Category',
        //     order: 300,
        //     mandatory: true,
        //     choices: {
        //         hardware: { label: 'Hardware' },
        //         software: { label: 'Software' },
        //         access: { label: 'Access' },
        //     },
        //     defaultValue: 'software',
        //     includeNone: false,
        // }),
        // urgent: CheckboxVariable({
        //     question: 'Urgent?',
        //     order: 400,
        //     defaultValue: false,
        // }),
        // assigned_to: ReferenceVariable({
        //     question: 'Assign To',
        //     order: 500,
        //     referenceTable: 'sys_user',
        // }),
    },
});
