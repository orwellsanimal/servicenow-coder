/**
 * Script Include: {{className}}
 * {{description}}
 */
import { ScriptInclude } from '@servicenow/sdk/core';

ScriptInclude({
    $id: Now.ID['{{scriptId}}'],
    name: '{{className}}',
    active: true,
    apiName: 'x_{{scope}}.{{className}}',
    // client_callable: false,
    // access: 'public',            // 'public' | 'package_private'
    script: Now.include('./{{className}}.server.js'),
});
