#!/usr/bin/env python3
"""
Debug script for pc-auto-request: checks each assumption the scheduled
script makes against live instance data via PySNC.

Usage:
    python scripts/python/debug-pc-auto-request.py
"""

import os
import sys
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv
from pysnc import ServiceNowClient

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

# Constants from the app (nightly-pc-request.ts)
HARDWARE_MODEL_CATEGORY = "81feb9c137101000deeabfc8bcbe5dc4"
PC_CATALOG_ITEM = "2ab7077237153000158bbfc8bcbe5da9"
ACTIVE_INSTALL_STATUSES = ["1", "2", "6", "9"]  # as coded today


def main() -> int:
    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env", file=sys.stderr)
        return 2

    client = ServiceNowClient(instance, (user, password))

    print("=" * 60)
    print("pc-auto-request debug")
    print("=" * 60)

    # ── Check 1: identity_type distribution ──────────────────────
    print("\n-- 1. sys_user identity_type distribution --")
    gr = client.GlideRecord("sys_user")
    gr.add_query("active", "true")
    gr.fields = ["user_name", "identity_type"]
    gr.query()

    type_counts: Counter = Counter()
    total_active = 0
    while gr.next():
        total_active += 1
        val = gr.get_value("identity_type") or "(empty/null)"
        type_counts[val] += 1

    print(f"  Total active users: {total_active}")
    for k, v in type_counts.most_common():
        print(f"    identity_type={k!r}: {v}")

    human_count = type_counts.get("human", 0)
    if human_count == 0:
        print("  WARNING: NO users have identity_type='human' -- this is likely why zero orders were created!")

    # ── Check 2: Does the model_category sys_id exist? ───────────
    print("\n-- 2. Validate model_category GUID --")
    gr = client.GlideRecord("cmdb_model_category")
    gr.add_query("sys_id", HARDWARE_MODEL_CATEGORY)
    gr.fields = ["name", "sys_id"]
    gr.query()
    if gr.next():
        print(f"  OK: Found: {gr.get_value('name')} ({HARDWARE_MODEL_CATEGORY})")
    else:
        print(f"  FAIL: model_category {HARDWARE_MODEL_CATEGORY} NOT FOUND on instance!")

    # ── Check 3: Does the catalog item exist and is it active? ───
    print("\n-- 3. Validate catalog item GUID --")
    gr = client.GlideRecord("sc_cat_item")
    gr.add_query("sys_id", PC_CATALOG_ITEM)
    gr.fields = ["name", "sys_id", "active"]
    gr.query()
    if gr.next():
        active = gr.get_value("active")
        print(f"  OK: Found: {gr.get_value('name')} (active={active})")
        if active != "true":
            print("  WARNING: Catalog item is INACTIVE -- cart orders would fail!")
    else:
        print(f"  FAIL: Catalog item {PC_CATALOG_ITEM} NOT FOUND on instance!")

    # ── Check 4: How many users would pass the asset check? ──────
    print("\n-- 4. Asset check: users WITH active PC assets (would be skipped) --")
    # Get all active human users (using the script's filter)
    gr = client.GlideRecord("sys_user")
    gr.add_query("identity_type", "human")
    gr.add_query("active", "true")
    gr.fields = ["sys_id", "user_name"]
    gr.query()

    humans = []
    while gr.next():
        humans.append((gr.get_value("sys_id"), gr.get_value("user_name")))

    if not humans:
        print("  (skipped — no human users to check)")
    else:
        with_asset = 0
        without_asset = 0
        for uid, uname in humans:
            asset_gr = client.GlideRecord("alm_asset")
            asset_gr.add_query("assigned_to", uid)
            asset_gr.add_query("model_category", HARDWARE_MODEL_CATEGORY)
            asset_gr.add_query("install_status", "IN", ",".join(ACTIVE_INSTALL_STATUSES))
            asset_gr.fields = ["sys_id"]
            asset_gr.limit = 1
            asset_gr.query()
            if asset_gr.next():
                with_asset += 1
            else:
                without_asset += 1
                print(f"    -> {uname} has NO active PC asset (would get an order)")

        print(f"  With asset (skip): {with_asset}")
        print(f"  Without asset (order): {without_asset}")

    # ── Check 5: Did the scheduled job actually run? ─────────────
    print("\n-- 5. Scheduled job status --")
    gr = client.GlideRecord("sysauto_script")
    gr.add_query("name", "Nightly PC Request")
    gr.fields = ["name", "active", "run_start", "next_action", "run_as"]
    gr.query()
    if gr.next():
        print(f"  OK: Found: {gr.get_value('name')}")
        print(f"    active:      {gr.get_value('active')}")
        print(f"    run_start:   {gr.get_value('run_start')}")
        print(f"    next_action: {gr.get_value('next_action')}")
        print(f"    run_as:      {gr.get_value('run_as')}")
    else:
        print("  FAIL: Scheduled job 'Nightly PC Request' not found!")

    # ── Check 6: Any existing sc_requests from the job? ──────────
    print("\n-- 6. Recent sc_request records (last 7 days) --")
    gr = client.GlideRecord("sc_request")
    gr.add_query("sys_created_on", ">=", "2026-05-08 00:00:00")
    gr.fields = ["number", "requested_for", "sys_created_on", "sys_created_by"]
    gr.limit = 20
    gr.query()
    count = 0
    while gr.next():
        count += 1
        print(f"    {gr.get_value('number')} | for={gr.get_value('requested_for')} | by={gr.get_value('sys_created_by')} | {gr.get_value('sys_created_on')}")
    if count == 0:
        print("  (none found)")

    print("\n" + "=" * 60)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
