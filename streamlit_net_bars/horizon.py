"""Compact, interactive horizon plots in a separate Streamlit component."""
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from pathlib import Path

from .style import extract_style
from .appearance import prepare_appearance, appearance_assets
from .model import prepare_data


def prepare_horizon(x: Sequence, series: Mapping, baseline: str = "zero") -> dict:
    if baseline not in ("zero", "mean", "first"):
        raise ValueError("baseline must be 'zero', 'mean', or 'first'.")
    data = prepare_data(x, series)
    for row in data["series"]:
        values = row["values"]
        base = 0.0 if baseline == "zero" else values[0] if baseline == "first" else sum(v / len(values) for v in values)
        deviations = [value - base for value in values]
        if not all(isfinite(v) for v in deviations):
            raise ValueError("Deviations from the baseline must remain finite.")
        row["baseline"] = base
        row["deviations"] = deviations
    return data


@dataclass(frozen=True)
class HorizonResult:
    hidden_series: list[str]
    baseline: str
    scale: str
    bands: int
    start: int
    end: int
    expanded: str | None
    summaries: list[dict]


_renderer = None
_asset_version = None


def horizon_chart(
    x: Sequence,
    series: Mapping[str, Sequence[float]],
    *,
    key: str,
    title: str = "Time-series horizon",
    baseline: str = "zero",
    bands: int = 3,
    row_height: int = 44,
    on_change: Callable | None = None,
    **appearance,
) -> HorizonResult:
    """Fold signed deviations into colored bands. Input order defines x spacing.

    Blue encodes positive and orange negative deviations. Baselines and color
    domains use the complete input so selecting a window does not renormalize
    the colors. Shared scale is the default. Click a row for its ordinary line
    view. Series visibility and controls persist under the provided key.
    """
    import streamlit as st
    global _renderer, _asset_version

    if not isinstance(key, str) or not key:
        raise ValueError("key must be a non-empty, unique string.")
    if isinstance(bands, bool) or not isinstance(bands, int) or not 2 <= bands <= 5:
        raise ValueError("bands must be an integer between 2 and 5.")
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 28 <= row_height <= 100:
        raise ValueError("row_height must be an integer between 28 and 100.")
    data = prepare_horizon(x, series, baseline)
    names = [s["name"] for s in data["series"]]
    saved = st.session_state.get(key, {}).get("selection", {})
    mode = saved.get("baseline", baseline)
    data = prepare_horizon(x, series, mode)
    start = max(0, min(int(saved.get("start", 0)), len(data["x"]) - 1))
    end = max(start, min(int(saved.get("end", len(data["x"]) - 1)), len(data["x"]) - 1))
    selection = {
        "hidden": [n for n in saved.get("hidden", []) if n in names],
        "baseline": mode, "bands": saved.get("bands", bands),
        "scale": saved.get("scale", "shared"), "sort": saved.get("sort", "input"),
        "start": start, "end": end,
        "expanded": saved.get("expanded") if saved.get("expanded") in names else None,
    }
    plot_style = extract_style('horizon', appearance, names)
    appearance = prepare_appearance(appearance)
    assets = Path(__file__).parent / "frontend"
    js = (assets / "horizon.js").read_text(encoding="utf-8")
    css = (assets / "horizon.css").read_text(encoding="utf-8")
    js, css = appearance_assets(js, css)
    version = sha256((js + "\0" + css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f"horizon_{version}", html='<div class="horizon"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={**data, "selection": selection, "title": str(title), "row_height": row_height, "appearance": appearance, "plot_style": plot_style},
                       default={"selection": selection}, on_selection_change=on_change or (lambda: None))
    current = result.selection or selection
    mode = current.get("baseline", baseline)
    transformed = prepare_horizon(x, series, mode)
    hidden = [n for n in current.get("hidden", []) if n in names]
    start = max(0, min(int(current.get("start", 0)), len(data["x"]) - 1))
    end = max(start, min(int(current.get("end", len(data["x"]) - 1)), len(data["x"]) - 1))
    selected_bands = int(current.get("bands", bands))
    scale = current.get("scale", "shared")
    shared_peak = max(abs(v) for row in transformed["series"] for v in row["deviations"])
    summaries = []
    for row in transformed["series"]:
        if row["name"] in hidden:
            continue
        peak = shared_peak if scale == "shared" else max(abs(v) for v in row["deviations"])
        summaries.append({"Series": row["name"], "Baseline": row["baseline"],
                          "Last value": row["values"][end], "Last deviation": row["deviations"][end],
                          "Band width": peak / selected_bands if peak else 0.0})
    return HorizonResult(hidden, mode, scale, selected_bands, start, end, current.get("expanded"), summaries)
