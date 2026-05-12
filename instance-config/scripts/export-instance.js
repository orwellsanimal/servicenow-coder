#!/usr/bin/env node

/**
 * Export ServiceNow instance configuration metadata via Table API.
 *
 * Usage:
 *   SN_INSTANCE=https://your-instance.service-now.com \
 *   SN_USER=admin \
 *   SN_PASSWORD=password \
 *   node export-instance.js [--only schema,platform,security,services]
 *
 * Writes JSON files to the parent directory structure (instance-config/).
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const INSTANCE = process.env.SN_INSTANCE?.replace(/\/+$/, '');
const USER = process.env.SN_USER;
const PASSWORD = process.env.SN_PASSWORD;

if (!INSTANCE || !USER || !PASSWORD) {
    console.error('Required env vars: SN_INSTANCE, SN_USER, SN_PASSWORD');
    process.exit(1);
}

const BASE_DIR = path.resolve(__dirname, '..');

// Parse --only flag
const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const onlyCategories = onlyArg
    ? onlyArg.split('=')[1]?.split(',') || process.argv[process.argv.indexOf('--only') + 1]?.split(',')
    : null;

function shouldExport(category) {
    return !onlyCategories || onlyCategories.includes(category);
}

/**
 * Query the ServiceNow Table API with pagination.
 */
