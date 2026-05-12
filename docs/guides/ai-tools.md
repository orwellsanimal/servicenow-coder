# AI Tools Guide

How to use this workspace with different AI coding assistants. The repo is tool-agnostic — the grounding layer (`instance-config/`), templates, SDK docs submodule, and conventions all work regardless of tool.

## Compatibility matrix

| Tool | Setup file | Plugin/extension | Notes |
|------|-----------|-------------------|-------|
| **Claude Code** | [`CLAUDE.md`](../../CLAUDE.md) | Official `servicenow/sdk` plugin from marketplace | Native slash command + skill model. Best support. |
| **Gemini CLI** | [`GEMINI.md`](../../GEMINI.md) | none | Uses `@`-mention context tags. |
| **Cursor** | [`CLAUDE.md`](../../CLAUDE.md) | none | Treats `CLAUDE.md` as the system context. No slash commands. |
| **Cody (Sourcegraph)** | [`CLAUDE.md`](../../CLAUDE.md) | none | Same pattern as Cursor. |
| **Continue** | [`CLAUDE.md`](../../CLAUDE.md) | none | Same pattern. Point at `CLAUDE.md` in config. |
| **GitHub Copilot Chat** | [`CLAUDE.md`](../../CLAUDE.md) | none | Reference `CLAUDE.md` in prompts manually. |

For any tool not listed: point it at `CLAUDE.md` or `GEMINI.md` as initial context. The instance-config grounding files are plain JSON and readable by any LLM-based assistant.

## Claude Code

The richest integration. Uses slash commands + skills.

### One-time install

```
/plugin marketplace add servicenow/sdk
/plugin install fluent
/reload-plugins
```

This installs the official ServiceNow Fluent plugin. Project-local skills in `.claude/skills/` (`now-instance-config`, `now-scaffold`) load automatically when you open this workspace.

### Slash commands available

| Command | What it does |
|---------|--------------|
| `/now-scaffold <type> <name>` | Create a new app (delegates to `now-sdk init`) or generate an artifact from a local template |
| `/now-instance-config <table-or-topic>` | Verify metadata against `instance-config/` before generating code |
| `/fluent:now-sdk-explain <topic>` | Fetch SDK API documentation (official plugin) |
| `/fluent:now-sdk-setup` | Diagnose SDK environment issues (official plugin) |

### Prompting patterns that work

- **Reference docs explicitly:** *"using docs/apps/incident-map.md as the spec, build the table and business rule"*
- **Cite the grounding layer:** *"verify the table x_incmap_location exists in instance-config/schema/tables.json before referencing it"*
- **Pair tests with features:** *"after scaffolding the table, generate an ATF test under apps/incident-map/src/tests/"*
- **Use the official path:** *"use now-sdk init, don't reinvent the scaffolding"*

### What CLAUDE.md gives Claude Code

- Project structure overview (so it knows where to put files)
- Skill index (when to use which command)
- Conventions (file naming, scope prefixes, branch strategy)
- Known limitations (where the SDK is weak — branching, prod deploy)

## Gemini CLI

Gemini CLI doesn't have plugins or skills. It reads files referenced via `@`-mention or via its system context.

### Hookup

1. Point Gemini at `GEMINI.md` at the start of a session
2. Reference grounding files as needed: `@instance-config/schema/tables.json`
3. Reference the spec for a feature: `@docs/apps/my-app.md`
4. Reference SDK docs: `@servicenow-docs/markdown/application-development/`

### Prompting patterns

- *"@GEMINI.md @SETUP.md — set up this workspace following these conventions"*
- *"@instance-config/schema/tables.json verify the table exists, then generate the business rule"*
- *"@servicenow-sdk-examples/test-atf-sample/ pattern an ATF test for ..."*

### What GEMINI.md gives Gemini CLI

Same content as CLAUDE.md, minus the slash-command-specific sections. Tool-specific guidance lives there.

## Cursor, Cody, Continue (and similar "CLAUDE.md as system context" tools)

Treat `CLAUDE.md` as the system prompt. Most of these tools have a config option to designate a file as project context.

- **Cursor:** Add `CLAUDE.md` to `.cursor/rules/` or reference it in `.cursorrules`
- **Cody:** Add `CLAUDE.md` to the project context list in settings
- **Continue:** Reference `CLAUDE.md` in `~/.continue/config.json` under `customCommands` or `systemMessage`

The slash commands won't work (they're Claude Code–specific) but the conventions, grounding patterns, and structural guidance all carry over.

## Custom AI tools and agents

Building your own agent on top of this workspace? Point it at:

1. **`CLAUDE.md`** — conventions and project structure
2. **`instance-config/`** — current state of the target instance (the grounding layer)
3. **`templates/`** — the patterns to follow when generating new artifacts
4. **`servicenow-sdk/skills/`** — official SDK guidance bundled by ServiceNow
5. **`servicenow-docs/markdown/`** — platform docs in raw markdown form
6. **`docs/apps/<app-name>.md`** and **`docs/features/<feature-name>.md`** — PRDs for what to build

The MEMORY pattern Claude Code uses (`.claude/projects/...`) isn't strictly required for other tools, but the same idea applies: persist what you learn across sessions about the user, their preferences, and the project state.

## Prompting patterns that work across tools

Regardless of tool, these patterns improve output:

### Ground before you generate

> *"Before writing code, verify the table `incident` is in `instance-config/schema/tables.json` and that the field `caller_id` is in `instance-config/schema/columns.json`."*

The LLM will read those files and adjust if reality differs from its training assumptions.

### Use the official path

> *"Use `now-sdk init` to scaffold a new app, don't manually create the project structure."*

This avoids reinventing scaffolders that the SDK already provides.

### Pair tests with features

> *"After scaffolding the business rule, generate an ATF test that exercises it, place it under `apps/<app>/src/tests/`, and add it to the app's suite."*

Encodes the ATF testing convention from the start.

### Cite a written spec

> *"Build the app described in `docs/apps/incident-map.md`. Follow it exactly — if anything is ambiguous, ask before generating."*

Written specs are more durable than chat context and survive across sessions.

### Show your sources

For Q&A tasks, ask the LLM to cite files:

> *"Answer using only what's in `servicenow-docs/markdown/api-reference/`. Quote the file path and section for each claim."*

## What NOT to ask AI to do

Some things in this workspace are not LLM-friendly and you should do them manually or with a different tool:

| Task | Why not |
|------|---------|
| `now-sdk auth --add` | Interactive credential entry — let the SDK CLI prompt you |
| Git push to main | Final review should be human |
| Modifying production data | No prod target exists yet, but as a principle |
| Granting roles in the instance | UI-driven, easier to do manually |
| Branch management for SDK projects | SDK source-control story is limited; use Studio or GitHub directly |
| Production deploy | SDK doesn't support it (Application Repository publish/approve required) |

## When tools disagree

If the SDK docs, the platform docs, and your AI tool say different things:

1. **Trust the SDK** — `npx @servicenow/sdk explain <topic> --format=raw` is authoritative for SDK API
2. **Trust the platform docs** — `servicenow-docs/markdown/` for platform behavior
3. **Trust the instance-config** — for what actually exists on the target instance
4. **Trust the running instance** — if all else fails, query the table API directly

LLM training data can be stale or wrong. The four sources above are not.

## See also

- [CLAUDE.md](../../CLAUDE.md) — Claude Code conventions
- [GEMINI.md](../../GEMINI.md) — Gemini CLI conventions
- [SETUP.md](../../SETUP.md) — initial setup
- [instance-config/README.md](../../instance-config/README.md) — the grounding layer
