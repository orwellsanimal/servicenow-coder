# ServiceNow Coder Workspace

> **New here?** Start with [README.md](./README.md) for the overview, then [SETUP.md](./SETUP.md) for step-by-step install. This file is for Gemini CLI–specific conventions once you're set up.

## Project Structure

- **apps/** — Fluent SDK application projects (each subfolder is a deployable app, created via `now-sdk init`)
- **docs/** — PRDs/GDDs and feature specs for AI-grounded development
- **scratch/** — Ad-hoc development for vanilla GlideScript and experiments
- **instance-config/** — Instance-specific metadata (tables, fields, plugins, scopes) for grounding code generation
- **templates/** — Per-artifact templates (the SDK doesn't ship these; project-level `now-sdk init` handles full app scaffolding)
- **scripts/** — Build, deploy, test, setup runners (Node) + `scripts/python/` (PySNC utilities)
- **servicenow-sdk/** — Official SDK as a git submodule (auto-updates with `git submodule update --remote`)
- **servicenow-sdk-examples/** — Official SDK samples as a git submodule
- **servicenow-docs/** — Official ServiceNow docs as a git submodule (branch: australia = latest)
- **.github/workflows/** — GitHub Actions CI pipeline (active)
- **.harness/** — Harness pipeline reference spec (future, inactive)

## Development Modes

### 1. Fluent SDK (preferred)
- Files use `.now.ts` extension
- New projects: `npx @servicenow/sdk init` (don't reinvent — use the official scaffolder)
- Build/deploy: `now-sdk build`, `now-sdk install --auth dev`
- Project root has `now.config.json`
- Imports from `@servicenow/sdk/core` (Table, BusinessRule, etc.)

### 2. Vanilla GlideScript
- Traditional server-side scripting (Business Rules, Script Includes, Fix Scripts, etc.)
- Types from `@servicenow/glide` package
- Use `scratch/` folder for prototyping and one-off scripts

### 3. PySNC (Python utilities)
- Cross-cutting ops *against* the instance from outside (vs. Fluent/GlideScript which run *on* it)
- Use cases: data seeding for ATF, bulk fixes, cross-instance migrations, reporting/extraction
- Scripts live in `scripts/python/`; templates (future) in `templates/pysnc/`
- Reads same `.env` at repo root as Node scripts (`SN_INSTANCE`, `SN_USER`, `SN_PASSWORD`)
- Setup: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Full guide: `docs/guides/pysnc.md`

## Context Integration (Gemini CLI)

Unlike traditional agents that rely on external plugins, the Gemini CLI leverages a massive context window to ingest your local architecture directly. Use the `@` symbol in your prompts to feed specific workspace context to the model.

| Context Target | How to Reference | When to Use |
|----------------|------------------|-------------|
| **SDK API Docs** | `@servicenow-docs/markdown/api-reference/` | Need exact syntax for the Fluent SDK or GlideRecord APIs. |
| **Instance Metadata** | `@instance-config/schema/[file].json` | Verify table schemas, column names, choices, and ACL patterns before generating code. |
| **Example Code** | `@servicenow-sdk-examples/` | Ground the model in official, working SDK examples for complex patterns. |
| **Local Templates** | `@templates/` | Instruct the model to scaffold a new artifact matching your custom organizational standards. |

### Tool Execution
To allow Gemini CLI to run local build scripts or scaffold projects automatically, ensure your local `~/.gemini/settings.json` has tool execution permissions enabled for this workspace.

## Project Initialization Paths

When starting a new app, choose one:

1. **Local SDK init** (preferred for code-first work):
   Instruct the Gemini CLI to execute the following (if shell execution is enabled), or run it manually:
   ```bash
   cd apps/
   npx @servicenow/sdk init --appName "My App" --packageName my-app --scopeName x_myapp --template base --auth dev
   ```

## Instance Configuration (Grounding Layer)

`instance-config/` provides snapshot metadata from the dev instance for grounding. Always `@` mention the relevant JSON file when asking Gemini to write table-specific logic:

| File | Source Table | Use For |
|------|-------------|---------|
| `schema/tables.json` | sys_db_object | Verify table exists before referencing |
| `schema/columns.json` | sys_dictionary | Verify field names and types |
| `schema/choices.json` | sys_choice | Verify dropdown values |
| `schema/relationships.json` | sys_dictionary (refs) | Reference field targets |
| `platform/properties.json` | sys_properties | System property names/values |
| `platform/scopes.json` | sys_scope | Available scopes |
| `security/roles.json` | sys_user_role | Valid role names |
| `security/acl-policies.json` | sys_security_acl | ACL patterns |
| `services/rest-apis.json` | sys_ws_definition | Existing REST endpoints |

Re-export anytime:
```bash
SN_INSTANCE=https://dev123456.service-now.com SN_USER=admin SN_PASSWORD=… \
  node instance-config/scripts/export-instance.js
```

## Documentation Sources

**Platform docs**: Always reference `servicenow-docs/markdown/` (branch: australia for latest) via the CLI context tag.
- **API reference**: `@servicenow-docs/markdown/api-reference/index.md`
- **App development**: `@servicenow-docs/markdown/application-development/index.md`

**CLI Fallback**: If the local markdown doesn't have what you need, use `npx @servicenow/sdk explain <topic> --format=raw`.

Do NOT fetch from servicenow.com/docs — it's a JS SPA and returns no useful content to LLMs. Rely on your local git submodule.

## CI/CD Pipeline

### Strategy
- No update sets. Application Repository model via the SDK.
- Single dev instance for now. Pipeline stages map 1:1 to multi-instance Harness later.
- Git is the source of truth. SDK build → XML metadata → install → instance.

### Stages (GitHub Actions → future Harness)
1. **Validate** — lint, type-check
2. **Build** — `now-sdk build` all apps
3. **Pack** — `now-sdk pack` artifacts (main only)
4. **Deploy** — `now-sdk install` to dev instance (main only)
5. **Test** — `scripts/run-tests.js --all` runs ATF suites on the instance (main only)

### Local Commands
```bash
pnpm run ci                              # full validate + build
pnpm run build:apps                      # build all Fluent apps
node scripts/deploy.js --auth dev        # deploy all apps
node scripts/deploy.js --app my-app      # deploy a single app
node scripts/deploy.js --dry-run         # preview without deploying
node scripts/run-tests.js --all          # run every app's ATF suite
node scripts/run-tests.js --app my-app   # run one app's suite
node scripts/run-tests.js --suite name   # run a specific suite by name
```

### GitHub Secrets Required
`SN_INSTANCE`, `SN_USER`, `SN_PASSWORD`

## ATF Testing

When generating a feature with AI assistance, **pair it with an ATF test**. The plumbing:

- **Authoring** — generate `apps/<app>/src/fluent/tests/<test-id>.now.ts` from `templates/fluent/artifacts/atf-test.now.ts` using `Test()` from `@servicenow/sdk/core`. Step namespaces: `atf.server.*`, `atf.form.*`, `atf.rest.*` (see `servicenow-sdk-examples/test-atf-sample/`). **Tests must live under `src/fluent/`** — the SDK only scans `src/fluent/**/*.now.ts`; files under `src/tests/` are silently skipped.
- **Grouping** — one suite per app, named `<scope>-suite` (e.g. `x_inchelper-suite`). Scaffold once from `templates/fluent/artifacts/atf-test-suite.now.ts`. Each test joins via a `sys_atf_test_suite_test` Record block.
- **Execution** — `scripts/run-tests.js` calls `POST /api/sn_cicd/testsuite/run`, polls `/api/sn_cicd/progress/{id}` until done, then fetches `/api/sn_cicd/testsuite/results/{id}`. Exits non-zero on any failure.
- **CI** — runs after `deploy` on push to `main`.
- **Role requirement** — the deploy user needs `sn_cicd.sys_ci_automation` or admin. Without it the test API returns 403.

## Keeping Things Current

```bash
# Update submodules to latest upstream (SDK, examples, docs)
git submodule update --remote --merge

