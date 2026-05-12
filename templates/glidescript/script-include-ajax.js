/**
 * Script Include (Client Callable): {{className}}
 * API Name: {{scope}}.{{className}}
 * Client Callable: true
 * Extends: AbstractAjaxProcessor
 *
 * {{description}}
 *
 * Client-side usage:
 *   var ga = new GlideAjax('{{scope}}.{{className}}');
 *   ga.addParam('sysparm_name', 'methodName');
 *   ga.addParam('sysparm_param', 'value');
 *   ga.getXMLAnswer(function(answer) { ... });
 */
var {{className}} = Class.create();
{{className}}.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    /**
     * {{methodDescription}}
     * @returns {string} JSON result
     */
    methodName: function() {
        var param = this.getParameter('sysparm_param');
        var result = {};

        // Implementation here

        return JSON.stringify(result);
    },

    type: '{{className}}'
});
