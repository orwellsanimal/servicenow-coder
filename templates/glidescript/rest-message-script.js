/**
 * Scripted REST API Resource: {{resourceName}}
 * HTTP Method: GET / POST / PUT / DELETE
 * Relative Path: /{{path}}
 *
 * {{description}}
 *
 * Available objects:
 *   request  - RESTAPIRequest
 *   response - RESTAPIResponse
 */
(function process(/** @type {sn_ws.RESTAPIRequest} */ request, /** @type {sn_ws.RESTAPIResponse} */ response) {

    // Path parameters:  request.pathParams['id']
    // Query parameters: request.queryParams['filter']
    // Request body:     request.body.data
    // Request headers:  request.getHeader('Content-Type')

    try {
        // var id = request.pathParams['id'];

        // Example: query records
        // var gr = new GlideRecord('{{tableName}}');
        // gr.addQuery('sys_id', id);
        // gr.query();
        //
        // if (!gr.next()) {
        //     response.setStatus(404);
        //     response.setBody({ error: 'Not found' });
        //     return;
        // }

        var result = {};

        response.setStatus(200);
        response.setBody({ result: result });

    } catch (e) {
        gs.error('{{resourceName}} error: ' + e.message);
        response.setStatus(500);
        response.setBody({ error: e.message });
    }

})(request, response);
