---
name: now-scaffold
description: Scaffold a new ServiceNow Fluent app or generate artifact code from templates. Use when the user wants to create a new project, table, business rule, script include, client script, REST API, ACL, flow, UI action, catalog item, or any other ServiceNow artifact.
argument-hint: "<type> <name> [options]"
---

## Purpose

Generate ServiceNow code from project templates. Supports both **Fluent SDK** (TypeScript `.now.ts`) and **vanilla GlideScript** (classic `.js`) modes.

## Available Templates

### Fluent SDK (TypeScript)

| Type | Template | Generates |
|------|----------|-----------|
| `project` | `templates/fluent/project/` | Full app scaffold: now.config.json, package.json, src/ dirs |
| `table` | `templates/fluent/artifacts/table.now.ts` | Table definition with schema |
| `business-rule` | `templates/fluent/artifacts/business-rule.now.ts` + `.server.ts` | Business rule + server module |
| `script-include` | `templates/fluent/artifacts/script-include.now.ts` + `.server.ts` | Script include + server module |
| `client-script` | `templates/fluent/artifacts/client-script.now.ts` | Client script definition |
| `rest-api` | `templates/fluent/artifacts/rest-api.now.ts` + `.server.ts` | Scripted REST API + handlers |
| `acl` | `templates/fluent/artifacts/acl.now.ts` | ACL rules with roles |
| `ui-action` | `templates/fluent/artifacts/ui-action.now.ts` | UI action (form/list button) |
| `script-action` | `templates/fluent/artifacts/script-action.now.ts` | Script action (event handler) |
| `flow` | `templates/fluent/artifacts/flow.now.ts` | Flow Designer automation |
| `record` | `templates/fluent/artifacts/record.now.ts` | Seed data record |
| `catalog-item` | `templates/fluent/artifacts/catalog-item.now.ts` | Service catalog item |

### Vanilla GlideScript

| Type | Template | Generates |
|------|----------|-----------|
| `gs-business-rule` | `templates/glidescript/business-rule.js` | Classic business rule script |
| `gs-script-include` | `templates/glidescript/script-include.js` | Classic script include (Class.create) |
| `gs-script-include-ajax` | `templates/glidescript/script-include-ajax.js` | Client-callable AJAX script include |
| `gs-client-script` | `templates/glidescript/client-script.js` | Classic client script |
| `gs-rest-api` | `templates/glidescript/rest-message-script.js` | Scripted REST resource handler |
| `gs-scheduled-job` | `templates/glidescript/scheduled-job.js` | Scheduled script execution |
| `gs-ui-action` | `templates/glidescript/ui-action.js` | Classic UI action |
| `gs-fix-script` | `templates/glidescript/fix-script.js` | Fix script with dry-run safety |

## How to Scaffold

### Step 1: Determine what the user wants

Parse `$ARGUMENTS` to identify:
- **Type**: Which template to use (from the tables above)
- **Name**: The artifact/project name
- **Target table** (if applicable): Which ServiceNow table the artifact targets
- **Scope**: Application scope (defaults to project scope from now.config.json if in a Fluent project)
- **Mode**: Fluent or GlideScript (infer from context — if inside a Fluent project, use Fluent; if in `scratch/`, use GlideScript; otherwise ask)

### Step 2: Read the template

Read the appropriate template file from `templates/`. Templates use `{{placeholder}}` syntax for values that need substitution.

### Step 3: Check instance config (if populated)

Before generating, verify against `instance-config/` if available:
- For tables: check `instance-config/schema/tables.json` to confirm the target table exists
- For fields: check `instance-config/schema/columns.json` for valid field names
- For choices: check `instance-config/schema/choices.json` for valid choice values
- For roles: check `instance-config/security/roles.json` for valid role names
- For plugins: check `instance-config/platform/plugins.json` if the artifact depends on a plugin

If the config files are empty, skip validation and note it to the user.

### Step 4: Generate the code

Replace all `{{placeholder}}` values with actual values derived from the user's request.

**Naming conventions:**
- Scope: `x_<scopename>` (all lowercase, no hyphens)
- Table names: `x_<scope>_<name>` (lowercase, underscores)
- Variable identifiers: camelCase for JS vars, snake_case for table/field names
- Class names: PascalCase for Script Includes
- File names: kebab-case for `.now.ts` files, PascalCase for server modules
- IDs: `Now.ID['kebab-case-descriptive-id']`

**For Fluent `project` type:**
1. Copy the full `templates/fluent/project/` structure to the target directory
2. Generate a unique `scopeId` (UUID v4)
3. Replace placeholders in now.config.json and package.json
4. Run `pnpm install` if in the workspace

**For artifact types:**
1. Read the template and replace placeholders
2. Write to the appropriate location:
   - Fluent: `src/fluent/<artifact-name>.now.ts` (and `src/server/<module>.ts` for server code)
   - GlideScript: `scratch/<artifact-name>.js`
3. Uncomment relevant optional sections based on user requirements
4. Remove sections that don't apply

### Step 5: Verify

For Fluent artifacts in an existing project, run `pnpm run build` to verify the generated code compiles.

## Examples

User says: "scaffold a new fluent app called incident-helper"
→ Generate full project at `incident-helper/` from `templates/fluent/project/`

User says: "create a business rule on incident table"
→ Read `templates/fluent/artifacts/business-rule.now.ts`, fill in incident table details

User says: "I need a script include to look up user departments"
→ Read template, generate `UserDepartmentLookup` script include with appropriate methods

User says: "write a fix script to update all inactive incidents"
→ Read `templates/glidescript/fix-script.js`, fill in incident table with inactive query
