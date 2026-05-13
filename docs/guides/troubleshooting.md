# Troubleshooting

Common gotchas in this workspace, in rough order of how often they bite. If you hit something not listed, add it here for the next person.

## Connection and auth

### `now-sdk install` returns HTTP 401

Wrong credentials, or the SDK auth alias points at the wrong instance.

```bash
npx @servicenow/sdk auth --list                    # confirm alias and URL
npx @servicenow/sdk auth --remove --alias dev      # nuke and re-register
npx @servicenow/sdk auth --add "$SN_INSTANCE" --type basic --alias dev
```

### `now-sdk install` returns HTTP 403

The deploy user lacks a required role. Easiest fix: grant `admin` to the deploy user. Minimum roles:

| Operation | Role |
|-----------|------|
| `now-sdk install` | `admin` (no minimum — install needs broad write access) |
| ATF test run via REST | `sn_cicd.sys_ci_automation` |
| `instance-config` harvest | `admin` (reads `sys_*` tables) |

### PDI returns connection timeouts or HTML login page

Personal Developer Instances hibernate after ~10 days of inactivity. Wake yours from https://developer.servicenow.com before working. The first request after waking can take 30–60s.

### `sys_plugins` export returns 403

Even some admins hit this. `sys_plugins` requires elevated reads. Either grant `admin` (most cases work after that), or use `--only schema,security,services,platform` to skip plugins:

```bash
node instance-config/scripts/export-instance.js --only schema,security,services,platform
```

## Scaffolding issues

### `now-sdk init` doesn't create a subfolder for the new app

`now-sdk init` writes its scaffold into the **current directory**, not into a folder named after `--packageName`. So running it directly from `apps/` will dump files into `apps/` itself and collide with other apps. Always make the target folder first:

```bash
cd apps && mkdir my-app && cd my-app
npx @servicenow/sdk init --appName "My App" --packageName my-app --scopeName x_<vendor>_<suffix> --template base --auth dev
```

### `now-sdk init` errors with `Invalid scope: must be less than 19 characters`

Scope names are capped at 19 characters total. Since scopes must include the vendor prefix on a PDI (see below), you only have ~9 characters for the suffix after `x_<7-digit-vendor>_`.

### Install fails with `Unable to install application as application was null`

Server-side error from `com.sn_appclient_bootstrap.ScopedAppUploadProcessor`. Almost always means **the scope is not vendor-prefixed**. On a PDI, scopes must start with `x_<your_company_code>_`. Discover the code on the target instance via Scripts - Background:

```javascript
gs.print(gs.getProperty('glide.appcreator.company.code'));
```

Then re-init with `--scopeName x_<code>_<suffix>` (total ≤19 chars). To confirm the diagnosis before re-initing, check `/syslog_list.do` filtered to "appclient" — the Java stack trace from `ScopedAppUploadProcessor.uploadAndInstallApp` will be there.

## Build issues

### `now-sdk: command not found`

Either install globally (`npm install -g @servicenow/sdk`) or use `npx @servicenow/sdk` everywhere. The setup script and CI use `npx`.

### `pnpm: command not found`

Install: `npm install -g pnpm`. Verify `pnpm --version` returns 10+.

### Node version error from the SDK

The SDK is strict. `node --version` must be 20+. Use `nvm` (Linux/macOS) or `nvm-windows` to switch.

### `now-sdk build` fails with `ERR_PNPM_IGNORED_BUILDS`

`now-sdk build` shells out to `pnpm install` internally, and pnpm v10 escalates ignored native-build scripts to errors. The fix is to allowlist them in `pnpm-workspace.yaml` under `onlyBuiltDependencies:`:

```yaml
onlyBuiltDependencies:
  - '@parcel/watcher'
  - '@swc/core'
  - libxmljs2
```

Add any new native-build dep here as soon as you install it.

### `.now.ts` test files build successfully but never deploy

The SDK only scans **`src/fluent/**/*.now.ts`**. Files under `src/tests/`, `src/atf/`, or other top-level src subfolders are silently skipped — build succeeds, `dist/` is missing them. Move them under `src/fluent/`:

```
src/fluent/tests/<test-id>.now.ts          ← correct
src/tests/<test-id>.now.ts                 ← silently skipped
```

### `.now.ts` file fails to build with TS244 or TS277

The Fluent DSL is stricter than TypeScript. These patterns are rejected:

- `export default Test(...)` — must be a bare `Test(...)` statement (TS277).
- Top-level `const FOO = '...'` referenced inside a DSL call, especially in string concatenation like `'sys_id=' + FOO + '^EQ'` (TS244). Inline string literals instead.
- Any module-level statement other than imports and DSL factory calls.

Put logic and constants in `src/server/*.ts` modules and import them as functions. Local `const` inside an arrow callback body (e.g. capturing step output) is allowed.

### `gs` is undefined in a `src/server/*.ts` module

`gs` isn't a built-in global in this typing model. Import it alongside `GlideRecord`:

```typescript
import { gs, GlideRecord } from '@servicenow/glide'
```

### `pnpm install` fails with `ERR_PNPM_OUTDATED_LOCKFILE`

The lockfile and `package.json` are out of sync (usually after a pull). Resolve:

```bash
pnpm install                       # if you're updating intentionally
pnpm install --frozen-lockfile     # if CI: matches what's checked in
```

## Deploy issues

### Scope conflict on first install

