# PySNC templates (future home)

This folder is reserved for reusable PySNC script templates, mirroring how `templates/fluent/artifacts/` works for Fluent SDK code.

**Status:** stub. Templates will be added as patterns emerge from real use of `scripts/python/`.

## Planned templates

| Template | Use case |
|----------|----------|
| `bulk-update.py` | Bulk update records matching a query |
| `export-table.py` | Export a table to JSON/CSV |
| `migrate-records.py` | Copy records between two instances |
| `atf-setup.py` | Pre-test fixture setup, callable as an ATF setup hook |
| `atf-teardown.py` | Post-test cleanup |

See [`scripts/python/`](../../scripts/python/) for the active examples and [`docs/guides/pysnc.md`](../../docs/guides/pysnc.md) for the full guide.
