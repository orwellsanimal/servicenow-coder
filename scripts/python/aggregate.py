#!/usr/bin/env python3
"""
GlideAggregate-style queries for PySNC.

PySNC (https://github.com/ServiceNow/pysnc) wraps the ServiceNow Table API
(CRUD) but doesn't expose the Stats/Aggregate API at /api/now/stats/{table},
which is the REST equivalent of the server-side GlideAggregate class. This
module fills that gap by reusing PySNC's authenticated session against the
Stats endpoint.

Designed to be a clean companion to PySNC — no dependencies beyond
`pysnc` and `requests` (already a transitive dep of pysnc). Could be
contributed upstream to pysnc as a GlideAggregate sibling.

Library usage:
    from pysnc import ServiceNowClient
    from aggregate import sn_count, sn_aggregate

    client = ServiceNowClient(instance, (user, password))

    # Simple count
    n = sn_count(client, 'incident', query='active=true^priority=1')
    # -> 42

    # Grouped count
    by_priority = sn_count(client, 'incident', query='active=true', group_by='priority')
    # -> {'1 - Critical': 15, '2 - High': 22, '3 - Moderate': 5}

    # Full aggregate (returns structured dict)
    stats = sn_aggregate(
        client, 'incident',
        query='active=true',
        group_by='assignment_group',
        avg_fields='reassignment_count,business_stc',
    )

CLI usage (ad-hoc queries):
    python scripts/python/aggregate.py incident --query "active=true"
    python scripts/python/aggregate.py incident --group-by priority
    python scripts/python/aggregate.py sys_user --group-by identity_type

Reads SN_INSTANCE / SN_USER / SN_PASSWORD from .env when invoked as a CLI.

Grounded against ServiceNow's Aggregate API docs:
    servicenow-docs/markdown/api-reference/rest-apis/c_AggregateAPI.md
"""

from __future__ import annotations

from typing import Union

from pysnc import ServiceNowClient


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _stats_request(client: ServiceNowClient, table: str, params: dict) -> dict:
    """Call /api/now/stats/{table} using PySNC's authenticated session.

    Reuses the client's session so auth, retry, proxy, and cert config
    are all inherited — no separate HTTP setup needed.
    """
    url = f"{client.instance}/api/now/stats/{table}"
    r = client.session.get(url, params=params, headers={"Accept": "application/json"})
    r.raise_for_status()
    return r.json()


def _parse_stats(stats: dict) -> dict:
    """Extract count + agg fields from a stats block, casting numerics."""
    parsed: dict = {}
    if "count" in stats:
        try:
            parsed["count"] = int(stats["count"])
        except (TypeError, ValueError):
            parsed["count"] = stats["count"]
    for agg in ("avg", "sum", "min", "max"):
        if agg in stats:
            # Stats API returns these as string maps {field: stringValue}.
            # Keep as strings — caller decides on float casting since
            # not all fields are numeric (e.g. min/max on dates).
            parsed[agg] = stats[agg]
    return parsed


def _group_key(entry: dict) -> str:
    """Build a stable string key from groupby_fields[].value entries."""
    vals = [gf.get("value", "") or "(empty)" for gf in entry.get("groupby_fields", [])]
    return ", ".join(vals)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def sn_count(
    client: ServiceNowClient,
    table: str,
    query: str = "",
    group_by: str = "",
    display_value: bool = True,
) -> Union[int, dict[str, int]]:
    """Count records in a ServiceNow table, optionally grouped.

    Returns:
        - int for ungrouped counts
        - dict[group_value, int] for grouped counts (preserves API order)

    display_value (default True) maps group keys to human-readable values
    for reference and choice fields. Set False to get raw choice values or
    sys_ids — useful when the keys will be used in further encoded queries.
    """
    params: dict = {"sysparm_count": "true"}
    if query:
        params["sysparm_query"] = query
    if group_by:
        params["sysparm_group_by"] = group_by
        if display_value:
            params["sysparm_display_value"] = "true"

    data = _stats_request(client, table, params)
    result = data.get("result", {})

    if not group_by:
        # Ungrouped: result is an object {stats: {count: "N"}}
        try:
            return int(result.get("stats", {}).get("count", 0))
        except (TypeError, ValueError):
            return 0

    # Grouped: result is a list of {stats, groupby_fields}
    grouped: dict[str, int] = {}
    if isinstance(result, list):
        for entry in result:
            try:
                grouped[_group_key(entry)] = int(entry.get("stats", {}).get("count", 0))
            except (TypeError, ValueError):
                grouped[_group_key(entry)] = 0
    return grouped