If the scope name (e.g. `x_myapp`) was used previously on the instance and not cleaned up, install can fail. Either pick a new scope or delete the prior scope record in `sys_scope` on the instance.

### `now-sdk install` succeeds but the app is missing in Studio

The app installed under a different scope than you expected. Check the scope dropdown in the top-right of the platform UI, or query `sys_scope` for the package name.

### Deploy hangs or times out

The install endpoint streams progress. If it appears stuck, the instance may be processing a large diff. Wait 5–10 minutes before assuming failure. Re-running is safe.

## Test issues

### ATF API returns HTTP 400 "Scheduled test/suite execution is disabled"

ServiceNow disables REST-triggered ATF runs by default. Two system properties must be `true` (and in this order — a business rule rejects setting `schedule` without `runner`):

```javascript
gs.setProperty('sn_atf.runner.enabled', 'true');     // global ATF gate
gs.setProperty('sn_atf.schedule.enabled', 'true');   // REST/scheduled gate
```

Run this once per instance in Scripts - Background, or set them via `/sys_properties_list.do`. Without them, the Test stage of CI fails on every run.

### ATF test API returns 403

The deploy user lacks `sn_cicd.sys_ci_automation`. Either grant the role on the instance (System Security → Users → Roles) or use an admin user.

### `scripts/run-tests.js --suite <name>` says "suite not found"

The suite hasn't been deployed yet, or the name is wrong. Suites are named `<scope>-suite` by convention. Check `sys_atf_test_suite` on the instance for the actual name. **If you renamed the scope** (e.g. to add a vendor prefix), make sure the suite's `Record({ data: { name: '<scope>-suite' } })` was updated too — the runner derives the lookup name from `now.config.json` but the platform record carries the literal name from your source.

### ATF test times out without completing

The runner's polling timeout is 30 min. If your suite legitimately takes longer, raise `POLL_TIMEOUT_MS` in `scripts/run-tests.js`. More likely: a UI test is waiting for a scheduled Client Test Runner that isn't running — see [Headless browser for ATF](https://github.com/ServiceNow/ServiceNowDocs/blob/australia/markdown/application-development/automated-test-framework-atf/atf-headless-browser.md).

## Submodule issues

### `servicenow-docs` always shows as modified on Windows

Upstream has two files differing only in case (`get-IP-from-CI-activity.md` and `get-ip-from-ci-activity.md`). Windows can only materialize one at a time. **Cosmetic** — the parent repo only commits the submodule SHA pointer, not its working tree. Ignore the noise. Do not try to "fix" it.

### After `git clone`, submodules are empty

You forgot `--recursive`. Fix:

```bash
git submodule update --init --recursive
```

### Submodule has unexpected modifications inside it

Usually environment artifacts (line endings, pnpm 10's `allowBuilds:` auto-edits). Discard:

```bash
git submodule foreach --recursive 'git checkout -- .'
```

## CI / GitHub Actions

### Editing a workflow file alone doesn't trigger a CI run

The `paths:` filter on `push:` excludes `.github/workflows/**` by default. Workflow-only changes won't trigger anything. The current workflow includes `.github/workflows/**` in its paths and also declares `workflow_dispatch:`, so you can also manually rerun via:

```bash
gh workflow run CI --ref main
```

### CI's auth step exits with `User force closed the prompt`

`now-sdk auth --add` is interactive — it has no `--user`/`--password` flags and doesn't read `SN_USERNAME`/`SN_PASSWORD` env vars. Piping a printf into stdin gets the username through, but the password prompt switches to TTY raw mode and stdin EOF arrives early.

The workflow uses `expect` to allocate a real PTY (see `.github/workflows/ci.yml` "Configure instance auth" step). If you swap to a different runner OS, make sure `expect` is available (it's preinstalled on `ubuntu-latest`, but the workflow `apt-get install`s it anyway as a safety net).

## Git on Windows

### `LF will be replaced by CRLF` warnings on every commit

Git's autocrlf is normalizing line endings. Cosmetic. To silence:

```bash
git config core.autocrlf input    # commit LF, leave CRLF on disk
```

Don't disable globally without thinking — some Windows-native files (`.bat`, `.cmd`) do need CRLF.

## AI tool issues

### Generated code references a table/field that doesn't exist

The AI didn't ground against `instance-config/`. Re-run the harvest, then re-prompt with a note like: *"verify all tables exist in instance-config/schema/tables.json before generating"*.

### `/now-scaffold` (Claude Code) is not found

The skill didn't load. Check `.claude/skills/now-scaffold/` exists. For the official Fluent plugin skills (`/fluent:now-sdk-*`), make sure the plugin is installed:

```
/plugin marketplace add servicenow/sdk
/plugin install fluent
/reload-plugins
```

## Where to look when stuck

- **Instance UI:** `System Logs → All` for runtime errors, `System Log → Transactions` for slow requests
- **SDK build output:** `apps/<app>/dist/` — XML metadata the SDK produces
- **Local logs:** `*.log` files in the app directory
- **CI logs:** GitHub Actions tab, click into the failing job
- **`now-sdk explain <topic>`:** for SDK API questions
- **`servicenow-docs/markdown/`:** for platform questions (don't fetch from servicenow.com/docs — it's a JS SPA)

## Add a new entry

Hit something not listed? Edit this file and PR it. Include: symptom, likely cause, fix command/steps.
