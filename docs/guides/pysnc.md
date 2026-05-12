# PySNC Guide

[PySNC](https://github.com/ServiceNow/pysnc) is the official ServiceNow Python client. It wraps the Table API with a `GlideRecord`-like interface. In this workspace it's a **utility layer** for cross-cutting operations that don't belong inside the platform.

## When to use PySNC

| Need | Tool |
|------|------|
| Code that lives on the platform (BR, script include, REST API, etc.) | **Fluent SDK** (`apps/`) |
| One-off in-instance Fix Script | **GlideScript** (`scratch/`) |
| Seed test data before an ATF run | **PySNC** (`scripts/python/`) |
| Cross-instance record migration | **PySNC** |
| Bulk update from outside (CSV → records) | **PySNC** |
| Extract data for external reporting | **PySNC** |
| Set up / tear down fixtures around CI runs | **PySNC** |

Rule of thumb: if the code needs to live on the platform, use the SDK. If it's a one-shot operation *against* the platform from outside, use PySNC.

## Setup

After `node scripts/setup.js`:

```bash
python -m venv .venv
source .venv/bin/activate          # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Verify:
```bash
python -c "import pysnc; print(pysnc.__version__)"
```

`.venv/` is gitignored.

## Authentication

PySNC scripts read the same `.env` at the repo root used by Node scripts. No separate credential setup.

```python
from dotenv import load_dotenv
load_dotenv()
import os
client = ServiceNowClient(os.getenv("SN_INSTANCE"), (os.getenv("SN_USER"), os.getenv("SN_PASSWORD")))
```

## Patterns

### Insert records

```python
gr = client.GlideRecord("incident")
gr.initialize()
gr.set_value("short_description", "Created from PySNC")
gr.set_value("urgency", "2")
sys_id = gr.insert()
```

### Query and update

```python
gr = client.GlideRecord("incident")
gr.add_query("state", "1")           # New
gr.add_query("urgency", "1")          # High
gr.query()
while gr.next():
    gr.set_value("priority", "1")
    gr.update()
```

### Bulk delete (with safety)

```python
gr = client.GlideRecord("x_myapp_test_data")
gr.add_query("short_description", "STARTSWITH", "[fixture]")
gr.query()
if gr.get_row_count() > 1000:
    raise RuntimeError(f"Refusing to delete {gr.get_row_count()} records — looks too broad")
while gr.next():
    gr.delete_record()
```

### Cross-instance copy

Open two clients and pipe records:

```python
src = ServiceNowClient(SRC_INSTANCE, (SRC_USER, SRC_PASS))
dst = ServiceNowClient(DST_INSTANCE, (DST_USER, DST_PASS))

src_gr = src.GlideRecord("cmn_location")
src_gr.add_query("active", "true")
src_gr.query()

while src_gr.next():
    dst_gr = dst.GlideRecord("cmn_location")
    dst_gr.initialize()
    for field in ["name", "street", "city", "country", "latitude", "longitude"]:
        dst_gr.set_value(field, src_gr.get_value(field))
    dst_gr.insert()
```

## Conventions

- **Place scripts in `scripts/python/`** (one file per operation, named after the verb: `seed-data.py`, `export-incidents.py`, `migrate-locations.py`)
- **Idempotent where reasonable** — re-running should not duplicate fixtures unless intended
- **Dry-run flag** on anything destructive (`--dry-run` argparse flag, default safe)
- **Exit non-zero on failure** so CI can gate on it
- **Use `instance-config/` for grounding** — verify table/field names exist before writing scripts (same discipline as Fluent code)

## ATF integration (future)

A PySNC script can set up fixtures before an ATF suite runs and clean up after. The CI `test` job can be extended with:

```yaml
- name: Seed ATF fixtures
  run: python scripts/python/atf-setup.py
- name: Run ATF suites
  run: node scripts/run-tests.js --all
- name: Tear down ATF fixtures
  if: always()
  run: python scripts/python/atf-teardown.py
```

Not wired up yet — add when ATF tests grow stateful needs.

## See also

- Official PySNC: https://github.com/ServiceNow/pysnc
- PySNC docs: https://servicenow.github.io/PySNC/
- `scripts/python/` — active scripts
- `templates/pysnc/` — future template home (stubbed)
- `docs/guides/troubleshooting.md` — for common errors
