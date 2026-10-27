"""Linked paired observations and change distributions."""
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from pathlib import Path

from .style import extract_style
from .appearance import prepare_appearance, appearance_assets
from .model import prepare_data


def prepare_pairs(before: Sequence, after: Sequence, ids=None, groups=None) -> list[dict]:
    before, after = list(before), list(after)
    labels = list(ids) if ids is not None else [f"Pair {i+1}" for i in range(len(before))]
    data = prepare_data(labels, {"Before": before, "After": after})
    if len(set(data["x"])) != len(data["x"]):
        raise ValueError("Pair IDs must be unique.")
    groups = list(groups) if groups is not None else ["All pairs"] * len(labels)
    if len(groups) != len(labels) or any(not isinstance(g, str) or not g.strip() for g in groups):
        raise ValueError("groups must contain one non-empty string per pair.")
    rows = []
    for i, label in enumerate(data["x"]):
        a, b = data["series"][0]["values"][i], data["series"][1]["values"][i]
        if not isfinite(b-a):
            raise ValueError("Paired differences must be finite.")
        rows.append({"id": label, "group": groups[i], "before": a, "after": b, "change": b-a})
    values = before + after
    if not isfinite(max(values)-min(values)):
        raise ValueError("The combined value range must be finite.")
    return rows


def pair_summary(rows: list[dict]) -> dict:
    n = len(rows)
    changes = sorted(row["change"] for row in rows)
    middle = changes[n//2:n//2+1] if n % 2 else changes[max(0, n//2-1):n//2+1]
    return {"count": n,
            "mean_before": sum(row["before"]/n for row in rows) if n else None,
            "mean_after": sum(row["after"]/n for row in rows) if n else None,
            "mean_change": sum(row["change"]/n for row in rows) if n else None,
            "median_change": sum(v/len(middle) for v in middle) if n else None,
            "increased": sum(row["change"] > 0 for row in rows),
            "decreased": sum(row["change"] < 0 for row in rows),
            "unchanged": sum(row["change"] == 0 for row in rows)}


@dataclass(frozen=True)
class PairedChangeResult:
    selected_ids: list[str]
    excluded_ids: list[str]
    hidden_groups: list[str]
    visible_pairs: list[dict]
    summary: dict
    selected_summary: dict


_renderer = None
_asset_version = None


def paired_change_chart(
    before: Sequence[float], after: Sequence[float], *, key: str,
    ids: Sequence[str] | None = None, groups: Sequence[str] | None = None,
    title: str = "Paired change distribution", before_label: str = "Before",
    after_label: str = "After", height: int = 390, on_change: Callable | None = None, **appearance,
) -> PairedChangeResult:
    """Display linked before/after pairs and a histogram of within-pair changes.

    IDs must be unique and all observations finite. Incomplete pairs are rejected.
    Select a pair or histogram bin to highlight observations in both panels.
    Group/direction filters and exclusion operate on whole pairs. Descriptive
    statistics use visible pairs; no independence assumptions or inference are
    made. Domains use the full input to keep comparisons stable when filtering.
    """
    import streamlit as st
    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError("key must be a non-empty, unique string.")
    if isinstance(height, bool) or not isinstance(height, int) or not 280 <= height <= 1000:
        raise ValueError("height must be an integer between 280 and 1000.")
    rows = prepare_pairs(before, after, ids, groups)
    valid_ids = {r["id"] for r in rows}
    valid_groups = list(dict.fromkeys(r["group"] for r in rows))
    saved = st.session_state.get(key, {}).get("selection", {})
    selection = {
        "selected": [i for i in saved.get("selected", []) if i in valid_ids],
        "excluded": [i for i in saved.get("excluded", []) if i in valid_ids],
        "hidden_groups": [g for g in saved.get("hidden_groups", []) if g in valid_groups],
        "direction": saved.get("direction", "all"), "bins": saved.get("bins", 10),
        "color": saved.get("color", "change"),
    }
    plot_style = extract_style('paired_change', appearance, valid_groups)
    appearance = prepare_appearance(appearance)
    assets = Path(__file__).parent / "frontend"
    js = (assets / "paired_change.js").read_text(encoding="utf-8")
    css = (assets / "paired_change.css").read_text(encoding="utf-8")
    js, css = appearance_assets(js, css)
    version = sha256((js + "\0" + css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f"paired_change_{version}",
            html='<div class="paired-change"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={"rows": rows, "groups": valid_groups, "selection": selection,
        "title": str(title), "before_label": str(before_label), "after_label": str(after_label), "height": height, "appearance": appearance, "plot_style": plot_style},
        default={"selection": selection}, on_selection_change=on_change or (lambda: None))
    state = result.selection or selection
    excluded = [i for i in state.get("excluded", []) if i in valid_ids]
    hidden = [g for g in state.get("hidden_groups", []) if g in valid_groups]
    direction = state.get("direction", "all")
    visible = [r for r in rows if r["id"] not in excluded and r["group"] not in hidden and (
        direction == "all" or direction == "increase" and r["change"] > 0 or
        direction == "decrease" and r["change"] < 0 or direction == "unchanged" and r["change"] == 0)]
    selected = [r for r in visible if r["id"] in state.get("selected", [])]
    return PairedChangeResult([r["id"] for r in selected], excluded, hidden, visible,
                              pair_summary(visible), pair_summary(selected))
