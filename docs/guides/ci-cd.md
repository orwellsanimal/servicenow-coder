# CI/CD Guide

How the GitHub Actions pipeline works, how to bootstrap it on a fresh fork, and how to extend it. The Harness pipeline at `.harness/pipeline.yml` is a reference spec for the future and is inactive.

## Pipeline overview

`.github/workflows/ci.yml` defines 5 stages:

| Stage | Trigger | Purpose | Maps to Harness |
|-------|---------|---------|-----------------|
| **Validate** | every push + PR | lint, type-check | Build → Validate |
| **Build** | every push + PR | `now-sdk build` all apps | Build → Compile |
| **Pack** | `main` only | `now-sdk pack` artifacts, upload to Actions | Build → Package |
| **Deploy** | `main` only | `now-sdk install` to dev instance | Deploy |
| **Test** | `main` only | `scripts/run-tests.js --all` runs ATF suites | Verify |

Each stage `needs:` the previous, so a failure in earlier stages skips later ones.

Validate and Build run on PRs so you get early feedback. Pack, Deploy, and Test run only on `main` to avoid spamming the instance from feature branches.

## One-time bootstrap

### 1. GitHub Secrets

Settings → Secrets and variables → Actions. Add three secrets:

| Secret | Value | Where it's used |
|--------|-------|-----------------|
| `SN_INSTANCE` | `https://dev123456.service-now.com` | Deploy + Test stages |
| `SN_USER` | Deploy username (often `admin` on PDI) | Deploy + Test |
| `SN_PASSWORD` | Deploy password | Deploy + Test |

### 2. GitHub Environment named `dev`

Settings → Environments → New environment → `dev`.

The Deploy and Test jobs reference `environment: dev`. The environment scope gives you:
- A central place to scope the three secrets (instead of repo-wide)
- Optional protection rules (required reviewers, wait timer) for future stages
- A natural seam to add `test` and `prod` environments later (multi-instance Harness migration)

You can put the secrets at the **repo** level (broader) or the **environment** level (scoped to `dev`). Environment-level is the recommended pattern for production setups.

### 3. Instance roles for the deploy user

| Operation | Minimum role |
|-----------|--------------|
| `now-sdk install` (Deploy stage) | `admin` (Application Repository requires broad write) |
| ATF test API (Test stage) | `sn_cicd.sys_ci_automation` (covered by admin) |

For PDIs, the `admin` account satisfies both. For corporate instances with stricter role boundaries, grant the two explicitly.

## First CI run

After bootstrap:

1. Push a small change to `main` (or merge a PR)
2. Open the Actions tab
3. Watch the pipeline. Expected timing for a small workspace: ~5–8 min total
   - Validate: ~30s
   - Build: ~1–2 min
   - Pack: ~1 min
   - Deploy: ~1–3 min
   - Test: ~1–N min depending on suite size

If Validate or Build fails, fix locally and push again. If Deploy fails with 401/403, see the [troubleshooting guide](./troubleshooting.md).

## Reading CI failures

Each job's logs are linear. The most useful lines are usually near the end. Patterns:

| Failed stage | Usual cause | First thing to check |
|--------------|-------------|---------------------|
| Validate | Lint or type error | Run `pnpm run check` locally |
| Build | SDK error, missing dep | Run `pnpm run build:apps` locally |
| Pack | Build artifact missing | Look at the verify-build-artifacts step output |
| Deploy | 401/403, scope conflict, instance hibernated | Wake PDI, verify secrets, see troubleshooting |
| Test | 403 (role), suite not found, suite failed | Check `sys_atf_test_suite` on the instance |

## Local equivalents (reproducing CI locally)

Every CI step has a local equivalent — useful when CI fails and you want to debug:

```bash
pnpm run ci                       # Validate + Build (no deploy)
pnpm run build:apps               # Build only
node scripts/deploy.js --auth dev # Deploy (no pack — pack only matters in CI for artifact upload)
node scripts/run-tests.js --all   # Test
```

The `--dry-run` flag on `scripts/deploy.js` previews what would deploy without contacting the instance.

## Adding a new app

The pipeline is **app-agnostic**. The Build, Pack, Deploy, and Test stages all enumerate `apps/*` and process whatever's there. So adding a new app via `now-sdk init` automatically gets it into CI on the next push. No workflow edits needed.

Per-app ATF suites follow the `<scope>-suite` convention. The Test stage's `scripts/run-tests.js --all` discovers them from each app's `now.config.json`.

## Adding a new stage

To add a stage (e.g., a security scan or doc generation):

1. Open `.github/workflows/ci.yml`
2. Add a new job under `jobs:`, mirroring the structure of an existing one
3. Use `needs: <prior-stage-name>` to chain it after the previous stage
4. If the stage should only run on `main`, add `if: github.ref == 'refs/heads/main'`
5. Mirror the change in `.harness/pipeline.yml` (reference, not executed yet) for future migration

## Multi-instance future (Harness)

Today the Deploy stage hits a single dev instance. The Harness spec at `.harness/pipeline.yml` describes the production-ops shape:

1. **Deploy to Dev** — auto, equivalent to today's Deploy job
2. **Deploy to Test** — gated by manual approval
3. **Deploy to Prod** — gated by approval + change ticket

Each stage uses a different `--auth` alias and `SN_INSTANCE` secret. When migrating:

1. Spin up the additional instances and register `test`, `prod` aliases
2. Create `test` and `prod` GitHub Environments (or migrate the pipeline to Harness)
3. Move the secrets to per-environment scope
4. Update `scripts/deploy.js` invocations to use the right alias per stage

## CI/CD principles in this repo

- **No update sets.** Application Repository model only.
- **Git is the source of truth.** Don't make changes in the instance UI for SDK-developed apps — `now-sdk transform` to pull them back in, or re-author in code.
- **One commit, one deploy.** Each push to `main` produces a deploy. Keep commits cohesive.
- **Tests gate promotion.** ATF failures fail the Test stage, which (in a multi-instance future) blocks promotion.

## See also

- [SETUP.md](../../SETUP.md) — full setup walkthrough
- [docs/guides/troubleshooting.md](./troubleshooting.md) — when CI fails
- `.github/workflows/ci.yml` — the source of truth for what runs
- `.harness/pipeline.yml` — future migration reference
