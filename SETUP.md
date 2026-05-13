# Setup

Step-by-step guide to take this workspace from a fresh `git clone` to a working dev loop where you can scaffold a feature, deploy it, and run an ATF test against your instance.

Tool-agnostic. Claude Code, Gemini CLI, Cursor, and others all work — the AI-tool-specific bits are in [CLAUDE.md](./CLAUDE.md) and [GEMINI.md](./GEMINI.md).

---

## Fast path: `scripts/setup.js`

After cloning, run the interactive walkthrough — it automates steps 2 through 8 below:

```bash
node scripts/setup.js          # interactive
node scripts/setup.js -y       # non-interactive (uses SN_* env vars)
node scripts/setup.js --help
```

The script is idempotent — re-run anytime to fill in missing pieces. It has zero npm dependencies (pure Node built-ins) so it works on a fresh clone before `pnpm install` ever runs.

The rest of this doc explains each step so you can do it manually or troubleshoot what the script did.

---

## 1. Prerequisites

Install these on your machine. Versions matter — the SDK is strict.

| Tool | Required | Why | Install |
|------|----------|-----|---------|
| **Node.js** | 20+ | SDK runtime, build, deploy scripts | https://nodejs.org or your package manager |
| **pnpm** | 10+ | Workspace package manager | `npm install -g pnpm` |
| **Git** | recent | Version control, submodules | https://git-scm.com |
| **ServiceNow instance** | any modern release | Deploy target | See step 3 |
| **Python** | 3.10+ (optional) | PySNC utilities under `scripts/python/` | https://python.org — skip if you don't need data seeding / bulk ops |

Verify:
```bash
node --version    # v20.x or higher
pnpm --version    # 10.x or higher
git --version
python --version  # 3.10+ (optional)
```

Optional:
- **GitHub account** for CI/CD (free works fine)
- **AI coding tool** of choice (Claude Code, Gemini CLI, Cursor, Continue, Cody, ...)

---

## 2. Clone the repo

The repo uses git submodules for the official ServiceNow docs, SDK, and examples. **Clone recursively** or you'll miss them.

```bash
git clone --recursive <your-fork-or-upstream>.git
cd servicenow-coder
```

If you already cloned without `--recursive`:
```bash
git submodule update --init --recursive
```

To keep submodules current later:
```bash
git submodule update --remote --merge
```

---

## 3. Get a ServiceNow instance

You need an instance you can deploy to. Cheapest path:

1. Sign up for a free **Personal Developer Instance (PDI)** at https://developer.servicenow.com
2. Activate it and note:
   - Instance URL (e.g. `https://dev123456.service-now.com`)
   - Admin username (usually `admin`, or whatever you set)
   - Admin password (from the activation email or your profile)

**PDI gotcha:** PDIs hibernate after ~10 days of inactivity. Wake them from the Developer Site before each work session. If a CI run fails with connection errors, that's usually why.

Already have a corporate dev instance? Use that. Just make sure your user has the roles you need (admin is easiest; minimums are below).

### Recommended roles for the deploy user

| Role | Why |
|------|-----|
| `admin` | Easiest. Covers everything below. |
| `sn_cicd.sys_ci_automation` | ATF test execution via REST API (covered by admin) |
| Read access to `sys_*` tables you want to grounding-export | `instance-config` harvest (covered by admin) |

---

## 4. Install workspace dependencies

```bash
pnpm install
```

This installs:
- Root devDependencies (TypeScript, eslint, prettier)
- Each app's dependencies under `apps/*` (when apps exist)
- The official ServiceNow SDK examples (under `servicenow-sdk-examples/`)

The SDK itself (`@servicenow/sdk`) is invoked via `npx` and doesn't need to be installed globally, though you can if you want:
```bash
npm install -g @servicenow/sdk
```

---

## 5. Configure credentials

The repo never commits credentials. Two storage layers:

### a) `.env` file (for scripts and CI)

```bash
cp .env.example .env
```

Edit `.env`:
```
SN_INSTANCE=https://dev123456.service-now.com
SN_USER=admin
SN_PASSWORD=your-password
```

Consumed by:
- `scripts/deploy.js`
- `scripts/run-tests.js`
- `instance-config/scripts/export-instance.js`

### b) SDK auth alias (for `now-sdk` commands)

The SDK stores credentials in your OS credential manager (Windows Credential Manager, macOS Keychain, libsecret on Linux). One-time setup:

```bash
npx @servicenow/sdk auth --add "$SN_INSTANCE" --type basic --alias dev
```

You'll be prompted for username and password. The `dev` alias is referenced throughout the deploy script and CI workflow — keep that name unless you have a reason to change it.

Verify:
```bash
npx @servicenow/sdk auth --list
# should show: *[dev] https://dev123456.service-now.com
```

---

## 6. Harvest your instance config (grounding)

This is the magic that makes AI-generated code actually work on *your* instance. It exports schema, plugins, roles, properties, and more into `instance-config/` as JSON. AI tools read these files before generating code so they don't reference tables or fields that don't exist on your instance.

```bash
# .env loaded automatically if your shell sources it; otherwise export the vars first
node instance-config/scripts/export-instance.js
```

This populates:
- `instance-config/schema/` — tables, columns, choices, relationships
- `instance-config/platform/` — plugins, system properties, scopes
- `instance-config/security/` — roles, ACL patterns
- `instance-config/services/` — REST APIs

