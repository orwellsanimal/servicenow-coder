#!/usr/bin/env python3
"""
One-shot inspector for a catalog item and its related records.

Used to ground-truth the field set that the catalog_item builder in
build-update-set.js needs to emit. Reads SN_INSTANCE / SN_USER / SN_PASSWORD
from .env.

Usage:
    python scripts/python/inspect-catalog-item.py <sc_cat_item_sys_id>

Prints sc_cat_item fields, related item_option_new variables, their
question_choice values, and any sc_cat_item_category mappings. Output is
JSON to stdout for downstream tooling.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pysnc import ServiceNowClient

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


def get_client() -> ServiceNowClient:
    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set", file=sys.stderr)
        sys.exit(2)
    return ServiceNowClient(instance, (user, password))


def record_to_dict(gr) -> dict:
    """Serialize the current row of a GlideRecord to a dict, omitting empties."""
    raw = gr.serialize() or {}
    return {k: v for k, v in raw.items() if v not in (None, "")}


def main():
    if len(sys.argv) < 2:
        print("Usage: inspect-catalog-item.py <sc_cat_item_sys_id>", file=sys.stderr)
        sys.exit(1)
    sys_id = sys.argv[1]

    client = get_client()

    # 1. sc_cat_item
    item_gr = client.GlideRecord("sc_cat_item")
    if not item_gr.get(sys_id):
        print(f"sc_cat_item sys_id not found: {sys_id}", file=sys.stderr)
        sys.exit(1)
    item = record_to_dict(item_gr)

    # 2. item_option_new (variables for this item)
    variables = []
    var_gr = client.GlideRecord("item_option_new")
    var_gr.add_query("cat_item", sys_id)
    var_gr.order_by("order")
    var_gr.query()
    while var_gr.next():
        v = record_to_dict(var_gr)
        v["_choices"] = []
        # 3. question_choice for this variable
        choice_gr = client.GlideRecord("question_choice")
        choice_gr.add_query("question", v["sys_id"])
        choice_gr.order_by("order")
        choice_gr.query()
        while choice_gr.next():
            v["_choices"].append(record_to_dict(choice_gr))
        variables.append(v)

    # 4. sc_cat_item_category mappings
    cats = []
    cat_gr = client.GlideRecord("sc_cat_item_category")
    cat_gr.add_query("sc_cat_item", sys_id)
    cat_gr.query()
    while cat_gr.next():
        cats.append(record_to_dict(cat_gr))

    print(json.dumps({
        "item": item,
        "variables": variables,
        "categories": cats,
    }, indent=2, default=str))


if __name__ == "__main__":
    main()
