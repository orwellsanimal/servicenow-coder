#!/usr/bin/env python3
"""
Pre-import preview for an update set XML.

Parses a generated update-set.xml and queries the live instance via PySNC
to report what the import will actually create vs update vs warn about.
This is the "trusted environment" side of the gating workflow — the human
reviewer compares this against ServiceNow's own Preview Update Set output
on the target instance before committing.

Usage:
    python scripts/python/preview-update-set.py <path-to-update-set.xml>
    python scripts/python/preview-update-set.py <path-to-update-set.xml> --post-import

Reads SN_INSTANCE / SN_USER / SN_PASSWORD from .env.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

from dotenv import load_dotenv
from pysnc import ServiceNowClient

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


def get_client() -> ServiceNowClient:
    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env", file=sys.stderr)
        sys.exit(2)
    return ServiceNowClient(instance, (user, password))


def parse_update_set(xml_path: Path) -> tuple[dict, list[dict]]:
    """Parse the update-set.xml and return (manifest_summary, artifacts)."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    rs = root.find("sys_remote_update_set")
    manifest_summary = {
        "name": (rs.findtext("name") or "").strip() if rs is not None else "",
        "description": (rs.findtext("description") or "").strip() if rs is not None else "",
        "application": (rs.findtext("application") or "global").strip() if rs is not None else "global",
        "sys_id": (rs.findtext("sys_id") or "").strip() if rs is not None else "",
    }

    artifacts = []
    for entry in root.findall("sys_update_xml"):
        target_name = (entry.findtext("target_name") or "").strip()
        artifact_type = (entry.findtext("type") or "").strip()
        sys_update_name = (entry.findtext("name") or "").strip()
        # findtext() already decodes XML entities, so the payload string
        # here is the inner record_update XML ready to parse directly.
        payload_xml = entry.findtext("payload") or ""

        inner_table = None
        inner_sys_id = None
        inner_fields: dict[str, str] = {}
        try:
            inner_root = ET.fromstring(payload_xml)
            inner_table = inner_root.get("table")
            child = list(inner_root)[0] if list(inner_root) else None
            if child is not None:
                for el in child:
                    text = (el.text or "").strip() if el.text else ""
                    inner_fields[el.tag] = text
                inner_sys_id = inner_fields.get("sys_id") or None
        except ET.ParseError as e:
            print(f"  WARN: could not parse payload for {target_name}: {e}", file=sys.stderr)

        artifacts.append({
            "target_name": target_name,
            "type": artifact_type,
            "sys_update_name": sys_update_name,
            "inner_table": inner_table,
            "inner_sys_id": inner_sys_id,
            "inner_fields": inner_fields,
        })

    return manifest_summary, artifacts


def check_target_exists(client: ServiceNowClient, table: str, query_kv: dict) -> dict | None:
    """Query a table for a record matching query_kv, return its dict or None."""
    try:
        gr = client.GlideRecord(table)
        for k, v in query_kv.items():
            gr.add_query(k, v)
        gr.limit = 1
        gr.query()
        if gr.next():
            return {f: gr.get_value(f) or "" for f in (gr.fields or ["sys_id"])}
    except Exception as e:
        print(f"  WARN: query against {table} failed: {e}", file=sys.stderr)
    return None


def preview_dictionary_entry(client: ServiceNowClient, art: dict) -> None:
    """For sys_dictionary entries, check whether the target table exists
    and whether the field already exists."""
    # target_name is "<table>.<element>"
    if "." not in art["target_name"]:
        print(f"  ?  Unparseable target_name: {art['target_name']}")
        return
    table, element = art["target_name"].split(".", 1)

    # 1. Target table exists?
    tgt_table = check_target_exists(client, "sys_db_object", {"name": table})
    if tgt_table:
        print(f"  OK  table `{table}` exists")
    else:
        print(f"  !!  table `{table}` NOT FOUND on instance — import will fail")
        return

    # 2. Field already exists?
    existing_col = None
    try:
        gr = client.GlideRecord("sys_dictionary")
        gr.add_query("name", table)
        gr.add_query("element", element)
        gr.fields = ["sys_id", "column_label", "internal_type"]
        gr.limit = 1
        gr.query()
        if gr.next():
            existing_col = {
                "sys_id": gr.get_value("sys_id"),
                "column_label": gr.get_value("column_label"),
                "internal_type": gr.get_value("internal_type"),
            }
    except Exception as e:
        print(f"  WARN: dictionary lookup failed: {e}")

    if existing_col:
        print(f"  ~  field `{table}.{element}` ALREADY EXISTS — import will be an UPDATE")
        print(f"     current: label='{existing_col['column_label']}', type={existing_col['internal_type']}")
    else:
        print(f"  +  field `{table}.{element}` will be CREATED")


def preview_business_rule(client: ServiceNowClient, art: dict) -> None:
    """For sys_script (BRs), check the target table and whether a BR with
    the same name already exists."""
    target_name = art["target_name"]

    # Existing BR by name?
    existing = check_target_exists(client, "sys_script", {"name": target_name})
    if existing:
        print(f"  ~  BR `{target_name}` ALREADY EXISTS (sys_id {existing.get('sys_id', '?')}) — import will be an UPDATE")
    else:
        print(f"  +  BR `{target_name}` will be CREATED")


