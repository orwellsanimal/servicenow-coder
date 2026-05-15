# Agentic SDLC for ServiceNow

> Git is the source of truth. The AI agent is a participant, not a tool.
> Every change is grounded, scoped, tested, and reversible.

---

## The one-line

> **Ground → Generate → Build → Deploy → Verify** — with AI participating at every stage and Git as the only state of record.

---

## Five stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   GROUND    │───▶│  GENERATE   │───▶│    BUILD    │───▶│   DEPLOY    │───▶│   VERIFY    │
│             │    │             │    │             │    │             │    │             │
│ instance-   │    │  Fluent     │    │  now-sdk    │    │  now-sdk    │    │   ATF +     │
│ config/     │    │  .now.ts    │    │   build     │    │  install    │    │   PySNC     │
│  +  docs    │    │   files     │    │             │    │             │    │ assertions  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                                                                            │
       │                                                                            │
       └────────────────────────────────────────────────────────────────────────────┘
              feedback loop — verify catches drift, ground gets refreshed
```

### 1. Ground — know what exists before you build

- `instance-config/` snapshots the live instance (tables, choices, scopes, plugins, catalog items, model categories, scheduled jobs, user/asset distribution)
- Captured by `node instance-config/scripts/export-instance.js` + `python scripts/python/export-runtime.py`
- Re-run after every plugin activation via `node scripts/sync-instance-config.js` — delta is reported and committed
- **Effect:** the agent generates code that references real GUIDs, real fields, real choice values — no hallucination

### 2. Generate — AI writes scoped apps, never global hacks

- Fluent SDK `.now.ts` files under `apps/<app>/src/fluent/` define every artifact (BR, Script Include, ATF, ACL, scheduled script, etc.)
- Server logic lives in plain TypeScript under `src/server/` and gets compiled to `sys_module` records
- **Scoped-first rule:** if the change can be made in a scoped app, it must be. Global changes get mocked in `scratch/` and documented as a runbook artifact for a human developer
- Scope naming: `x_<vendor_code>_<≤9-char suffix>`, ≤19 chars total — enforced

### 3. Build — deterministic XML from source

- `now-sdk build` produces `dist/app/update/*.xml` per artifact
- Pure function of source — same input always yields same output (modulo sys_id hashing)
- All artifact validation happens here, before anything touches the instance
- TypeScript type-checks against `@servicenow/glide` and `@servicenow/sdk/core`

### 4. Deploy — App Repository, never update sets

- `now-sdk install --auth dev` ships the built XML to the target instance
- Single dev instance today; same path will fan out to multi-instance via Harness later
- Every install creates a rollback context — recovery is one URL away
- **No update sets.** Git history is the only audit trail we maintain

### 5. Verify — automated tests on the platform

- ATF (`@servicenow/sdk/core` Test API) defines test cases as `.now.ts` files
- One suite per app, name `<scope>-suite`, runs via `/api/sn_cicd/testsuite/run`
- PySNC scripts handle pre/post fixtures (seed data, teardown) from outside the platform
- CI exits non-zero on any failed test — gates merges to main

---

## Three principles that make it work

### 1. **Grounded, not guessing**
The agent reads `instance-config/` before generating anything. New plugin? Re-sync first. The grounding layer is the contract between what the agent thinks exists and what actually does.

### 2. **Scoped-first, global as artifact**
Scoped apps go through full CI/CD. Global-scope changes (Business Rules on `incident`, fields on OOTB tables, UI policies on system forms) are written as code in `scratch/` and handed to a human developer with a runbook — the AI doesn't pretend to deploy them.

### 3. **External and internal automation**
Two tool surfaces:
- **Fluent SDK** generates code that runs *on* the platform (BRs, Script Includes, etc.)
- **PySNC** runs *against* the platform from outside (seed data, validation queries, debug scripts, fixture teardown)

Combined, the agent can drive the platform from both sides without either being a hack.

---

## What's distinctive vs. traditional ServiceNow development

| Traditional | This workspace |
|-------------|----------------|
| Update sets shipped between instances | Git → SDK build → Application Repository |
| Manual Studio-based development | AI generates Fluent `.now.ts` from prompts |
| Schema discovery via Studio navigation | `instance-config/` JSON + grounding layer |
| Ad-hoc test execution | ATF suites triggered by CI per push |
| Tribal knowledge of GUIDs and choice values | All captured in `instance-config/` and committed |
| Global-scope changes drift over time | Scoped-first, global tracked as code in `scratch/` |
| Plugin upgrades surprise developers | `sync-instance-config.js` reports the delta |

---

## The agentic loop in practice

```
   user describes intent
           │
           ▼
   agent reads memory + grounding layer ───┐
           │                                │
           ▼                                │
   agent writes Fluent code                 │
           │                                │
           ▼                                │
   build → deploy → ATF                     │
           │                                │
           ▼                                │
   pass: commit + push                      │
   fail: agent diagnoses → adjusts ─────────┘
```

The agent participates as a peer with:
- **Persistent memory** of project conventions, gotchas, and past decisions
- **Tool access** to git, SDK, PySNC, instance APIs, GitHub
- **Grounding** in real instance state, not training data
- **Verification** via running tests, not vibe-checking

---

## Stages that map to CI today (GitHub Actions)

```
on: push to main, or workflow_dispatch
  ├─ validate    — lint, type-check
  ├─ build       — now-sdk build for every app
  ├─ pack        — now-sdk pack (main only)
  ├─ deploy      — now-sdk install --auth dev (main only)
  └─ test        — scripts/run-tests.js --all → ATF suite per app
```

Same pipeline will lift to Harness when multi-instance reality requires it.

---

## TL;DR for the slide

> A grounded, scoped, AI-driven SDLC for ServiceNow.
> The agent reads the instance, writes the code, runs the build, deploys, and verifies — with Git as the only source of truth and human review where it counts.

---

## Diagrams

### Hero diagram — the agentic SDLC loop

```
                    ┌─────────────────────────────────────────────┐
                    │         ServiceNow Instance (dev)            │
                    │   tables · choices · plugins · cases · jobs  │
                    └────────────┬───────────────────────▲────────┘
                                 │                       │
                       ┌─────────▼────────┐    ┌─────────┴────────┐
                       │   PySNC reads    │    │  now-sdk install │
                       │ instance state   │    │  pushes artifacts│
                       └─────────┬────────┘    └─────────▲────────┘
                                 │                       │
                                 ▼                       │
   ┌──────────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐
   │   instance-      │  │   AI Agent    │  │  now-sdk      │  │   GitHub         │
   │   config/        │─▶│   reads,      │─▶│   build       │─▶│   Actions CI     │
   │   (grounding)    │  │   generates,  │  │  → XML        │  │  validate→build  │
   │                  │  │   tests       │  │               │  │  →pack→deploy    │
   └────────▲─────────┘  └───────┬───────┘  └───────┬───────┘  └────────┬─────────┘
            │                    │                  │                    │
            │                    ▼                  ▼                    │
            │            ┌──────────────┐   ┌──────────────┐              │
            │            │  apps/*/     │   │  ATF suites  │              │
            │            │  Fluent .ts  │   │  per app     │              │
            │            └──────┬───────┘   └──────┬───────┘              │
            │                   │                  │                      │
            │                   ▼                  ▼                      │
            │            ┌─────────────────────────────────┐              │
            └────────────┤              Git                 │◀─────────────┘
              re-sync    │   single source of truth         │   push on green
              on plugin  │   feature branches → main        │   ATF run on push
              activation │                                  │
                         └─────────────────────────────────┘
