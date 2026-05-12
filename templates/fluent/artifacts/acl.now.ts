/**
 * ACL: {{tableName}} access controls
 * {{description}}
 */
import { Acl, Role } from '@servicenow/sdk/core';

// Define roles
export const {{scope}}Admin = Role({ name: 'x_{{scope}}.admin' });
export const {{scope}}User = Role({ name: 'x_{{scope}}.user' });

// Record-level ACLs
Acl({
    $id: Now.ID['{{tableName}}-read'],
    localOrExisting: 'Existing',
    type: 'record',
    operation: 'read',
    table: '{{tableName}}',
    roles: [{{scope}}User, {{scope}}Admin],
});

Acl({
    $id: Now.ID['{{tableName}}-write'],
    localOrExisting: 'Existing',
    type: 'record',
    operation: 'write',
    table: '{{tableName}}',
    roles: [{{scope}}Admin],
});

Acl({
    $id: Now.ID['{{tableName}}-create'],
    localOrExisting: 'Existing',
    type: 'record',
    operation: 'create',
    table: '{{tableName}}',
    roles: [{{scope}}Admin],
    // condition: 'active=true',
});

Acl({
    $id: Now.ID['{{tableName}}-delete'],
    localOrExisting: 'Existing',
    type: 'record',
    operation: 'delete',
    table: '{{tableName}}',
    roles: [{{scope}}Admin],
});
