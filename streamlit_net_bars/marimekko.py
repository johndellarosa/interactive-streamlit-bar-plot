"""Interactive Marimekko charts, independent of the net-bar component."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from pathlib import Path

from .style import extract_style
from .appearance import prepare_appearance, appearance_assets
from .model import prepare_data


def prepare_marimekko(categories: Sequence, series: Mapping) -> dict:
    data = prepare_data(categories, series)
    if len(set(data["x"])) != len(data["x"]):
        raise ValueError("Category labels must be unique.")
    if any(value < 0 for s in data["series"] for value in s["values"]):
        raise ValueError("Marimekko values must be nonnegative; negative areas are not supported.")
    if not isfinite(sum(sum(s["values"]) for s in data["series"])):
        raise ValueError("The total of Marimekko values must be finite.")
    return data


@dataclass(frozen=True)
class MarimekkoResult:
    hidden_series: list[str]
    hidden_categories: list[str]
    recalculate: bool
    original_total: float
    visible_total: float
    category_totals: list[dict]


_renderer = None
_asset_version = None


def marimekko_chart(
    categories: Sequence,
    series: Mapping[str, Sequence[float]],
    *,
    key: str,
    title: str = "Market composition",
    height: int = 420,
    on_change: Callable | None = None,
    **appearance,
) -> MarimekkoResult:
    """Plot category widths and segment heights proportional to nonnegative values.

    Click a segment or legend to toggle a series. Category buttons toggle columns.
    Recalculate shares normalizes visible data; Original totals preserves original
    column widths and segment positions, leaving excluded areas empty.
    """
    import streamlit as st

    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError("key must be a non-empty, unique string.")
    if not isinstance(height, int) or not 280 <= height <= 1000:
        raise ValueError("height must be between 280 and 1000 pixels.")
    data = prepare_marimekko(categories, series)
    names = [s["name"] for s in data["series"]]
    saved = st.session_state.get(key, {}).get("selection", {})
    selection = {
        "hidden_series": [n for n in saved.get("hidden_series", []) if n in names],
        "hidden_categories": [n for n in saved.get("hidden_categories", []) if n in data["x"]],
        "recalculate": bool(saved.get("recalculate", True)),
        "history": saved.get("history", []),
    }
    plot_style = extract_style('marimekko', appearance, names)
    appearance = prepare_appearance(appearance)
    assets = Path(__file__).parent / "frontend"
    js = (assets / "marimekko.js").read_text(encoding="utf-8")
    css = (assets / "marimekko.css").read_text(encoding="utf-8")
    js, css = appearance_assets(js, css)
    version = sha256((js + "\0" + css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(
            f"marimekko_{version}", html='<div class="mekko"></div>', js=js, css=css,
        )
        _asset_version = version
    result = _renderer(
        key=key, data={**data, "selection": selection, "title": str(title), "height": height, "appearance": appearance, "plot_style": plot_style},
        default={"selection": selection}, on_selection_change=on_change or (lambda: None),
    )
    current = result.selection or selection
    hidden_series = [n for n in current.get("hidden_series", []) if n in names]
    hidden_categories = [n for n in current.get("hidden_categories", []) if n in data["x"]]
    recalculate = bool(current.get("recalculate", True))
    original_total = sum(sum(s["values"]) for s in data["series"])
    totals = []
    for i, category in enumerate(data["x"]):
        original = sum(s["values"][i] for s in data["series"])
        visible = 0.0 if category in hidden_categories else sum(
            s["values"][i] for s in data["series"] if s["name"] not in hidden_series)
        totals.append({"Category": category, "Original total": original, "Visible total": visible})
    visible_total = sum(row["Visible total"] for row in totals)
    denominator = visible_total if recalculate else original_total
    for row in totals:
        numerator = row["Visible total"] if recalculate else row["Original total"]
        row["Column width (%)"] = numerator / denominator * 100 if denominator else 0.0
    return MarimekkoResult(hidden_series, hidden_categories, recalculate,
                           original_total, visible_total, totals)
