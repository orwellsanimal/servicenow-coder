# ServiceNow Coder

An AI-assisted ServiceNow development workspace. Combines the official ServiceNow Fluent SDK, vanilla GlideScript, and instance-specific grounding so AI tools (Claude Code, Gemini CLI, others) generate code that references *real* tables, fields, and configuration on your target instance.

## What's in this repo

- **Fluent SDK app development** — `.now.ts` projects scaffolded via the official `now-sdk init`, living under `apps/`
- **Vanilla GlideScript prototyping** — classic server-side scripts under `scratch/`
- **Instance grounding layer** — `instance-config/` holds schema/plugins/roles/properties exported from your instance so AI tools never hallucinate references
- **CI/CD pipeline** — GitHub Actions (validate → build → pack → deploy → test) with a Harness reference spec for future migration
- **ATF testing plumbing** — templates + runner + CI stage so AI-generated features can ship paired tests
- **Official ServiceNow docs as submodules** — `servicenow-sdk`, `servicenow-sdk-examples`, `servicenow-docs` (australia branch)

## Prerequisites

| Tool | Version | Get it |
|------|---------|--------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 10+ | `npm install -g pnpm` |
| Git | recent | https://git-scm.com |
| ServiceNow instance | any modern release | Free PDI at https://developer.servicenow.com |

Optional but recommended:
- GitHub account (for CI/CD)
- An AI coding tool: [Claude Code](https://claude.ai/code), [Gemini CLI](https://github.com/google/gemini-cli), Cursor, etc.

## Quickstart

```bash
git clone --recursive <your-fork-or-this-repo>.git
cd servicenow-coder
node scripts/setup.js          # interactive walkthrough — handles everything below
```

The walkthrough validates Node/pnpm versions, initializes submodules, runs `pnpm install`, prompts for instance credentials, registers the SDK auth alias, optionally harvests instance config for AI grounding, and runs a verify step. Idempotent — safe to re-run anytime.

For non-interactive automation (CI, AI agents): `node scripts/setup.js -y` with `SN_INSTANCE`, `SN_USER`, `SN_PASSWORD` in the environment.

For the manual step-by-step (and what each step does), see **[SETUP.md](./SETUP.md)**.

## Common commands

```bash
pnpm run build:apps                       # build all Fluent apps
node scripts/deploy.js --auth dev         # deploy all apps to your dev instance
node scripts/deploy.js --app my-app       # deploy a single app
node scripts/run-tests.js --all           # run all app ATF suites
pnpm run test:atf                         # same as above
node instance-config/scripts/export-instance.js   # refresh grounding data
```

## Project structure

```
apps/                  # Fluent SDK apps (one folder per app, created via now-sdk init)
docs/                  # PRDs, GDDs, architecture notes
scratch/               # Vanilla GlideScript prototyping
instance-config/       # Instance metadata for grounding (tables, plugins, roles, ...)
templates/             # Per-artifact code templates (Fluent + GlideScript)
scripts/               # Build, deploy, test runners
servicenow-sdk/        # Official SDK (submodule)
servicenow-sdk-examples/   # Official SDK samples (submodule)
servicenow-docs/       # Official platform docs (submodule, australia branch)
.github/workflows/     # CI pipeline
.harness/              # Harness pipeline reference spec (future)
.claude/               # Claude Code skills + settings
```

## AI tool support

This workspace is tool-agnostic. Tool-specific guidance:

- **Claude Code** — see [`CLAUDE.md`](./CLAUDE.md). Uses slash commands + skills. Install the official Fluent plugin: `/plugin marketplace add servicenow/sdk && /plugin install fluent`.
- **Gemini CLI** — see [`GEMINI.md`](./GEMINI.md). Uses `@`-mention context tags.
- **Others** (Cursor, Cody, Continue) — point them at `CLAUDE.md` or `GEMINI.md` as a starting context. The instance-config grounding works regardless of tool.

## What to read next

- **[SETUP.md](./SETUP.md)** — full setup walkthrough
- **[CLAUDE.md](./CLAUDE.md)** / **[GEMINI.md](./GEMINI.md)** — tool-specific guidance, conventions, CI/CD details
- **[instance-config/README.md](./instance-config/README.md)** — the grounding layer
- **[servicenow-sdk-examples/](./servicenow-sdk-examples/)** — official patterns for tables, REST APIs, UI pages, ATF, etc.

## License & status

Single-developer reference implementation. Designed to be replicable in customer environments with their own AI tool stacks. PRs and issues welcome.
