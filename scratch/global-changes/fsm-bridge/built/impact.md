# Impact summary: FSM Bridge — incident_task field + dispatch BR

Adds u_needs_field_service field to incident_task plus the Business Rule
that dispatches to the FSM bridge scoped app when the field flips true.
Required for the FSM <-> ITSM integration demo (Monday 2026-05-19).

## Intent

Enable incident analysts to flag an incident task as needing field service.
When the flag is set, a Business Rule calls FieldServiceDispatcher in the
x_1111454_fsmbridge scoped app, which creates a wm_order in Field Service
Management and records the linkage in a custom audit table.

## Artifacts in this update set

- **Dictionary** `incident_task.u_needs_field_service` — sys_dictionary_incident_task_u_needs_field_service
- **Business Rule** `FSM Bridge - Dispatch on Flag` — sys_script_543bc1bcc933b2d92d8ba9b8f20d17d1

## Estimated impact

- Tables modified: `incident_task`
- Bulk data changes: no
- Rollback complexity: **low**

### Notes

- New field is nullable with default 'false' — no data backfill needed
- BR only fires when flag changes — no retroactive execution on existing records
- Rollback path: deactivate BR, then drop field (no data loss since default 'false')
- No impact on existing incident_task workflows when field is left default

## Gating checklist

Before importing this update set to a target instance:

- [ ] Generated XML hash (sha256) matches `update-set.sha256`
- [ ] Reviewer has read the source files in `source/`
- [ ] Target instance state has been previewed (see `preview.md`)
- [ ] CAB / change-management approval recorded (if applicable)
- [ ] Rollback procedure understood (see notes above)

On the target instance:

1. **System Update Sets > Retrieved Update Sets > Import Update Set from XML**
2. Upload `update-set.xml`
3. Open the loaded update set, click **Preview Update Set**
4. Resolve any preview errors
5. Click **Commit Update Set**
6. Verify expected changes via `scripts/python/preview-update-set.py --post-import`
