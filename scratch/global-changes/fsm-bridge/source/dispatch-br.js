(function executeRule(current, previous /*null when async*/) {
    try {
        var dispatcher = new x_1111454_fsmbridge.FieldServiceDispatcher();
        var wmOrderSysId = dispatcher.handleIncidentTask(current.sys_id.toString());
        if (wmOrderSysId) {
            gs.info(
                '[fsm-bridge] incident_task ' + current.number +
                ' dispatched -> wm_order ' + wmOrderSysId
            );
        } else {
            gs.warn(
                '[fsm-bridge] dispatcher returned null for incident_task ' + current.number
            );
        }
    } catch (e) {
        gs.error(
            '[fsm-bridge] dispatch failed for incident_task ' + current.number + ': ' + e
        );
    }
})(current, previous);