```

### Scope boundary — what's automated vs handed off

```
   ┌──────────────────────────────┐    │    ┌──────────────────────────────┐
   │     SCOPED (automated)        │    │    │     GLOBAL (artifact)         │
   │                               │    │    │                               │
   │  apps/<app>/                  │    │    │  scratch/<feature>/           │
   │   src/fluent/*.now.ts         │    │    │   business-rule.js            │
   │   src/server/*.ts             │    │    │   ui-policy.js                │
   │   src/server/script-includes/ │    │    │   field-definition.md         │
   │                               │    │    │                               │
   │  ─ Fluent SDK builds          │    │    │  ─ Written as code            │
   │  ─ CI deploys + tests         │    │    │  ─ Runbook for human dev      │
   │  ─ Rollback context per       │    │    │  ─ Ordering + dependencies    │
   │    install                    │    │    │    documented                 │
   │  ─ ATF per app                │    │    │  ─ Not auto-deployed          │
   │                               │    │    │                               │
   │   Examples:                   │    │    │   Examples:                   │
   │     Script Includes           │    │    │     BRs on incident table     │
   │     Scheduled Scripts         │    │    │     Custom fields on OOTB     │
   │     Custom tables (x_*)       │    │    │     UI policies on system     │
   │     ATF tests                 │    │    │     forms                     │
   │     Business Rules in scope   │    │    │                               │
   └──────────────────────────────┘    │    └──────────────────────────────┘
              ▲                         │                ▲
              │      ┌──────────────────┴──────────┐      │
              │      │   The agent's contract:     │      │
              └──────┤   if it can be scoped, it   ├──────┘
                     │   MUST be. global only when │
                     │   the platform forces it.   │
                     └─────────────────────────────┘
```

### Plugin → grounding → use case (the discovery flow)

```
   User activates plugin             Agent re-grounds                     Use case unlocked
   ───────────────────              ────────────────                     ────────────────
   ┌─────────────────┐              ┌────────────────────┐              ┌────────────────┐
   │ Customer        │              │ node scripts/      │              │ Build CSM      │
   │ Service Mgmt    │  ─────────▶  │   sync-instance-   │  ─────────▶  │ stale-case-    │
   │ Demo Data       │              │   config.js        │              │ notifier app   │
   └─────────────────┘              │                    │              │ against real   │
                                    │ Δ: +141 tables,    │              │ tables/choices │
                                    │    +98 roles,      │              │                │
                                    │    +5 catalog,     │              │ AI generates   │
                                    │    +23 jobs        │              │ code against   │
                                    │                    │              │ verified GUIDs │
                                    │ git commit -m      │              │ from grounding │
                                    │  "sync: after CSM" │              │ layer          │
                                    └────────────────────┘              └────────────────┘
```
