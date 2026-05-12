# ServiceNow Coder Workspace

## Project Structure

- **servicenow-sdk/** — ServiceNow SDK repo with AI skills for Claude Code and Cursor (Fluent TypeScript DSL)
- **servicenow-sdk-examples/** — Official SDK sample projects (pnpm workspace, each `*-sample/` is a standalone Fluent app)
- **servicenow-docs/** — ServiceNow product documentation in markdown (branch per release family; "australia" is latest)
- **scratch/** — Ad-hoc development space for vanilla GlideScript and experiments
- **instance-config/** — Instance-specific metadata (schema, plugins, scopes, etc.) for grounding code generation
- **templates/** — Scaffolding templates for both Fluent SDK and vanilla GlideScript artifacts
- **apps/** — Fluent SDK application projects (each subfolder is a deployable app)
- **scripts/** — Build and deployment scripts
- **.github/workflows/** — GitHub Actions CI pipeline (active)
- **.harness/** — Harness pipeline reference spec (future, inactive)

## Development Modes

### 1. Fluent (TypeScript SDK)
- Files use `.now.ts` extension
- Uses `@servicenow/sdk` CLI: `now-sdk build`, `now-sdk deploy`, `now-sdk explain`
- SDK docs: `npx @servicenow/sdk explain <topic> --format=raw`
- Projects have `now.config.json` at root
- Types from `@servicenow/sdk/core` (Table, BusinessRule, etc.)

### 2. Vanilla GlideScript
- Traditional ServiceNow server-side scripting (Business Rules, Script Includes, etc.)
- Type definitions from `@servicenow/glide` package
- Use `scratch/` folder for development and prototyping

## Key Commands

```bash
# SDK explain (always peek first)
npx @servicenow/sdk explain --list --format=raw
npx @servicenow/sdk explain <topic> --peek --format=raw
npx @servicenow/sdk explain <topic> --format=raw

# Build examples
pnpm --filter ./servicenow-sdk-examples run build

# Type-check scratch
pnpm --filter scratch run check
```

## Instance Configuration (Grounding Layer)

The `instance-config/` folder provides instance-specific metadata for grounding code generation:

- **schema/** — tables, columns, choices, relationships (from sys_db_object, sys_dictionary, sys_choice)
- **platform/** — activated plugins, system properties, application scopes
- **security/** — roles, ACL policies
- **services/** — scripted REST APIs, integration endpoints
- **schemas/** — JSON Schema validation for all config files

When generating code that references ServiceNow tables, fields, or choices, check `instance-config/schema/` first to confirm they exist on the target instance. When checking what plugins or features are available, check `instance-config/platform/plugins.json`.

Export from a live instance:
```bash
SN_INSTANCE=https://your-instance.service-now.com SN_USER=admin SN_PASSWORD=pass node instance-config/scripts/export-instance.js
```

## Documentation

- Do NOT fetch from servicenow.com/docs (SPA, returns nothing useful)
- Use `servicenow-docs/markdown/` files instead (branch: australia for latest)
- API reference: `servicenow-docs/markdown/api-reference/index.md`
- App development: `servicenow-docs/markdown/application-development/index.md`

## Skills (Slash Commands)

Three project-level skills are available in `.claude/skills/`:

| Command | When to Use |
|---------|-------------|
| `/now-sdk-explain [topic]` | Anytime you need Fluent SDK docs — API types, metadata conventions, project structure. Always peek first. |
| `/now-sdk-setup` | If `now-sdk explain` fails with environment errors (wrong Node version, SDK not found). |
| `/now-instance-config [table-or-topic]` | Before generating code that references instance-specific metadata (tables, fields, choices, plugins, roles). |
| `/now-scaffold <type> <name>` | Scaffold a new Fluent app or generate artifact code from templates. Supports: project, table, business-rule, script-include, client-script, rest-api, acl, flow, ui-action, script-action, catalog-item, and gs-* variants for GlideScript. |

## CI/CD Pipeline

### Strategy
- **No update sets.** All apps use Application Repository model via the SDK.
- **Single dev instance** for now. Pipeline stages are structured to map to multi-instance (dev/test/prod) when moving to Harness.
- Git is the source of truth. The SDK `build` compiles Fluent code to XML metadata, `install` deploys to the instance, `transform` syncs instance changes back.

### Pipeline Stages (GitHub Actions → future Harness)
1. **Validate** — lint, type-check, format check
2. **Build** — `now-sdk build` all apps, verify XML output
3. **Pack** — `now-sdk pack` into installable artifacts (main branch only)
4. **Deploy** — `now-sdk install` to dev instance (main branch only)

### Key Commands
```bash
# Full CI locally
pnpm run ci

# Build all apps
pnpm run build:apps

# Deploy all apps to instance (requires auth configured)
node scripts/deploy.js --auth dev

# Deploy a single app
node scripts/deploy.js --app my-app --auth dev

# Dry run (no actual deploy)
node scripts/deploy.js --dry-run

# Configure SDK auth
npx @servicenow/sdk auth --add https://your-instance.service-now.com --type basic --alias dev
```

### GitHub Secrets Required
- `SN_INSTANCE` — Instance URL
- `SN_USER` — Username
- `SN_PASSWORD` — Password

## Conventions

- Node.js 20+, pnpm 10+
- TypeScript 5.8.x
- @servicenow/sdk 4.6.0+ (required for explain command)
- @servicenow/glide 27.0.5 for GlideScript types
- Apps live in `apps/`, each with its own `now.config.json` and `package.json`
- No update sets — Application Repository model only
- Git branch strategy: `main` is deployable, feature branches for development