def preview_by_sys_id(client: ServiceNowClient, table: str, art: dict, label: str) -> None:
    """Generic preview for tables where we have a deterministic sys_id —
    just check whether that sys_id is already present on the target."""
    sys_id = art.get("inner_sys_id")
    if not sys_id:
        print(f"  ?  no inner sys_id parsed; cannot preview")
        return
    existing = check_target_exists(client, table, {"sys_id": sys_id})
    if existing:
        print(f"  ~  {label} (sys_id {sys_id}) ALREADY EXISTS — import will be an UPDATE")
    else:
        print(f"  +  {label} will be CREATED (sys_id {sys_id})")


def preview_catalog_item(client: ServiceNowClient, art: dict) -> None:
    """For sc_cat_item, also verify referenced category + sc_catalogs exist."""
    f = art.get("inner_fields", {})
    name = f.get("name", art["target_name"])
    preview_by_sys_id(client, "sc_cat_item", art, f"catalog item `{name}`")

    cat_sys_id = f.get("category")
    if cat_sys_id:
        cat = check_target_exists(client, "sc_category", {"sys_id": cat_sys_id})
        if cat:
            print(f"     OK  primary category sys_id {cat_sys_id} resolves on target")
        else:
            print(f"     !!  primary category sys_id {cat_sys_id} NOT FOUND on target")

    catalogs_sys_id = f.get("sc_catalogs")
    if catalogs_sys_id:
        cat = check_target_exists(client, "sc_catalog", {"sys_id": catalogs_sys_id})
        if cat:
            print(f"     OK  parent catalog sys_id {catalogs_sys_id} resolves on target")
        else:
            print(f"     !!  parent catalog sys_id {catalogs_sys_id} NOT FOUND on target")


def preview_variable(client: ServiceNowClient, art: dict) -> None:
    f = art.get("inner_fields", {})
    label = f"variable `{f.get('name', art['target_name'])}` on cat_item {f.get('cat_item', '?')[:8]}"
    preview_by_sys_id(client, "item_option_new", art, label)


def preview_question_choice(client: ServiceNowClient, art: dict) -> None:
    f = art.get("inner_fields", {})
    label = f"choice `{f.get('value', '?')}` ({f.get('text', '')}) on question {f.get('question', '?')[:8]}"
    preview_by_sys_id(client, "question_choice", art, label)


def preview_catalog_item_category(client: ServiceNowClient, art: dict) -> None:
    f = art.get("inner_fields", {})
    label = f"category mapping {f.get('sc_cat_item', '?')[:8]} -> {f.get('sc_category', '?')[:8]}"
    preview_by_sys_id(client, "sc_cat_item_category", art, label)


def preview_one(client: ServiceNowClient, art: dict) -> None:
    print(f"\n[{art['type']}] {art['target_name']}")
    print(f"  sys_update_name: {art['sys_update_name']}")
    if art["inner_table"] == "sys_dictionary":
        preview_dictionary_entry(client, art)
    elif art["inner_table"] == "sys_script":
        preview_business_rule(client, art)
    elif art["inner_table"] == "sc_cat_item":
        preview_catalog_item(client, art)
    elif art["inner_table"] == "item_option_new":
        preview_variable(client, art)
    elif art["inner_table"] == "question_choice":
        preview_question_choice(client, art)
    elif art["inner_table"] == "sc_cat_item_category":
        preview_catalog_item_category(client, art)
    else:
        print(f"  ?  no preview handler for inner table: {art['inner_table']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview an update set XML against a live ServiceNow instance.")
    parser.add_argument("xml_path", help="Path to the generated update-set.xml")
    parser.add_argument("--post-import", action="store_true",
                        help="After committing on the instance, verify the artifacts now exist")
    args = parser.parse_args()

    xml_path = Path(args.xml_path)
    if not xml_path.exists():
        print(f"ERROR: file not found: {xml_path}", file=sys.stderr)
        return 1

    client = get_client()
    summary, artifacts = parse_update_set(xml_path)

    print(f"Update set:   {summary['name']}")
    print(f"Application:  {summary['application']}")
    print(f"Artifacts:    {len(artifacts)}")
    print(f"Target:       {os.getenv('SN_INSTANCE')}")

    if args.post_import:
        print("\nPost-import verification mode — checking each artifact landed:\n")
        for art in artifacts:
            print(f"[{art['type']}] {art['target_name']}")
            if art["inner_table"] == "sys_dictionary":
                if "." in art["target_name"]:
                    table, element = art["target_name"].split(".", 1)
                    existing = check_target_exists(client, "sys_dictionary",
                                                   {"name": table, "element": element})
                    print(f"  {'OK' if existing else 'MISSING'}  {table}.{element}")
            elif art["inner_table"] == "sys_script":
                existing = check_target_exists(client, "sys_script", {"name": art["target_name"]})
                print(f"  {'OK' if existing else 'MISSING'}  BR {art['target_name']}")
            elif art["inner_table"] in ("sc_cat_item", "item_option_new",
                                        "question_choice", "sc_cat_item_category"):
                sys_id = art.get("inner_sys_id")
                if sys_id:
                    existing = check_target_exists(client, art["inner_table"], {"sys_id": sys_id})
                    print(f"  {'OK' if existing else 'MISSING'}  {art['inner_table']} sys_id {sys_id}")
                else:
                    print(f"  ?  no inner sys_id to verify")
        return 0

    print("\nPre-import preview — what the import will do on the target instance:")
    for art in artifacts:
        preview_one(client, art)

    print("\nLegend:  +  will be CREATED   ~  will be UPDATED   !!  ERROR   ?  unknown\n")
    print("Compare these findings against ServiceNow's own Preview Update Set output")
    print("on the target instance before clicking Commit Update Set.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
