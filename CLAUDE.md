# ServiceNow Coder Workspace

## Project Structure

- **apps/** — Fluent SDK application projects (each subfolder is a deployable app, created via `now-sdk init`)
- **docs/** — PRDs/GDDs and feature specs for AI-grounded development
- **scratch/** — Ad-hoc development for vanilla GlideScript and experiments
- **instance-config/** — Instance-specific metadata (tables, fields, plugins, scopes) for grounding code generation
- **templates/** — Per-artifact templates (the SDK doesn't ship these; project-level `now-sdk init` handles full app scaffolding)
- **scripts/** — Build and deployment scripts
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

## Skills (Slash Commands)

The official ServiceNow Fluent plugin provides core SDK skills under the `/fluent:` namespace:

| Command | Source | When to Use |
|---------|--------|-------------|
| `/fluent:now-sdk-explain [topic]` | Official plugin (auto-updates) | Fluent SDK docs — API types, conventions, project structure. Always peek first. |
| `/fluent:now-sdk-setup` | Official plugin (auto-updates) | Environment errors (Node version, SDK not found). |
| `/now-instance-config [table-or-topic]` | Project-local | Verify instance metadata (tables, fields, choices, plugins, roles) before generating code. |
| `/now-scaffold <type> <name>` | Project-local | Create new app (via `now-sdk init`) or generate artifact code from local templates. |

### Plugin Installation (one-time)

```
/plugin marketplace add servicenow/sdk
/plugin install fluent
/reload-plugins
```

Project-local skills in `.claude/skills/` load automatically in this workspace.

## Project Initialization Paths

When starting a new app, choose one:

1. **Local SDK init** (preferred for code-first work):
   ```bash
   cd apps/
   npx @servicenow/sdk init --appName "My App" --packageName my-app --scopeName x_myapp --template base --auth dev
   ```
2. **ServiceNow Build Agent** (in-platform AI scaffolder): generate from a natural-language prompt in the instance, then pull to `apps/` for iteration. Free allowance: ~100 calls (customer) / ~25 calls (PDI).
3. **`/now-scaffold project`** — wraps the SDK init for convenience.

## Instance Configuration (Grounding Layer)

`instance-config/` provides snapshot metadata from the dev instance for grounding:

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
SN_INSTANCE=https://dev392282.service-now.com SN_USER=Jody.Whitlow SN_PASSWORD=… \
  node instance-config/scripts/export-instance.js
```

## Documentation Sources

- **SDK API docs:** `/fluent:now-sdk-explain` or `npx @servicenow/sdk explain <topic> --format=raw`
- **Platform docs:** `servicenow-docs/markdown/` (branch: australia for latest)
  - API reference: `servicenow-docs/markdown/api-reference/index.md`
  - App development: `servicenow-docs/markdown/application-development/index.md`
- **Do NOT fetch from servicenow.com/docs** — it's a JS SPA, returns no useful content to LLMs

## CI/CD Pipeline

### Strategy
- **No update sets.** Application Repository model via the SDK.
- **Single dev instance** for now. Pipeline stages map 1:1 to multi-instance Harness later.
- Git is the source of truth. SDK build → XML metadata → `install` → instance.

### Stages (GitHub Actions → future Harness)
1. **Validate** — lint, type-check
2. **Build** — `now-sdk build` all apps
3. **Pack** — `now-sdk pack` artifacts (main only)
4. **Deploy** — `now-sdk install` to dev instance (main only)

### Local Commands
```bash
pnpm run ci                              # full validate + build
pnpm run build:apps                      # build all Fluent apps
node scripts/deploy.js --auth dev        # deploy all apps
node scripts/deploy.js --app my-app      # deploy a single app
node scripts/deploy.js --dry-run         # preview without deploying
```

### GitHub Secrets Required
- `SN_INSTANCE`, `SN_USER`, `SN_PASSWORD`

## Cross-Tool Docs

`CLAUDE.md` and `GEMINI.md` are intentionally **independent** files — each tool may need its own tool-specific guidance (skills, slash commands, plugin install steps). When updating shared content (project structure, conventions, CI/CD), copy the relevant changes between the two files manually.

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
- **`sys_plugins` table not readable** without admin role — instance-config skips it. Grant admin to the export user if plugin metadata is needed.

## Conventions

- Node.js 20+, pnpm 10+
- TypeScript 5.8.x
- `@servicenow/sdk` 4.6.0+, `@servicenow/glide` 27.0.5
- Apps live in `apps/`, each created via `now-sdk init` (not custom templates)
- No update sets — Application Repository only
- Git branch strategy: `main` deployable, feature branches for development
