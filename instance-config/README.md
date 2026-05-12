# ServiceNow Instance Configuration

Instance-specific metadata that grounds AI code generation to what actually exists on the target ServiceNow instance. This folder captures the schema, plugins, scopes, and configuration that differ from instance to instance.

## Purpose

Generic ServiceNow docs + SDK teach *how* to build. This folder teaches *what exists* on a specific instance — so generated code references real tables, real fields, real scopes, and real system properties instead of hallucinating them.

## Structure

```
instance-config/
├── instance.json              # Instance identity (URL, version, family)
├── schema/
│   ├── tables.json            # sys_db_object: tables and their metadata
│   ├── columns.json           # sys_dictionary: fields/columns per table
│   ├── choices.json           # sys_choice: dropdown/choice values per field
│   └── relationships.json     # sys_relationship: table reference relationships
├── platform/
│   ├── plugins.json           # sys_plugins: activated plugins and versions
│   ├── properties.json        # sys_properties: system properties and values
│   └── scopes.json            # sys_scope: application scopes on the instance
├── security/
│   ├── roles.json             # sys_user_role: roles defined on the instance
│   └── acl-policies.json      # sys_security_acl: ACL patterns summary
├── services/
│   ├── rest-apis.json         # sys_ws_definition: scripted REST APIs
│   └── integrations.json      # sys_remote_instance / connection aliases
└── scripts/
    └── export-instance.js     # Script to pull all metadata from an instance via REST
```

## How It Works

1. **Export** — Run the export script against a ServiceNow instance to populate the JSON files
2. **Ground** — AI tools read these files to understand what's available before generating code
3. **Validate** — Generated code can be checked against the schema to catch references to non-existent tables/fields

## For OOTB vs. Customer Instances

- The `ootb/` profile ships with this repo as a baseline (default tables, roles, plugins)
- Customer deployments copy this structure, run the export script against their instance, and get a grounding layer tailored to their environment

## Export Script Usage

```bash
# Set instance credentials
export SN_INSTANCE=https://your-instance.service-now.com
export SN_USER=admin
export SN_PASSWORD=your-password

# Run full export
node instance-config/scripts/export-instance.js

# Export specific categories
node instance-config/scripts/export-instance.js --only schema,platform
```
