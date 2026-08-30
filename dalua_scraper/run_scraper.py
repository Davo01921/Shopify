#!/usr/bin/env python3
"""Run DALUA scraper with jQuery-compatible Woo Product Table AJAX encoding."""
from __future__ import annotations

import json
from typing import Any

import scrape_dalua as core


def jquery_pairs(prefix: str, value: Any) -> list[tuple[str, str]]:
    """Approximate jQuery.param() recursive serialization used by WPT."""
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


core.ajax_page = ajax_page
raise SystemExit(core.main())
