#!/usr/bin/env python3
"""
Example PySNC script: seed sample records on the dev instance.

Use cases:
- Pre-populate an instance for ATF tests
- Drop a small fixture set into a fresh PDI for demos
- Bulk insert / update from a CSV or JSON source

Usage:
    python scripts/python/seed-data.py [--dry-run]

Reads SN_INSTANCE / SN_USER / SN_PASSWORD from .env at the repo root.
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pysnc import ServiceNowClient

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed sample records on the dev instance.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be inserted, don't write")
    args = parser.parse_args()

    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env", file=sys.stderr)
        return 2

    # PySNC wants the host portion only, e.g. "dev123456" or full URL with scheme
    client = ServiceNowClient(instance, (user, password))

    # Example fixture: a handful of incidents tagged for testing
    fixtures = [
        {"short_description": "[fixture] Network slowness in NYC office", "urgency": "2", "category": "network"},
        {"short_description": "[fixture] Printer offline — LON-FL3", "urgency": "3", "category": "hardware"},
        {"short_description": "[fixture] VPN auth failure for remote user", "urgency": "2", "category": "software"},
    ]

    gr = client.GlideRecord("incident")
    inserted = []
    for f in fixtures:
        if args.dry_run:
            print(f"  [dry-run] would insert: {f['short_description']}")
            continue
        gr.initialize()
        for k, v in f.items():
            gr.set_value(k, v)
        sys_id = gr.insert()
        if sys_id:
            inserted.append(sys_id)
            print(f"  [OK] inserted {sys_id}: {f['short_description']}")
        else:
            print(f"  [FAIL] insert failed: {f['short_description']}", file=sys.stderr)

    if args.dry_run:
        print(f"\nDry-run: {len(fixtures)} records would be inserted.")
    else:
        print(f"\nDone: {len(inserted)}/{len(fixtures)} inserted.")

    return 0 if len(inserted) == len(fixtures) or args.dry_run else 1


if __name__ == "__main__":
    sys.exit(main())
