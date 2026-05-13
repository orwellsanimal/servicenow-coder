import '@servicenow/sdk/global';

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    atf_pc_request_smoke: {
                        table: 'sys_atf_test';
                        id: 'b6cf9d1c0d10442abc2cfa9250a631ef';
                    };
                    bom_json: {
                        table: 'sys_module';
                        id: '57940e0fe2d444229fc51ba8cb04b9be';
                    };
                    nightly_pc_request: {
                        table: 'sysauto_script';
                        id: '9a6ae648187a48bf9a8c79103ce01f1e';
                    };
                    'open-pc-item': {
                        table: 'sys_atf_step';
                        id: '6e33b606eb354576bdc78ab392262abf';
                    };
                    'order-pc-item': {
                        table: 'sys_atf_step';
                        id: '6443dbe7a0604773ae4651c4fe12a872';
                    };
                    package_json: {
                        table: 'sys_module';
                        id: '2cf700f94dac4b48b3a25ef4246c006b';
                    };
                    'query-pc-item': {
                        table: 'sys_atf_step';
                        id: '0bf3565ea1744b818ef858955e1e6755';
                    };
                    'src_server_nightly-pc-request_ts': {
                        table: 'sys_module';
                        id: 'bfbd987c4cf140969edf8206106c1e30';
                    };
                    'validate-request': {
                        table: 'sys_atf_step';
                        id: '258a12fe7e20464cad1a6ff513eed755';
                    };
                    x_pcreq_suite: {
                        table: 'sys_atf_test_suite';
                        id: '1c4b6b91833b40499e8b5b274161b41d';
                    };
                    x_pcreq_suite_member_smoke: {
                        table: 'sys_atf_test_suite_test';
                        id: 'c076b199355949b88ce8508706856a31';
                    };
                };
                composite: [
                    {
                        table: 'sys_element_mapping';
                        id: '06f320cdca92493d8bd8e49c5e73e752';
                        key: {
                            field: 'record_id';
                            id: '258a12fe7e20464cad1a6ff513eed755';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '2179176c13f34268b8b714deb82a3ad5';
                        key: {
                            document_key: '0bf3565ea1744b818ef858955e1e6755';
                            variable: '02fb0027531000109e02ddeeff7b120b';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '2710c78f0ad048d3ae2fc49cbf7eb963';
                        key: {
                            document_key: '258a12fe7e20464cad1a6ff513eed755';
                            variable: '6aad5a575360220002c6435723dc34b0';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '2c0a178ed6394b5a9401de20306071e2';
                        key: {
                            document_key: '0bf3565ea1744b818ef858955e1e6755';
                            variable: 'b86c0427531000109e02ddeeff7b1227';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '2fbc327f887041b09d7b0461945ee339';
                        key: {
                            document_key: '0bf3565ea1744b818ef858955e1e6755';
                            variable: '78b8d86b531000109e02ddeeff7b12f3';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '4ae0fc3fb00549fca4ca0144f141c69e';
                        key: {
                            document_key: '6e33b606eb354576bdc78ab392262abf';
                            variable: 'b0d64ce1c332220076173b0ac3d3ae95';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '4d08e193c96946a6877bb92e38d09d46';
                        key: {
                            document_key: '258a12fe7e20464cad1a6ff513eed755';
                            variable: '67400008676003007ba405225685efa4';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '5c221468e18747f28117ded66363a03f';
                        key: {
                            document_key: '258a12fe7e20464cad1a6ff513eed755';
                            variable: 'cbddfa135320220002c6435723dc3415';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '8698f3d3679d404bb9bf6fc415c10548';
                        key: {
                            document_key: '6443dbe7a0604773ae4651c4fe12a872';
                            variable: '17513cb2c310320076173b0ac3d3ae64';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: '99fda80a117040a39313460918abda93';
                        key: {
                            document_key: '258a12fe7e20464cad1a6ff513eed755';
                            variable: 'ff6e125353a0220002c6435723dc3442';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: 'b7174533a4214bf4a497802baa9ad6ec';
                        key: {
                            document_key: '258a12fe7e20464cad1a6ff513eed755';
                            variable: '52ed1e5b5360220002c6435723dc3421';
                        };
                    },
                    {
                        table: 'sys_variable_value';
                        id: 'cebb1b392d304fee906ebed202244133';
                        key: {
                            document_key: '0bf3565ea1744b818ef858955e1e6755';
                            variable: '915990ab531000109e02ddeeff7b12f8';
                        };
                    },
                ];
            }
        }
    }
}
