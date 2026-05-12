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

## Build issues

### `now-sdk: command not found`

Either install globally (`npm install -g @servicenow/sdk`) or use `npx @servicenow/sdk` everywhere. The setup script and CI use `npx`.

### `pnpm: command not found`

Install: `npm install -g pnpm`. Verify `pnpm --version` returns 10+.

### Node version error from the SDK

The SDK is strict. `node --version` must be 20+. Use `nvm` (Linux/macOS) or `nvm-windows` to switch.

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

### ATF test API returns 403

The deploy user lacks `sn_cicd.sys_ci_automation`. Either grant the role on the instance (System Security → Users → Roles) or use an admin user.

### `scripts/run-tests.js --suite <name>` says "suite not found"

The suite hasn't been deployed yet, or the name is wrong. Suites are named `<scope>-suite` by convention. Check `sys_atf_test_suite` on the instance for the actual name.

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
