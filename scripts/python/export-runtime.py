#!/usr/bin/env python3
"""
Export runtime/operational data from a ServiceNow instance via PySNC.

Complements the Node.js export-instance.js (which handles schema/config)
with operational data useful for pre-development validation.

Usage:
    python scripts/python/export-runtime.py
    python scripts/python/export-runtime.py --only catalog,automation
    python scripts/python/export-runtime.py --only users,assets --limit 5000

Categories: catalog, automation, users, assets
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pysnc import ServiceNowClient

# Local PySNC companion module for server-side aggregation
sys.path.insert(0, str(Path(__file__).resolve().parent))
from aggregate import sn_count  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
INSTANCE_CONFIG = REPO_ROOT / "instance-config"
ALL_CATEGORIES = ["catalog", "automation", "users", "assets"]

load_dotenv(REPO_ROOT / ".env")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export runtime data from ServiceNow instance via PySNC.")
    parser.add_argument("--only", type=str, default=None,
                        help="Comma-separated categories to export (default: all)")
    parser.add_argument("--limit", type=int, default=10000,
                        help="Max records per table query (default: 10000)")
    return parser.parse_args()


def get_client() -> ServiceNowClient:
    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env", file=sys.stderr)
        sys.exit(2)
    return ServiceNowClient(instance, (user, password))


def write_json(rel_path: str, data: dict) -> None:
    out = INSTANCE_CONFIG / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=4) + "\n")
    size = out.stat().st_size
    print(f"  Wrote {rel_path} ({size} bytes)")


def query_table(client: ServiceNowClient, table: str, fields: list[str],
                limit: int = 10000, **queries) -> list[dict] | None:
    """Query a table, return list of dicts. Returns None on ACL/access failure."""
    try:
        gr = client.GlideRecord(table)
        for field, value in queries.items():
            if isinstance(value, tuple) and len(value) == 2:
                gr.add_query(field, value[0], value[1])
            else:
                gr.add_query(field, str(value))
        gr.fields = fields
        gr.limit = limit
        gr.query()

        records = []
        while gr.next():
            row = {}
            for f in fields:
                row[f] = gr.get_value(f) or ""
            records.append(row)
        return records
    except Exception as e:
        print(f"  [SKIP] {table}: {e}", file=sys.stderr)
        return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Export: catalog
# ---------------------------------------------------------------------------

def export_catalog(client: ServiceNowClient, limit: int) -> None:
    # Catalog items
    print("  Querying sc_cat_item...")
    records = query_table(client, "sc_cat_item",
                          ["sys_id", "name", "short_description", "active", "category", "price", "recurring_price"],
                          limit=limit)
    if records is not None:
        items = {}
        for r in records:
            items[r["sys_id"]] = {
                "name": r["name"],
                "short_description": r["short_description"],
                "active": r["active"] == "true",
                "category": r["category"],
                "price": r["price"],
                "recurring_price": r["recurring_price"],
            }
        write_json("catalog/items.json", {
            "$schema": "../schemas/catalog-items.schema.json",
            "_source": "sc_cat_item",
            "_description": "Service Catalog items on the instance.",
            "_exported_at": now_iso(),
            "items": items,
        })

    # Model categories
    print("  Querying cmdb_model_category...")
    records = query_table(client, "cmdb_model_category",
                          ["sys_id", "name"],
                          limit=limit)
    if records is not None:
        categories = {}
        for r in records:
            categories[r["sys_id"]] = {"name": r["name"]}
        write_json("catalog/model-categories.json", {
            "$schema": "../schemas/model-categories.schema.json",
            "_source": "cmdb_model_category",
            "_description": "CMDB model categories (for validating model_category GUIDs).",
            "_exported_at": now_iso(),
            "model_categories": categories,
        })


# ---------------------------------------------------------------------------
# Export: automation
# ---------------------------------------------------------------------------

def export_automation(client: ServiceNowClient, limit: int) -> None:
    # Scheduled script jobs
    print("  Querying sysauto_script...")
    records = query_table(client, "sysauto_script",
                          ["sys_id", "name", "active", "run_type", "run_start", "run_time", "time_zone", "sys_scope"],
                          limit=limit)
    if records is not None:
        jobs = {}
        for r in records:
            jobs[r["sys_id"]] = {
                "name": r["name"],
                "active": r["active"] == "true",
                "run_type": r["run_type"],
                "run_start": r["run_start"],
                "run_time": r["run_time"],
                "time_zone": r["time_zone"],
                "scope": r["sys_scope"],
            }
        write_json("automation/scheduled-jobs.json", {
            "$schema": "../schemas/scheduled-jobs.schema.json",
            "_source": "sysauto_script",
            "_description": "Scheduled script jobs and their current state.",
            "_exported_at": now_iso(),
            "jobs": jobs,
        })

    # Triggers (often ACL-locked)
    print("  Querying sys_trigger...")
    records = query_table(client, "sys_trigger",
                          ["sys_id", "name", "next_action", "state", "trigger_type"],
                          limit=limit)
    if records is not None:
        triggers = {}
        for r in records:
            triggers[r["sys_id"]] = {
                "name": r["name"],
                "next_action": r["next_action"],
                "state": r["state"],
                "trigger_type": r["trigger_type"],
            }
        write_json("automation/triggers.json", {
            "_source": "sys_trigger",
            "_description": "Trigger records (scheduler execution state).",
            "_exported_at": now_iso(),
            "triggers": triggers,
        })


# ---------------------------------------------------------------------------
# Export: users (aggregate counts only, no PII)
# ---------------------------------------------------------------------------

def export_users(client: ServiceNowClient, limit: int) -> None:
    """Server-side aggregation via Stats API — no full user fetch needed."""
    try:
        print("  Counting active users by identity_type...")
        identity_dist = sn_count(
            client, "sys_user",
            query="active=true",
            group_by="identity_type",
            display_value=False,  # raw choice values (e.g. 'human', not 'Human')
        )
        print("  Counting active total...")
        total_active = sn_count(client, "sys_user", query="active=true")
        print("  Counting inactive total...")
        total_inactive = sn_count(client, "sys_user", query="active=false")
    except Exception as e:
        print(f"  [SKIP] users export failed: {e}", file=sys.stderr)
        return

    # Sort distribution by count descending for stable, readable output
    sorted_dist = dict(sorted(identity_dist.items(), key=lambda x: -x[1]))

    write_json("users/distribution.json", {
        "$schema": "../schemas/user-distribution.schema.json",
        "_source": "sys_user",
        "_description": "User distribution statistics (no PII, counts only).",
        "_exported_at": now_iso(),
        "total_active": total_active,
        "total_inactive": total_inactive,
        "identity_type_distribution": sorted_dist,
    })


# ---------------------------------------------------------------------------
# Export: assets (summary counts)
# ---------------------------------------------------------------------------

def export_assets(client: ServiceNowClient, limit: int) -> None:
    """Server-side aggregation via Stats API — no full asset fetch needed."""
    try:
        print("  Counting alm_asset by model_category...")
        # Use display_value=True so model_category names come back human-readable
        by_category_named = sn_count(
            client, "alm_asset",
            group_by="model_category",
            display_value=True,
        )
        print("  Counting alm_asset by model_category (sys_ids)...")
        # And again with raw sys_ids so we can key by GUID
        by_category_raw = sn_count(
            client, "alm_asset",
            group_by="model_category",
            display_value=False,
        )
        print("  Counting alm_asset by install_status...")
        by_status_labels = sn_count(
            client, "alm_asset",
            group_by="install_status",
            display_value=True,
        )
        by_status_raw = sn_count(
            client, "alm_asset",
            group_by="install_status",
            display_value=False,
        )
        print("  Counting total alm_asset...")
        total_assets = sn_count(client, "alm_asset")
    except Exception as e:
        print(f"  [SKIP] assets export failed: {e}", file=sys.stderr)
        return

    # Pair sys_id keys with their display names. The two dicts iterate in
    # the same Stats API order, so zipping is safe.
    by_model_category = {
        sid: {"name": name, "count": count}
        for (sid, count), name in zip(by_category_raw.items(), by_category_named.keys())
    }
    by_install_status = {
        val: {"label": label, "count": count}
        for (val, count), label in zip(by_status_raw.items(), by_status_labels.keys())
    }

    write_json("assets/summary.json", {
        "$schema": "../schemas/asset-summary.schema.json",
        "_source": "alm_asset",
        "_description": "Asset distribution summary (counts by model_category and install_status).",
        "_exported_at": now_iso(),
        "total_assets": total_assets,
        "by_model_category": by_model_category,
        "by_install_status": by_install_status,
    })


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    args = parse_args()
    client = get_client()

    categories = {
        "catalog": export_catalog,
        "automation": export_automation,
        "users": export_users,
        "assets": export_assets,
    }

    selected = args.only.split(",") if args.only else ALL_CATEGORIES
    failures = []

    instance = os.getenv("SN_INSTANCE")
    print(f"Exporting runtime data from: {instance}")
    print(f"Categories: {', '.join(selected)}\n")

    for name in selected:
        if name not in categories:
            print(f"Unknown category: {name}", file=sys.stderr)
            continue
        try:
            print(f"Exporting {name}...")
            categories[name](client, args.limit)
        except Exception as e:
            print(f"  [WARN] {name} export failed: {e}", file=sys.stderr)
            failures.append(name)

    print("\nRuntime export complete.")
    if failures:
        print(f"Partial failures (likely ACL restrictions): {', '.join(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
