# PRD: {{App / Feature Name}}

**Status:** Draft | Approved | In Development | Shipped
**Owner:** {{Name}}
**Last Updated:** YYYY-MM-DD

## Summary

One-paragraph description of what this is and why it exists. Written for someone who has zero context.

## Problem

What problem are we solving? Who has it? How do they handle it today?

## Goals & Non-Goals

**Goals**
- ...

**Non-Goals (out of scope)**
- ...

## Users & Personas

Who uses this? What roles do they have? What permissions do they need?

## User Stories

- As a `<role>`, I want to `<action>` so that `<outcome>`.
- ...

## Data Model

Tables, fields, relationships. Reference existing ServiceNow tables where possible (check `instance-config/schema/tables.json`).

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `x_scope_thing` | ... | name, status, owner |

## Workflows / Business Logic

- Triggers (Business Rules, Flows, Script Actions)
- State transitions
- Notifications
- Integrations

## UI / Forms

What does the user see? Forms, lists, dashboards, catalog items?

## Access Control

Which roles can do what? Reference existing roles in `instance-config/security/roles.json` before inventing new ones.

| Role | Read | Write | Create | Delete |
|------|------|-------|--------|--------|
| `x_scope.user` | ✓ | own only | ✓ | — |
| `x_scope.admin` | ✓ | ✓ | ✓ | ✓ |

## Integrations

External systems? REST APIs called? Inbound integrations? Connection aliases (`instance-config/services/integrations.json`)?

## Open Questions

- ...

## References

- ServiceNow docs: `servicenow-docs/markdown/...`
- Related apps: `apps/...`
- Related PRDs: `docs/apps/...` or `docs/features/...`
