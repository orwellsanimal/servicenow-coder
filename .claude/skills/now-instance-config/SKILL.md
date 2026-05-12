---
name: now-instance-config
description: Use when generating ServiceNow code that references tables, fields, choices, plugins, roles, scopes, or REST APIs. Grounds code generation against the actual instance configuration in instance-config/. Invoke before writing any code that depends on instance-specific metadata.
argument-hint: "[table-name or topic]"
---

## Purpose

Ground ServiceNow code generation against what actually exists on the target instance. This prevents hallucinating table names, field names, choice values, or referencing inactive plugins.

## When to Use

- Before writing a GlideRecord query — verify the table and fields exist
- Before creating a Business Rule — check the table schema and reference fields
- Before referencing a choice/dropdown value — look up valid choices
- Before using a scoped API — confirm the plugin is activated
- Before assigning roles in ACLs — verify the role exists
- Before calling a Scripted REST API — check it's registered

## How to Use

### Check if a table exists and view its fields

```bash
# Read the table list
cat instance-config/schema/tables.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const t = d.tables['$ARGUMENTS'] || null;
  console.log(t ? JSON.stringify(t, null, 2) : 'Table not found');
"
```

```bash
# Read columns for a table
cat instance-config/schema/columns.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const c = d.columns['$ARGUMENTS'] || null;
  console.log(c ? JSON.stringify(c, null, 2) : 'No columns found for table');
"
```

### Check choice values for a field

```bash
# Format: table_name.field_name (e.g., incident.state)
cat instance-config/schema/choices.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const c = d.choices['$ARGUMENTS'] || null;
  console.log(c ? JSON.stringify(c, null, 2) : 'No choices found');
"
```

### Check reference relationships from/to a table

```bash
cat instance-config/schema/relationships.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const matches = d.relationships.filter(r =>
    r.source_table === '$ARGUMENTS' || r.target_table === '$ARGUMENTS'
  );
  console.log(JSON.stringify(matches, null, 2));
"
```

### Check if a plugin is active

```bash
cat instance-config/platform/plugins.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const term = '$ARGUMENTS'.toLowerCase();
  const matches = Object.entries(d.plugins).filter(([k,v]) =>
    k.toLowerCase().includes(term) || v.name.toLowerCase().includes(term)
  );
  console.log(matches.length ? JSON.stringify(Object.fromEntries(matches), null, 2) : 'No matching plugins');
"
```

### Check available roles

```bash
cat instance-config/security/roles.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const term = '$ARGUMENTS'.toLowerCase();
  const matches = Object.entries(d.roles).filter(([k,v]) =>
    k.toLowerCase().includes(term) || (v.description||'').toLowerCase().includes(term)
  );
  console.log(matches.length ? JSON.stringify(Object.fromEntries(matches), null, 2) : 'No matching roles');
"
```

### Check available scopes

```bash
cat instance-config/platform/scopes.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const term = '$ARGUMENTS'.toLowerCase();
  const matches = Object.entries(d.scopes).filter(([k,v]) =>
    k.toLowerCase().includes(term) || v.name.toLowerCase().includes(term)
  );
  console.log(matches.length ? JSON.stringify(Object.fromEntries(matches), null, 2) : 'No matching scopes');
"
```

## File Locations

| File | Source Table | What It Contains |
|------|-------------|-----------------|
| `instance-config/schema/tables.json` | sys_db_object | All tables |
| `instance-config/schema/columns.json` | sys_dictionary | Fields per table |
| `instance-config/schema/choices.json` | sys_choice | Dropdown values per field |
| `instance-config/schema/relationships.json` | sys_dictionary | Reference field relationships |
| `instance-config/platform/plugins.json` | sys_plugins | Activated plugins |
| `instance-config/platform/properties.json` | sys_properties | System properties |
| `instance-config/platform/scopes.json` | sys_scope | Application scopes |
| `instance-config/security/roles.json` | sys_user_role | Roles |
| `instance-config/security/acl-policies.json` | sys_security_acl | ACL patterns |
| `instance-config/services/rest-apis.json` | sys_ws_definition | Scripted REST APIs |
| `instance-config/services/integrations.json` | sys_alias | Connection aliases |

## Important

- If the config files are empty (no exported data yet), note this to the user and suggest running the export script.
- Config data is a point-in-time snapshot. If the user says something exists that isn't in the config, trust them — the config may be stale.
- For OOTB instances, common tables like `incident`, `task`, `sys_user`, `cmdb_ci` will always exist even if not yet exported.