Re-run anytime your instance changes (new plugin activated, scope created, etc.).

**Selective export:**
```bash
node instance-config/scripts/export-instance.js --only schema,platform
```

See [`instance-config/README.md`](./instance-config/README.md) for the full table of what gets exported.

---

## 7. Wire up your AI tool

The workspace is tool-agnostic but each tool needs a one-time hookup.

### Claude Code

1. Install the official ServiceNow Fluent plugin (one-time per machine):
   ```
   /plugin marketplace add servicenow/sdk
   /plugin install fluent
   /reload-plugins
   ```
2. Project-local skills in `.claude/skills/` load automatically.
3. Read [`CLAUDE.md`](./CLAUDE.md) for slash commands and conventions.

### Gemini CLI

1. Read [`GEMINI.md`](./GEMINI.md) for `@`-mention context tags and project conventions.
2. The instance-config grounding works automatically when Gemini reads files in `instance-config/`.

### Other tools (Cursor, Cody, Continue)

Point the tool at `CLAUDE.md` or `GEMINI.md` as initial context. The grounding layer is plain JSON and works with any tool that can read files.

---

## 8. Verify the install

Run a smoke test of the full local toolchain:

```bash
pnpm run ci      # validates lint + type-check + builds all apps
```

If `apps/` is empty (clean clone), this exits cleanly — there's nothing to build yet. Create your first app:

```bash
cd apps
npx @servicenow/sdk init \
    --appName "Hello World" \
    --packageName hello-world \
    --scopeName x_hello \
    --template base \
    --auth dev
cd ..
pnpm install                            # picks up the new app
node scripts/deploy.js --app hello-world --auth dev
```

If that all works, you're set.

---

## 9. CI/CD bootstrap (optional but recommended)

The repo ships with a GitHub Actions pipeline at `.github/workflows/ci.yml`:

1. **Validate** — lint, type-check
2. **Build** — `now-sdk build` all apps
3. **Pack** — `now-sdk pack` artifacts (main only)
4. **Deploy** — `now-sdk install` to dev instance (main only)
5. **Test** — `scripts/run-tests.js --all` runs ATF suites (main only)

### Required GitHub Secrets

In your repo settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `SN_INSTANCE` | Your instance URL (e.g. `https://dev123456.service-now.com`) |
| `SN_USER` | Deploy user (typically `admin` on a PDI) |
| `SN_PASSWORD` | Deploy user password |

### GitHub Environment

The deploy and test jobs use a GitHub Environment named `dev` (for protection rules / scoped secrets). Create it: Settings → Environments → New environment → name it `dev`. Add the three secrets above to the environment (or to the repo — environment takes precedence).

### First CI run

Push to `main`. The pipeline runs validate → build → pack → deploy → test. If deploy or test fails with HTTP 401 or 403, check your secrets and the deploy user's roles (step 3).

---

## 10. Python venv for PySNC (optional)

Skip this step if you only need Fluent SDK + GlideScript. PySNC is for cross-cutting Python utilities — data seeding, bulk fixes, cross-instance migrations, ATF fixture setup.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

`.venv/` is gitignored. PySNC scripts read the same `.env` at the repo root used by Node scripts — no separate credentials.

Verify:
```bash
python -c "import pysnc; print(pysnc.__version__)"
python scripts/python/seed-data.py --dry-run
```

See [`docs/guides/pysnc.md`](./docs/guides/pysnc.md) for when to use PySNC and common patterns.

---

## 11. ATF testing (paired with feature development)

When you generate a feature with AI assistance, pair it with an ATF test:

- Tests live at `apps/<app>/src/fluent/tests/<test-id>.now.ts` (SDK only scans `src/fluent/`)
- Each app has a suite named `<scope>-suite` (e.g. `x_hello-suite`)
- Templates: `templates/fluent/artifacts/atf-test.now.ts` and `atf-test-suite.now.ts`
- Run locally: `node scripts/run-tests.js --app my-app`
- Runs in CI automatically after deploy on push to `main`

The Claude Code skill `/now-scaffold atf-test <name>` and `/now-scaffold atf-test-suite <name>` use the templates above. For other tools, copy the template manually.

---

## Troubleshooting

Quick reference table for the most common issues. For the full list, see [`docs/guides/troubleshooting.md`](./docs/guides/troubleshooting.md).

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `now-sdk install` returns 401 / 403 | Wrong credentials or roles | Re-run `now-sdk auth --add ... --alias dev`. User needs admin. |
| `now-sdk` connection errors on a PDI | Instance hibernated | Wake at developer.servicenow.com |
| ATF test API returns 403 | Missing `sn_cicd.sys_ci_automation` | Grant the role or use admin |
| `servicenow-docs` shows modified on Windows | Upstream case collision | Cosmetic — ignore |
| LF/CRLF warnings | Git autocrlf | Cosmetic — `git config core.autocrlf input` if it bothers you |

---

## What's next

- **Scaffold your first app** — see step 8 or run `/now-scaffold project <name>` in Claude Code
- **Read [CLAUDE.md](./CLAUDE.md) or [GEMINI.md](./GEMINI.md)** for conventions, slash commands, and AI prompting patterns
- **Browse [`servicenow-sdk-examples/`](./servicenow-sdk-examples/)** for patterns (tables, REST APIs, UI pages, ATF, etc.)
- **Re-export instance config** whenever your instance changes
