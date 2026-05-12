/**
 * Flow: {{flowName}}
 * {{description}}
 */
import { Flow, wfa, action, trigger } from '@servicenow/sdk/automation';
import { StringColumn } from '@servicenow/sdk/core';

export const {{flowVar}} = Flow(
    {
        $id: Now.ID['{{flowId}}'],
        name: '{{flowName}}',
        description: '{{description}}',
        // runAs: 'system',
        // flowPriority: 'LOW',
        // flowVariables: {
        //     my_var: StringColumn({ label: 'My Variable' }),
        // },
    },

    // Trigger
    wfa.trigger(
        trigger.record.createdOrUpdated,
        { $id: Now.ID['{{flowId}}-trigger'] },
        {
            table: '{{tableName}}',
            // condition: 'active=true',
            run_flow_in: 'background',
            run_on_extended: 'false',
            run_when_setting: 'both',
            run_when_user_setting: 'any',
            run_when_user_list: [],
        },
    ),

    // Actions
    (params) => {
        wfa.action(
            action.core.log,
            { $id: Now.ID['{{flowId}}-log'] },
            {
                log_level: 'info',
                log_message: `Flow triggered for: ${wfa.dataPill(params.trigger.current.sys_id, 'string')}`,
            },
        );

        // wfa.flowLogic.if(
        //     {
        //         $id: Now.ID['{{flowId}}-if'],
        //         condition: `${wfa.dataPill(params.trigger.current.state, 'string')}=1`,
        //         annotation: 'Check condition',
        //     },
        //     () => {
        //         // True branch
        //     },
        // );
    },
);
