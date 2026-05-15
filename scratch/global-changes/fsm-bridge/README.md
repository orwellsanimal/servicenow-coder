# FSM Bridge — global-scope changes

> Sample change for the Monday 2026-05-19 demo. Pairs with the
> `x_1111454_fsmbridge` scoped app (CI/CD'd separately).

## What this change does

Adds a single boolean field to the `incident_task` table (`u_needs_field_service`) and a
Business Rule that fires when the field flips true, calling
`FieldServiceDispatcher.handleIncidentTask()` in the FSM bridge scoped app.

The dispatcher (in the scoped app) creates a `wm_order` in Field Service Management and
records the mapping in a custom audit table.

## Why this is a global change, not scoped

The `incident_task` table is in the global scope. Adding a custom field to it and attaching
a Business Rule to it requires global-scope changes — these cannot be deployed via the
scoped-app CI/CD path.

This is a textbook example of the hybrid pattern:
- **Scoped portion** (`x_1111454_fsmbridge`): the dispatcher, audit table, helper Script
  Include, ATF tests — auto-deployed
- **Global portion** (this change): the field + BR that *invoke* the scoped logic — hand-applied

## Files in this change

| File | Purpose |
|------|---------|
| `manifest.yaml` | Change description + artifact list |
| `source/dispatch-br.js` | Business Rule script body (referenced from manifest) |
| `built/update-set.xml` | Generated importable artifact |
| `built/update-set.sha256` | Integrity hash |
| `built/impact.md` | Generated impact summary |
| `built/preview.md` | Generated pre-import preview |

## Regenerate

```bash
node scripts/build-update-set.js scratch/global-changes/fsm-bridge/
```

Idempotent — sys_ids are deterministically derived from the update-set name + artifact
identifiers, so re-running produces the same XML (modulo the `unload_date` timestamp).

## Preview against a live instance

Before importing, preview the change against the target instance:

```bash
python scripts/python/preview-update-set.py dist/update-sets/fsm-bridge/update-set.xml
```

This will show whether the target table exists, whether the field would be created or
updated, and whether a BR with the same name already exists.

## Import

1. Download `built/update-set.xml`
2. ServiceNow → **System Update Sets** → **Retrieved Update Sets**
3. Click **Import Update Set from XML** → choose the file → **Upload**
4. Open the loaded update set, click **Preview Update Set**
5. Resolve any preview errors
6. Click **Commit Update Set**

## Verify post-import

```bash
python scripts/python/preview-update-set.py dist/update-sets/fsm-bridge/update-set.xml --post-import
```

Both artifacts should show `OK`.

## Rollback

If the change misbehaves:

1. ServiceNow → **System Update Sets** → **Update Sets to Commit**
2. Find the committed update set
3. Click **Back Out**
4. Resolve any back-out errors (e.g. data dependencies)

For the FSM bridge specifically, the rollback is low-risk because:
- The field has a default of `false`, so no record state is corrupted by dropping it
- The BR only fires when the field changes — back-out stops new dispatches but doesn't
  affect existing `wm_order` records
- The scoped app continues to function but its `handleIncidentTask` is no longer called

## Dependencies

This change has **no dependencies** that must be applied first. However, the BR script
references `x_1111454_fsmbridge.FieldServiceDispatcher`, so the scoped app must be
installed for the BR to actually do anything useful when it fires. Installation order:

1. Deploy `x_1111454_fsmbridge` scoped app (via servicenow-coder CI/CD)
2. Import + commit this update set
3. Manually toggle `u_needs_field_service=true` on a test incident_task to verify wiring
