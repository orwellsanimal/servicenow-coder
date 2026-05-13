---
name: now-scaffold
description: Scaffold a new ServiceNow Fluent app (delegates to now-sdk init) or generate individual artifact code from local templates. Use when the user wants to create a new project, table, business rule, script include, client script, REST API, ACL, flow, UI action, catalog item, or other ServiceNow artifact.
argument-hint: "<type> <name> [options]"
---

## Purpose

Generate ServiceNow code in two modes:
- **Project creation** — delegates to the official `now-sdk init` so we don't reinvent the wheel
- **Artifact generation** — uses local templates in `templates/` for individual files within an existing project

Supports both **Fluent SDK** (TypeScript `.now.ts`) and **vanilla GlideScript** (classic `.js`).

## Project Creation

For new Fluent apps, **always use `now-sdk init`** instead of copying templates manually. The SDK generates correct scope IDs, registers the app properly, and stays in sync with platform conventions.

### Workflow

1. Determine target directory — default is `apps/<app-name>/`
2. Run init from the apps directory:
   ```bash
   cd apps/
   npx @servicenow/sdk init \
       --appName "{{App Display Name}}" \
       --packageName {{package-name}} \
       --scopeName x_{{scope}} \
       --template base \
       --auth dev
   ```
3. Template options: `base`, `javascript.basic`, `javascript.react`, `typescript.basic`, `typescript.react`, `typescript.vue`
   - Use `base` for most server-side apps
   - Use `typescript.react` for apps with custom UI pages
4. Run `pnpm install` in the new app directory
5. Verify with `pnpm run build`

### Alternative: Build Agent (in-platform AI)

For brand-new apps where the user has a rough idea, mention they can also use the ServiceNow Build Agent (in-platform AI scaffolder, free allowance ~100 calls customer / 25 PDI), then pull the result to local for iteration here.

## Artifact Generation (within an existing app)

The SDK doesn't ship per-artifact code templates, so we use local templates for individual files added to a project.

### Available Artifact Templates

#### Fluent SDK (TypeScript)

| Type | Template | Generates |
|------|----------|-----------|
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
| `atf-test` | `templates/fluent/artifacts/atf-test.now.ts` | ATF Test (`Test()`) — pair with the feature it validates |
| `atf-test-suite` | `templates/fluent/artifacts/atf-test-suite.now.ts` | ATF Test Suite — one per app, named `<scope>-suite` |

#### Vanilla GlideScript

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

### Artifact Workflow

1. **Determine type and mode** — Fluent if inside an `apps/<name>/` project, GlideScript if in `scratch/`
2. **Check instance config** — verify referenced tables, fields, choices, roles exist in `instance-config/`
3. **Read the template** — templates use `{{placeholder}}` syntax
4. **Generate the code** — substitute placeholders, uncomment relevant sections, remove unused ones
5. **Write to project**:
   - Fluent: `apps/<app>/src/fluent/<artifact-name>.now.ts` (and `src/server/<module>.ts` for server code)
   - GlideScript: `scratch/<artifact-name>.js`
6. **Verify** — for Fluent, run `pnpm run build` in the app directory

### Naming Conventions

- Scope: `x_<scopename>` (lowercase, no hyphens, ≤18 chars)
- Table names: `x_<scope>_<name>` (lowercase, underscores)
- Variable identifiers: camelCase for JS, snake_case for tables/fields
- Class names: PascalCase for Script Includes
- File names: kebab-case for `.now.ts`, PascalCase for server modules
- IDs: `Now.ID['kebab-case-descriptive-id']`

## Examples

**User:** "scaffold a new fluent app called incident-helper"
→ `cd apps && npx @servicenow/sdk init --appName "Incident Helper" --packageName incident-helper --scopeName x_inchelper --template base --auth dev`

**User:** "create a business rule on incident table"
→ Inside an existing `apps/<app>/` project, read `templates/fluent/artifacts/business-rule.now.ts`, fill in incident-specific logic, write to `src/fluent/`

**User:** "I need a script include to look up user departments"
→ Read template, generate `UserDepartmentLookup` class with appropriate methods

**User:** "write a fix script to update all inactive incidents"
→ Read `templates/glidescript/fix-script.js`, fill in incident table with inactive query, save to `scratch/`

**User:** "add an ATF test for the new approval business rule"
→ Read `templates/fluent/artifacts/atf-test.now.ts`, write to `apps/<app>/src/fluent/tests/<test-id>.now.ts`. If no suite exists for the app, also scaffold `atf-test-suite` (one-time per app) and add a `sys_atf_test_suite_test` membership Record entry referencing the new test.

## ATF Testing Convention

When generating a feature with AI assistance, pair it with an ATF test:
- **Test location:** `apps/<app>/src/fluent/tests/<test-id>.now.ts` (SDK only scans `src/fluent/`)
- **Suite per app:** named `<scope>-suite` (e.g. `x_inchelper-suite`). Created once per app via the `atf-test-suite` template.
- **Membership:** each test joins the suite via a `Record({ table: 'sys_atf_test_suite_test', ... })` block in the suite file.
- **CI:** `scripts/run-tests.js --all` runs every app's suite via `POST /api/sn_cicd/testsuite/run` and polls for results.
- **Role:** the deploy user needs `sn_cicd.sys_ci_automation` (or admin) for the CI/CD test API.

## When to Refer to Other Skills

- **SDK API details** — use `/fluent:now-sdk-explain` (or `/now-sdk-explain` if installed locally) for type definitions, conventions
- **Instance metadata** — use `/now-instance-config` to verify tables, fields, choices, roles, scopes exist
- **Environment errors** — use `/fluent:now-sdk-setup` if `now-sdk` commands fail with environment issues
