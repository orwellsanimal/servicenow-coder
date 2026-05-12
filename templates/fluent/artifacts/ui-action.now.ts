/**
 * UI Action: {{actionName}}
 * {{description}}
 */
import { UiAction } from '@servicenow/sdk/core';

UiAction({
    $id: Now.ID['{{actionId}}'],
    table: '{{tableName}}',
    actionName: '{{actionName}}',
    name: '{{actionVar}}',
    active: true,
    showInsert: true,
    showUpdate: true,
    hint: '{{description}}',
    // condition: "current.state == 'new'",
    // order: 100,
    // roles: ['itil'],
    form: {
        showButton: true,
        showLink: false,
        showContextMenu: false,
        style: 'primary', // 'primary' | 'destructive'
    },
    // list: {
    //     showLink: true,
    //     style: 'primary',
    //     showButton: true,
    //     showContextMenu: false,
    // },
    script: `
        // Server-side UI action script
        current.update();
        action.setRedirectURL(current);
    `,
    // client: {
    //     isClient: true,
    //     isUi11Compatible: true,
    //     isUi16Compatible: true,
    // },
});
