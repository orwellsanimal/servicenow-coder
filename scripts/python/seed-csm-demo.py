#!/usr/bin/env python3
"""
Seed CSM demo data: accounts, contacts, and cases.

Creates a small, realistic fixture set so demos have something to query.
Every record is tagged with [fixture] in its name/short_description and
created with sys_created_by = the seed user, so teardown is safe.

Usage:
    python scripts/python/seed-csm-demo.py             # seed (idempotent)
    python scripts/python/seed-csm-demo.py --dry-run   # preview, no writes
    python scripts/python/seed-csm-demo.py --teardown  # delete all fixtures
    python scripts/python/seed-csm-demo.py --teardown --dry-run

Reads SN_INSTANCE / SN_USER / SN_PASSWORD from .env at the repo root.

Design notes:
- Idempotent: re-running checks for existing fixture records by name first
- Tagged: all records have [fixture] prefix for safe identification
- Realistic mix: cases span all states with varied ages, priorities, and
  contact_types — including some intentionally STALE cases in 'Awaiting Info'
  (state=18) for >7 days, which is what the stale-case-notifier app will flag
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from pysnc import ServiceNowClient

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

FIXTURE_TAG = "[fixture]"

# ── Fixture catalog ─────────────────────────────────────────────────────────

ACCOUNTS = [
    {"name": f"{FIXTURE_TAG} Acme Corporation",   "type": "customer", "industry": "Manufacturing"},
    {"name": f"{FIXTURE_TAG} Globex Industries",  "type": "customer", "industry": "Energy"},
    {"name": f"{FIXTURE_TAG} Initech Systems",    "type": "customer", "industry": "Technology"},
    {"name": f"{FIXTURE_TAG} Soylent Foods",      "type": "customer", "industry": "Consumer Goods"},
    {"name": f"{FIXTURE_TAG} Cyberdyne Research", "type": "customer", "industry": "R&D"},
]

# Contacts per account (cycled)
CONTACT_TEMPLATES = [
    ("Alice", "Anderson"),
    ("Bob", "Brown"),
    ("Carol", "Chen"),
    ("Dan", "Davis"),
    ("Eve", "Edwards"),
    ("Frank", "Foster"),
]

# Cases — each entry: (state, priority, age_days, short_description_suffix)
# state 1=New, 10=Open, 18=Awaiting Info, 6=Resolved, 3=Closed
CASE_TEMPLATES = [
    # Fresh new cases (control group — should NOT be flagged as stale)
    ("1", "2", 0,  "API returning 500 on /orders endpoint"),
    ("1", "3", 1,  "Mobile app login screen frozen"),
    ("10", "2", 2, "Bulk import failing with timeout"),
    ("10", "3", 3, "Report export missing columns"),

    # Stale 'Awaiting Info' cases — these are the targets the notifier should flag
    ("18", "2", 9,  "Customer asked for screenshots, no response in 9 days"),
    ("18", "3", 12, "Awaiting account number from customer"),
    ("18", "4", 15, "Customer never replied to clarification request"),
    ("18", "1", 21, "Critical issue but customer not responding"),

    # Borderline cases (just under 7-day threshold — should NOT flag)
    ("18", "3", 5, "Recently asked customer for more info"),
    ("18", "2", 6, "Awaiting browser version from customer"),

    # Resolved/closed (should never be touched by notifier)
    ("6", "3", 30, "Resolved: password reset completed"),
    ("3", "2", 60, "Closed: duplicate of CASE0010005"),
]


# ── PySNC helpers ───────────────────────────────────────────────────────────

def get_client() -> ServiceNowClient:
    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env", file=sys.stderr)
        sys.exit(2)
    return ServiceNowClient(instance, (user, password))


def find_existing(client: ServiceNowClient, table: str, name_field: str, name: str) -> str | None:
    """Return sys_id of existing fixture record by name, or None."""
    gr = client.GlideRecord(table)
    gr.add_query(name_field, name)
    gr.fields = ["sys_id"]
    gr.limit = 1
    gr.query()
    if gr.next():
        return gr.get_value("sys_id")
    return None


def ts_days_ago(days: int) -> str:
    """Format a timestamp `days` days ago as 'YYYY-MM-DD HH:MM:SS' UTC."""
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


# ── Seed actions ────────────────────────────────────────────────────────────

def seed_accounts(client: ServiceNowClient, dry_run: bool) -> dict[str, str]:
    """Insert (or reuse) fixture accounts. Returns name -> sys_id map."""
    print("\n-- Seeding accounts --")
    result: dict[str, str] = {}
    for acct in ACCOUNTS:
        existing = find_existing(client, "customer_account", "name", acct["name"])
        if existing:
            print(f"  EXISTS: {acct['name']} ({existing})")
            result[acct["name"]] = existing
            continue
        if dry_run:
            print(f"  [dry-run] would insert: {acct['name']}")
            result[acct["name"]] = "<dry-run-sys_id>"
            continue
        gr = client.GlideRecord("customer_account")
        gr.initialize()
        for k, v in acct.items():
            gr.set_value(k, v)
        sys_id = gr.insert()
        if sys_id:
            print(f"  INSERTED: {acct['name']} ({sys_id})")
            result[acct["name"]] = sys_id
        else:
            print(f"  FAILED: {acct['name']}", file=sys.stderr)
    return result


def seed_contacts(client: ServiceNowClient, accounts: dict[str, str], dry_run: bool) -> dict[str, str]:
    """Insert ~2 contacts per account. Returns 'first.last' -> sys_id map."""
    print("\n-- Seeding contacts --")
    result: dict[str, str] = {}
    contact_idx = 0
    for acct_name, acct_sys_id in accounts.items():
        # 2 contacts per account
        for _ in range(2):
            first, last = CONTACT_TEMPLATES[contact_idx % len(CONTACT_TEMPLATES)]
            contact_idx += 1
            full_name = f"{FIXTURE_TAG} {first} {last}"
            key = f"{first}.{last}".lower()

            existing = find_existing(client, "customer_contact", "first_name", f"{FIXTURE_TAG} {first}")
            if existing:
                print(f"  EXISTS: {full_name} ({existing})")
                result[key] = existing
                continue
            if dry_run:
                print(f"  [dry-run] would insert: {full_name} @ {acct_name}")
                result[key] = "<dry-run-sys_id>"
                continue

            gr = client.GlideRecord("customer_contact")
            gr.initialize()
            gr.set_value("first_name", f"{FIXTURE_TAG} {first}")
            gr.set_value("last_name", last)
            gr.set_value("email", f"{first.lower()}.{last.lower()}@example.com")
            gr.set_value("account", acct_sys_id)
            sys_id = gr.insert()
            if sys_id:
                print(f"  INSERTED: {full_name} @ {acct_name} ({sys_id})")
                result[key] = sys_id
            else:
                print(f"  FAILED: {full_name}", file=sys.stderr)
    return result


def seed_cases(client: ServiceNowClient, accounts: dict[str, str], contacts: dict[str, str], dry_run: bool) -> int:
    """Insert cases distributed across accounts. Returns count inserted."""
    print("\n-- Seeding cases --")
    inserted = 0
    account_sys_ids = list(accounts.values())
    contact_sys_ids = list(contacts.values())

    for i, (state, priority, age_days, suffix) in enumerate(CASE_TEMPLATES):
        short_desc = f"{FIXTURE_TAG} {suffix}"
        existing = find_existing(client, "sn_customerservice_case", "short_description", short_desc)
        if existing:
            print(f"  EXISTS: {short_desc} ({existing})")
            continue
        if dry_run:
            print(f"  [dry-run] would insert: state={state} pri={priority} age={age_days}d | {suffix}")
            continue

        gr = client.GlideRecord("sn_customerservice_case")
        gr.initialize()
        gr.set_value("short_description", short_desc)
        gr.set_value("description", f"Auto-generated fixture case. State={state}, priority={priority}, age={age_days} days.")
        gr.set_value("state", state)
        gr.set_value("priority", priority)
        gr.set_value("account", account_sys_ids[i % len(account_sys_ids)])
        if contact_sys_ids:
            gr.set_value("contact", contact_sys_ids[i % len(contact_sys_ids)])
        # Backdate so the staleness check has meaningful data
        if age_days > 0:
            gr.set_value("opened_at", ts_days_ago(age_days))
            gr.set_value("sys_updated_on", ts_days_ago(age_days))
        sys_id = gr.insert()
        if sys_id:
            print(f"  INSERTED: state={state} pri={priority} age={age_days}d ({sys_id}) | {suffix}")
            inserted += 1
        else:
            print(f"  FAILED: {short_desc}", file=sys.stderr)
    return inserted


# ── Teardown ────────────────────────────────────────────────────────────────

def teardown(client: ServiceNowClient, dry_run: bool) -> None:
    """Delete all [fixture]-tagged records. Order: cases -> contacts -> accounts."""
    print("\n-- Tearing down fixtures --")
    # Cases first (FK to accounts/contacts)
    for table, label_field in [
        ("sn_customerservice_case", "short_description"),
        ("customer_contact", "first_name"),
        ("customer_account", "name"),
    ]:
        gr = client.GlideRecord(table)
        gr.add_query(label_field, "STARTSWITH", FIXTURE_TAG)
        gr.fields = ["sys_id", label_field]
        gr.query()
        count = gr.get_row_count()
        print(f"\n  {table}: {count} fixture records found")
        if count > 500:
            print(f"  ABORT: too many records to delete safely ({count}). Filter may be wrong.", file=sys.stderr)
            return
        while gr.next():
            label = gr.get_value(label_field)
            sid = gr.get_value("sys_id")
            if dry_run:
                print(f"    [dry-run] would delete: {label} ({sid})")
                continue
            if gr.delete_record():
                print(f"    DELETED: {label} ({sid})")
            else:
                print(f"    FAILED: {label}", file=sys.stderr)


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Seed (or tear down) CSM demo data via PySNC.")
    parser.add_argument("--dry-run", action="store_true", help="Preview actions without writing")
    parser.add_argument("--teardown", action="store_true", help="Delete all [fixture]-tagged records")
    args = parser.parse_args()

    client = get_client()

    if args.teardown:
        teardown(client, args.dry_run)
        return 0

    accounts = seed_accounts(client, args.dry_run)
    contacts = seed_contacts(client, accounts, args.dry_run)
    case_count = seed_cases(client, accounts, contacts, args.dry_run)

    print("\n-- Summary --")
    print(f"  Accounts: {len(accounts)}")
    print(f"  Contacts: {len(contacts)}")
    print(f"  Cases inserted: {case_count}")
    if args.dry_run:
        print("  (dry-run — no records were actually written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