async function tableApiQuery(table, query = '', fields = [], limit = 10000, displayValue = 'true') {
    const records = [];
    let offset = 0;
    const batchSize = Math.min(limit, 1000);

    while (offset < limit) {
        const params = new URLSearchParams({
            sysparm_query: query,
            sysparm_fields: fields.join(','),
            sysparm_limit: String(batchSize),
            sysparm_offset: String(offset),
            sysparm_display_value: displayValue,
        });

        const url = `${INSTANCE}/api/now/table/${table}?${params}`;
        const batch = await fetchJson(url);

        if (!batch.result || batch.result.length === 0) break;
        records.push(...batch.result);
        if (records.length % 5000 === 0 || batch.result.length < batchSize) {
            process.stdout.write(`    (${records.length} records so far...)\r`);
        }

        // ServiceNow instances may cap results slightly below the requested limit
        // (e.g. 999 when you ask for 1000). Only stop if we got significantly fewer.
        if (batch.result.length < batchSize * 0.9) break;
        offset += batchSize;
    }

    // Normalize: ServiceNow API returns reference/choice fields as objects:
    //   display_value=true:  { display_value: "...", link: "..." }
    //   display_value=false: { value: "...", link: "..." }
    // Flatten to just the string value.
    return records.map((r) => {
        const normalized = {};
        for (const [k, v] of Object.entries(r)) {
            if (v && typeof v === 'object' && ('display_value' in v || 'value' in v)) {
                normalized[k] = v.display_value ?? v.value ?? '';
            } else {
                normalized[k] = v;
            }
        }
        return normalized;
    });
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const auth = Buffer.from(`${USER}:${PASSWORD}`).toString('base64');

        const req = client.get(
            url,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: 'application/json',
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${e.message}`));
                    }
                });
            },
        );
        req.on('error', reject);
    });
}

function writeJson(relPath, data) {
    const filePath = path.join(BASE_DIR, relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n');
    console.log(`  Wrote ${relPath} (${typeof data === 'object' ? JSON.stringify(data).length : 0} bytes)`);
}

// --- Export functions ---

async function exportInstanceInfo() {
    console.log('Exporting instance info...');
    let stats;
    try {
        stats = await fetchJson(`${INSTANCE}/api/now/table/sys_properties?sysparm_query=name=glide.buildtag^ORname=glide.builddate&sysparm_fields=name,value&sysparm_limit=5`);
    } catch {
        stats = { result: [] };
    }

    const props = {};
    for (const r of stats.result || []) props[r.name] = r.value;

    writeJson('instance.json', {
        $schema: './schemas/instance.schema.json',
        instance_url: INSTANCE,
        instance_id: '',
        family: 'australia',
        build: props['glide.buildtag'] || '',
        build_date: props['glide.builddate'] || '',
        exported_at: new Date().toISOString(),
        profile: 'exported',
    });
}

async function exportSchema() {
    if (!shouldExport('schema')) return;
    console.log('Exporting schema...');

    // Tables — use display_value=false so 'name' returns raw table names (e.g. sys_user, not User)
    console.log('  Querying sys_db_object...');
    const tableRecords = await tableApiQuery(
        'sys_db_object',
        'ORDERBYname',
        ['sys_id', 'name', 'label', 'super_class', 'sys_scope', 'is_extendable', 'number_ref', 'access'],
        20000,
        'false',
    );
    const tables = {};
    for (const r of tableRecords) {
        tables[r.name] = {
            sys_id: r.sys_id,
            label: r.label,
            super_class: r.super_class || '',
            scope: r.sys_scope || '',
            is_extendable: r.is_extendable === 'true',
            number_prefix: r.number_ref || '',
            access: r.access || '',
        };
    }
    writeJson('schema/tables.json', {
        $schema: '../schemas/tables.schema.json',
        _source: 'sys_db_object',
        _description: 'Tables on the instance.',
        tables,
    });

    // Columns — use display_value=false so reference returns raw table names
    console.log('  Querying sys_dictionary...');
    const colRecords = await tableApiQuery(
        'sys_dictionary',
        'internal_type!=collection^element!=NULL',
        [
            'name', 'element', 'column_label', 'internal_type', 'max_length',
            'mandatory', 'read_only', 'active', 'default_value', 'reference', 'sys_scope',
        ],
        50000,
        'false',
    );
    const columns = {};
    for (const r of colRecords) {
        if (!r.name || !r.element) continue;
        if (!columns[r.name]) columns[r.name] = [];
        columns[r.name].push({
            element: r.element,
            column_label: r.column_label || '',
            internal_type: r.internal_type || '',
            max_length: parseInt(r.max_length) || 0,
            mandatory: r.mandatory === 'true',
            read_only: r.read_only === 'true',
            active: r.active !== 'false',
            default_value: r.default_value || '',
            reference: r.reference || '',
            scope: r.sys_scope || '',
        });
    }
    writeJson('schema/columns.json', {
        $schema: '../schemas/columns.schema.json',
        _source: 'sys_dictionary',
        _description: 'Columns/fields per table.',
        columns,
    });

    // Choices
    console.log('  Querying sys_choice...');
    const choiceRecords = await tableApiQuery(
        'sys_choice',
        'inactive=false',
        ['name', 'element', 'value', 'label', 'sequence', 'inactive'],
        50000,
    );
    const choices = {};
    for (const r of choiceRecords) {
        const key = `${r.name}.${r.element}`;
        if (!choices[key]) choices[key] = [];
        choices[key].push({
            value: r.value,
            label: r.label,
            sequence: parseInt(r.sequence) || 0,
            inactive: r.inactive === 'true',
        });
    }
    writeJson('schema/choices.json', {
        $schema: '../schemas/choices.schema.json',
        _source: 'sys_choice',
        _description: 'Choice/dropdown values per table.field.',
        choices,
    });

    // Relationships (reference fields)
    console.log('  Building relationships from columns...');
    // Build a label→name lookup so we can resolve display values to table names
    const labelToName = {};
    for (const [name, meta] of Object.entries(tables)) {
        if (meta.label) labelToName[meta.label] = name;
    }
    const refTypes = ['reference', 'glide_list', 'document_id'];
    const relationships = [];
    for (const [table, cols] of Object.entries(columns)) {
        for (const col of cols) {
            const normalizedType = col.internal_type.toLowerCase().replace(/ /g, '_');
            if (col.reference && refTypes.includes(normalizedType)) {
                const targetTable = tables[col.reference] ? col.reference : (labelToName[col.reference] || col.reference);
                const colType = normalizedType;
                relationships.push({
                    source_table: table,
                    source_field: col.element,
                    target_table: targetTable,
                    type: colType,
                });
            }
        }
    }
    writeJson('schema/relationships.json', {
        $schema: '../schemas/relationships.schema.json',
        _source: 'sys_dictionary (type=reference/glide_list)',
        _description: 'Reference field relationships between tables.',
        relationships,
    });
}

async function safeQuery(label, fn) {
    try {
        await fn();
    } catch (err) {
        console.error(`    [SKIP] ${label}: ${err.message}`);
    }
}

async function exportPlatform() {
    if (!shouldExport('platform')) return;
    console.log('Exporting platform config...');

    // Plugins
    await safeQuery('sys_plugins', async () => {
        console.log('  Querying sys_plugins...');
        const pluginRecords = await tableApiQuery(
            'sys_plugins',
            'active=active',
            ['sys_id', 'source', 'name', 'version', 'active', 'scope'],
        );
        const plugins = {};
        for (const r of pluginRecords) {
            plugins[r.source || r.sys_id] = {
                sys_id: r.sys_id,
                name: r.name,
                version: r.version || '',
                active: r.active === 'active',
                scope: r.scope || '',
            };
        }
        writeJson('platform/plugins.json', {
            $schema: '../schemas/plugins.schema.json',
            _source: 'sys_plugins',
            _description: 'Activated plugins on the instance.',
            plugins,
        });
    });

    // Properties
    await safeQuery('sys_properties', async () => {
        console.log('  Querying sys_properties...');
        const propRecords = await tableApiQuery(
            'sys_properties',
            '',
            ['sys_id', 'name', 'value', 'description', 'type', 'sys_scope'],
            20000,
        );
        const properties = {};
        for (const r of propRecords) {
            if (!r.name) continue;
            properties[r.name] = {
                sys_id: r.sys_id,
                value: r.value || '',
                description: r.description || '',
                type: r.type || 'string',
                scope: r.sys_scope || '',
            };
        }
        writeJson('platform/properties.json', {
            $schema: '../schemas/properties.schema.json',
            _source: 'sys_properties',
            _description: 'System properties.',
            properties,
        });
    });

    // Scopes
    await safeQuery('sys_scope', async () => {
        console.log('  Querying sys_scope...');
        const scopeRecords = await tableApiQuery(
            'sys_scope',
            '',
            ['sys_id', 'name', 'scope', 'version', 'vendor', 'active'],
        );
        const scopes = {};
        for (const r of scopeRecords) {
            scopes[r.scope || r.name] = {
                sys_id: r.sys_id,
                name: r.name,
                scope: r.scope || '',
                version: r.version || '',
                vendor: r.vendor || '',
                active: r.active !== 'false',
            };
        }
        writeJson('platform/scopes.json', {
            $schema: '../schemas/scopes.schema.json',
            _source: 'sys_scope',
            _description: 'Application scopes on the instance.',
            scopes,
        });
    });
}

async function exportSecurity() {
    if (!shouldExport('security')) return;
    console.log('Exporting security config...');

    await safeQuery('sys_user_role', async () => {
        console.log('  Querying sys_user_role...');
        const roleRecords = await tableApiQuery(
            'sys_user_role',
            '',
            ['sys_id', 'name', 'description', 'elevated_privilege', 'sys_scope'],
        );
        const roles = {};
        for (const r of roleRecords) {
            if (!r.name) continue;
            roles[r.name] = {
                sys_id: r.sys_id,
                name: r.name,
                description: r.description || '',
                elevated_privilege: r.elevated_privilege === 'true',
                scope: r.sys_scope || '',
            };
        }
        writeJson('security/roles.json', {
            $schema: '../schemas/roles.schema.json',
            _source: 'sys_user_role',
            _description: 'Roles defined on the instance.',
            roles,
        });
    });

    await safeQuery('sys_security_acl', async () => {
        console.log('  Querying sys_security_acl...');
        const aclRecords = await tableApiQuery(
            'sys_security_acl',
            'active=true',
            ['sys_id', 'name', 'operation', 'type', 'condition', 'active', 'sys_scope'],
            20000,
        );
        const aclPolicies = {};
        for (const r of aclRecords) {
            const key = r.name || 'unknown';
            if (!aclPolicies[key]) aclPolicies[key] = [];
            aclPolicies[key].push({
                sys_id: r.sys_id,
                name: r.name,
                operation: r.operation || '',
                type: r.type || '',
                roles: [],
                condition: r.condition || '',
                active: r.active !== 'false',
                scope: r.sys_scope || '',
            });
        }
        writeJson('security/acl-policies.json', {
            $schema: '../schemas/acl-policies.schema.json',
            _source: 'sys_security_acl',
            _description: 'ACL policy summaries.',
            acl_policies: aclPolicies,
        });
    });
}

async function exportServices() {
    if (!shouldExport('services')) return;
    console.log('Exporting services...');

    // Scripted REST APIs
    console.log('  Querying sys_ws_definition...');
    const apiRecords = await tableApiQuery(
        'sys_ws_definition',
        '',
        ['sys_id', 'name', 'api_id', 'namespace', 'base_uri', 'active', 'sys_scope'],
    );
    const restApis = apiRecords.map((r) => ({
        sys_id: r.sys_id,
        name: r.name,
        api_id: r.api_id || '',
        namespace: r.namespace || '',
        base_uri: r.base_uri || '',
        active: r.active !== 'false',
        scope: r.sys_scope || '',
        resources: [],
    }));
    writeJson('services/rest-apis.json', {
        $schema: '../schemas/rest-apis.schema.json',
        _source: 'sys_ws_definition',
        _description: 'Scripted REST APIs.',
        rest_apis: restApis,
    });

    // Integrations — connection aliases
    console.log('  Querying sys_alias...');
    let integrations = [];
    try {
        const aliasRecords = await tableApiQuery(
            'sys_alias',
            '',
            ['sys_id', 'name', 'type', 'active', 'sys_scope'],
        );
        integrations = aliasRecords.map((r) => ({
            sys_id: r.sys_id,
            name: r.name,
            type: 'connection_alias',
            target_url: '',
            active: r.active !== 'false',
            scope: r.sys_scope || '',
        }));
    } catch {
        console.log('  (sys_alias not accessible, skipping)');
    }
    writeJson('services/integrations.json', {
        $schema: '../schemas/integrations.schema.json',
        _source: 'sys_alias',
        _description: 'Outbound integration endpoints.',
        integrations,
    });
}

// --- Main ---

async function main() {
    console.log(`Exporting from: ${INSTANCE}`);
    console.log(`Categories: ${onlyCategories ? onlyCategories.join(', ') : 'all'}\n`);

    await exportInstanceInfo();

    const categories = [
        ['schema', exportSchema],
        ['platform', exportPlatform],
        ['security', exportSecurity],
        ['services', exportServices],
    ];

    const failures = [];
    for (const [name, fn] of categories) {
        try {
            await fn();
        } catch (err) {
            console.error(`\n  [WARN] ${name} export failed: ${err.message}`);
            console.error(`  Continuing with remaining categories...\n`);
            failures.push(name);
        }
    }

    console.log('\nExport complete.');
    if (failures.length > 0) {
        console.log(`Partial failures (likely ACL restrictions): ${failures.join(', ')}`);
        console.log('Grant the export user admin or appropriate roles to access these tables.');
    }
}

main().catch((err) => {
    console.error('Export failed:', err.message);
    process.exit(1);
});
