# Project Documentation

Written specifications for AI-assisted development. PRDs/GDDs here provide grounding for code generation beyond what's in CLAUDE.md or instance-config.

## Purpose

When asking an AI to build something non-trivial, a clear written specification dramatically improves output. This folder is for those specs.

## Structure

- `templates/` — reusable templates for product/feature documentation
- `apps/<app-name>.md` — per-app PRDs (one file per Fluent app)
- `features/<feature-name>.md` — feature-level specs that span multiple apps

## Workflow

1. Draft a PRD before scaffolding a new app (use `templates/prd.md`)
2. Reference the PRD in your prompt: *"build the app described in docs/apps/my-app.md"*
3. Update the PRD as the design evolves — it's the durable spec