def sn_aggregate(
    client: ServiceNowClient,
    table: str,
    query: str = "",
    group_by: str = "",
    count: bool = True,
    sum_fields: str = "",
    avg_fields: str = "",
    min_fields: str = "",
    max_fields: str = "",
    display_value: bool = True,
) -> Union[dict, dict[str, dict]]:
    """Compute aggregate statistics (count/sum/avg/min/max) on a table.

    Returns:
        - dict {'count': int, 'avg': {field: str}, ...} for ungrouped
        - dict {group_value: {...}} for grouped queries

    At least one aggregate must be requested (count=True or one of *_fields).
    """
    if not count and not any([sum_fields, avg_fields, min_fields, max_fields]):
        raise ValueError(
            "At least one aggregate required — set count=True or specify "
            "sum_fields, avg_fields, min_fields, or max_fields."
        )

    params: dict = {}
    if count:
        params["sysparm_count"] = "true"
    if query:
        params["sysparm_query"] = query
    if group_by:
        params["sysparm_group_by"] = group_by
        if display_value:
            params["sysparm_display_value"] = "true"
    if sum_fields:
        params["sysparm_sum_fields"] = sum_fields
    if avg_fields:
        params["sysparm_avg_fields"] = avg_fields
    if min_fields:
        params["sysparm_min_fields"] = min_fields
    if max_fields:
        params["sysparm_max_fields"] = max_fields

    data = _stats_request(client, table, params)
    result = data.get("result", {})

    if not group_by:
        if isinstance(result, dict):
            return _parse_stats(result.get("stats", {}))
        return {}

    grouped: dict[str, dict] = {}
    if isinstance(result, list):
        for entry in result:
            grouped[_group_key(entry)] = _parse_stats(entry.get("stats", {}))
    return grouped


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main() -> int:
    import argparse
    import json
    import os
    import sys
    from pathlib import Path

    from dotenv import load_dotenv

    REPO_ROOT = Path(__file__).resolve().parents[2]
    load_dotenv(REPO_ROOT / ".env")

    parser = argparse.ArgumentParser(description="Ad-hoc ServiceNow aggregate queries via the Stats API.")
    parser.add_argument("table", help="Table name (e.g. incident, sys_user, alm_asset)")
    parser.add_argument("--query", default="", help="Encoded query filter (e.g. 'active=true^priority=1')")
    parser.add_argument("--group-by", default="", help="Field to group by (e.g. priority, identity_type)")
    parser.add_argument("--sum", default="", help="Comma-separated fields to SUM")
    parser.add_argument("--avg", default="", help="Comma-separated fields to AVG")
    parser.add_argument("--min", default="", help="Comma-separated fields to MIN")
    parser.add_argument("--max", default="", help="Comma-separated fields to MAX")
    parser.add_argument("--no-count", action="store_true", help="Omit count from results")
    parser.add_argument("--raw", action="store_true", help="Return raw values (no display labels) on grouped queries")
    args = parser.parse_args()

    instance = os.getenv("SN_INSTANCE")
    user = os.getenv("SN_USER")
    password = os.getenv("SN_PASSWORD")
    if not (instance and user and password):
        print("ERROR: SN_INSTANCE, SN_USER, SN_PASSWORD must be set in .env", file=sys.stderr)
        return 2

    client = ServiceNowClient(instance, (user, password))

    display_value = not args.raw
    any_agg = any([args.sum, args.avg, args.min, args.max])
    if any_agg or args.no_count:
        result = sn_aggregate(
            client, args.table,
            query=args.query,
            group_by=args.group_by,
            count=not args.no_count,
            sum_fields=args.sum,
            avg_fields=args.avg,
            min_fields=args.min,
            max_fields=args.max,
            display_value=display_value,
        )
    else:
        result = sn_count(client, args.table, query=args.query, group_by=args.group_by, display_value=display_value)

    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(_main())
