/**
 * Scripted REST API: {{apiName}}
 * {{description}}
 */
import { RestApi } from '@servicenow/sdk/core';
import { handleGet, handlePost } from '../server/{{moduleName}}';

RestApi({
    $id: Now.ID['{{apiId}}'],
    name: '{{apiName}}',
    service_id: '{{serviceId}}',
    consumes: 'application/json',
    // produces: 'application/json',
    routes: [
        {
            $id: Now.ID['{{apiId}}-get'],
            name: 'get',
            method: 'GET',
            // relative_path: '/resource/{id}',
            script: handleGet,
        },
        {
            $id: Now.ID['{{apiId}}-post'],
            name: 'post',
            method: 'POST',
            script: handlePost,
        },
    ],
});
