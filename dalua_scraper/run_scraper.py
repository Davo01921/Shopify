#!/usr/bin/env python3
"""Run DALUA scraper with jQuery-compatible Woo Product Table AJAX encoding."""
from __future__ import annotations

import json
import re
from typing import Any

from bs4 import BeautifulSoup
import scrape_dalua as core


def jquery_pairs(prefix: str, value: Any) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            pairs.extend(jquery_pairs(f"{prefix}[{key}]", child))
    elif isinstance(value, list):
        for child in value:
            if isinstance(child, (dict, list)):
                pairs.extend(jquery_pairs(f"{prefix}[]", child))
            else:
                pairs.append((f"{prefix}[]", scalar(child)))
    else:
        pairs.append((prefix, scalar(value)))
    return pairs


def scalar(value: Any) -> str:
    if value is None:
        return ""
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def diagnostic_attributes() -> None:
    s = core.session()
    r = core.get(s, core.TABLE_URL)
    soup = BeautifulSoup(r.text, "lxml")
    table = soup.select_one("table#wpt_table") or soup.select_one("table.wpt_product_table")
    wrapper = table.find_parent(class_=re.compile(r"wpt_product_table_wrapper")) if table else None
    ancestor = table.find_parent(id=re.compile(r"^table_id_")) if table else None
    pagination = soup.select_one(".wpt_table_pagination")
    for label, node in (("TABLE", table), ("WRAPPER", wrapper), ("ANCESTOR", ancestor), ("PAGINATION", pagination)):
        if not node:
            print(f"{label}_ATTRS: <missing>")
            continue
        print(f"{label}_ATTR_KEYS: {list(node.attrs.keys())}")
        for key, value in node.attrs.items():
            text = " ".join(value) if isinstance(value, list) else str(value)
            if str(key).startswith("data-") or label in {"TABLE", "ANCESTOR", "PAGINATION"}:
                print(f"{label}_{key}: {text[:1500]}")


def ajax_page(session, ajax_url: str, temp: str, args: str, page_number: int) -> str:
    try:
        parsed = json.loads(args)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"DALUA table args are not valid JSON: {exc}; prefix={args[:250]!r}") from exc

    fields: list[tuple[str, str]] = [
        ("action", "wpt_query_table_load_by_args"),
        ("temp_number", str(temp)),
    ]
    fields.extend(jquery_pairs("targetTableArgs", parsed))
    fields.extend([
        ("pageNumber", str(page_number)),
        ("load_type", "current_page"),
    ])

    response = session.post(ajax_url, data=fields, timeout=45, allow_redirects=True)
    if response.status_code >= 400:
        raise RuntimeError(
            f"DALUA AJAX HTTP {response.status_code} page {page_number}; "
            f"response={response.text[:500]!r}; arg_keys={list(parsed)[:30] if isinstance(parsed, dict) else type(parsed).__name__}"
        )
    text = response.text.strip()
    if not text or text in {"0", "-1"}:
        raise RuntimeError(f"DALUA AJAX returned no rows for page {page_number}: {text!r}")
    return f"<table><tbody>{text}</tbody></table>"


diagnostic_attributes()
core.ajax_page = ajax_page
raise SystemExit(core.main())
