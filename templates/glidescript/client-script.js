/**
 * Client Script: {{scriptName}}
 * Table: {{tableName}}
 * Type: onLoad / onChange / onSubmit
 *
 * {{description}}
 */
function onLoad() {
    // Runs when the form loads

    // Example: hide a field
    // g_form.setVisible('field_name', false);

    // Example: make a field mandatory
    // g_form.setMandatory('field_name', true);

    // Example: set a field value
    // g_form.setValue('field_name', 'value');

    // Example: add an info message
    // g_form.addInfoMessage('Information for the user.');
}

// function onChange(control, oldValue, newValue, isLoading, isTemplate) {
//     if (isLoading || newValue === '') return;
//
//     // React to field value changes
//     // g_form.setValue('other_field', newValue);
//
//     // Example: async lookup via GlideAjax
//     // var ga = new GlideAjax('x_scope.MyScriptInclude');
//     // ga.addParam('sysparm_name', 'methodName');
//     // ga.addParam('sysparm_value', newValue);
//     // ga.getXMLAnswer(function(answer) {
//     //     g_form.setValue('target_field', answer);
//     // });
// }

// function onSubmit() {
//     // Runs before the form is submitted
//     // Return false to prevent submission
//
//     // var value = g_form.getValue('required_field');
//     // if (!value) {
//     //     g_form.addErrorMessage('Field is required.');
//     //     return false;
//     // }
//     return true;
// }
