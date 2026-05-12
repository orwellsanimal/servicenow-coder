/**
 * Server module for REST API: {{apiName}}
 */
import { gs } from '@servicenow/glide';

export function handleGet(request: any, response: any) {
    const params = request.queryParams;
    response.setStatus(200);
    response.setBody({ result: 'OK' });
}

export function handlePost(request: any, response: any) {
    const body = request.body.data;
    // Process the request body
    response.setStatus(201);
    response.setBody({ result: 'Created' });
}