# Update npm dependencies
pnpm update --recursive

# Re-export instance config snapshot
node instance-config/scripts/export-instance.js
```

## Known Limitations

- **Branch management from external tools is limited** for SDK projects. For complex branching workflows, use Source Control inside ServiceNow Studio or manage branches via GitHub directly.
- **Production deploy not supported by the SDK.** `now-sdk install` is for non-prod only. Production deploys require the Application Repository (publish → approve → deploy) or update sets (legacy). We've chosen Application Repository.
- **sys_plugins table not readable** without admin role — instance-config skips it. Grant admin to the export user if plugin metadata is needed.

## Conventions

- Node.js 20+, pnpm 10+
- TypeScript 5.8.x
- `@servicenow/sdk` 4.6.0+, `@servicenow/glide` 27.0.5
- Apps live in `apps/`, each created via `now-sdk init` (not custom templates)
- No update sets — Application Repository only
- Git branch strategy: `main` deployable, feature branches for development
- App scopes must be **vendor-prefixed** (`x_<company_code>_<≤9-char suffix>`, ≤19 chars total) — bare scopes like `x_myapp` fail install with `application was null`
- `.now.ts` files only get picked up under `src/fluent/` — `src/tests/` is silently skipped
- `ScheduledScript` has a sharp-edged API: `executionTime` must be `Time(...)` (not a bare object), `executionStart` is required, and `runAs` by username doesn't work. Use `templates/fluent/artifacts/scheduled-script.now.ts` as the canonical starting point — its comments encode the trap
- After any non-trivial build, verify the generated XML in `apps/<app>/dist/app/update/` matches expectations (especially for any field set via SDK helpers like `Time()`, `Duration()`, `Record()` references) — silent serialization quirks have bitten us