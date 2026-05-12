# Python utilities (PySNC)

Cross-cutting scripted operations that talk *to* a ServiceNow instance from outside. Built on [PySNC](https://github.com/ServiceNow/pysnc), the official ServiceNow Python client.

Complements the Fluent SDK work: SDK builds code that runs *on* the instance; PySNC scripts here run *outside* the instance to seed data, run bulk ops, extract records, set up ATF state, etc.

## When to reach for PySNC vs. Fluent SDK vs. GlideScript

| Need | Tool |
|------|------|
| Add a business rule, table, REST API to the platform | **Fluent SDK** (`apps/`) |
| One-off Fix Script to clean up records | **GlideScript** (`scratch/`) — runs in-instance |
| Seed test data before an ATF run | **PySNC** (this folder) |
| Migrate records between instances | **PySNC** |
| Pull data for external reporting / analysis | **PySNC** |
| Bulk update where a Fix Script is overkill / risky | **PySNC** |

Rule of thumb: if the code needs to live on the platform, use Fluent. If it's a one-shot operation against the platform from outside, use PySNC.

## Setup

One-time, after running `node scripts/setup.js`:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

The `.venv/` directory is gitignored.

## Authentication

PySNC reads the same `.env` at the repo root used by the Node scripts:

```
SN_INSTANCE=https://dev123456.service-now.com
SN_USER=admin
SN_PASSWORD=...
```

Use `python-dotenv` to load it:

```python
from dotenv import load_dotenv
load_dotenv()
```

## Examples in this folder

| Script | Purpose |
|--------|---------|
| `seed-data.py` | Example: insert sample records for ATF setup |

Add new scripts here following the same pattern: load `.env`, connect via PySNC, do the operation, exit non-zero on failure.

## Future (Option 2)

When PySNC use grows beyond ad-hoc scripts:

- **`templates/pysnc/`** — reusable patterns (bulk-update, export, migration, ATF setup helper)
- **`scripts/setup.js` integration** — optional Python detection + venv creation as step 8
- **Skill `/now-pysnc-script`** (Claude Code) — generate new scripts grounded against `instance-config/`

See [`docs/guides/pysnc.md`](../../docs/guides/pysnc.md) for the full guide.
