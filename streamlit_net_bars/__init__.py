"""Streamlit component with clickable series and an overlaid net line."""

from pathlib import Path
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256

from .model import cumulative_values, net_values, prepare_data

__all__ = ["net_bar_chart", "NetBarResult"]


@dataclass(frozen=True)
class NetBarResult:
    hidden: list[str]
    visible: list[str]
    net: list[float]
    cumulative: bool = False

    @property
    def line_values(self) -> list[float]:
        """Values currently displayed by the line; net stays per-position."""
        return cumulative_values(self.net) if self.cumulative else list(self.net)


_renderer = None
_renderer_assets = None


def net_bar_chart(
    x: Sequence,
    series: Mapping[str, Sequence[float]],
    *,
    key: str,
    title: str = "Contributions & net",
    height: int = 460,
    on_change: Callable | None = None,
) -> NetBarResult:
    """Render diverging stacked bars. Click any segment to hide its series.

    Positive values stack above zero; negative values stack below zero.
    The line sums all visible series at each x position. Legend buttons toggle
    series and Show all resets visibility. Undo reverses visibility changes.
    The Cumulative net toggle displays a running total in the supplied x order.
    A stable, unique key is required.
    Missing, non-finite, and non-numeric values raise ValueError.
    """
    import streamlit as st

    global _renderer, _renderer_assets
    if not isinstance(key, str) or not key:
        raise ValueError("key must be a non-empty string unique to this chart.")
    if not isinstance(height, int) or not 280 <= height <= 1000:
        raise ValueError("height must be an integer between 280 and 1000.")
    data = prepare_data(x, series)
    names = [s["name"] for s in data["series"]]
    state = st.session_state.get(key, {})
    hidden = [name for name in state.get("hidden", []) if name in names]
    cumulative = bool(state.get("cumulative", False))
    # Historical snapshots refer to series identities, not their numeric data.
    history = [[name for name in snapshot if name in names]
               for snapshot in state.get("history", [])]
    assets = Path(__file__).parent / "frontend"
    css = (assets / "chart.css").read_text(encoding="utf-8")
    js = (assets / "chart.js").read_text(encoding="utf-8")
    asset_version = sha256((css + "\0" + js).encode("utf-8")).hexdigest()[:16]
    # Imported modules persist between reruns. Refresh the renderer when assets
    # change, and version its identity so clients fetch the new definition.
    if _renderer is None or _renderer_assets != asset_version:
        _renderer = st.components.v2.component(
            f"streamlit_net_bars_{asset_version}",
            html='<div class="net-bars"></div>',
            css=css,
            js=js,
        )
        _renderer_assets = asset_version
    result = _renderer(
        key=key,
        data={**data, "hidden": hidden, "history": history, "cumulative": cumulative,
              "title": str(title), "height": height},
        default={"hidden": hidden, "history": history, "cumulative": cumulative},
        on_history_change=lambda: None,
        on_hidden_change=on_change or (lambda: None),
        on_cumulative_change=on_change or (lambda: None),
    )
    hidden = [name for name in (result.hidden or []) if name in names]
    return NetBarResult(hidden, [n for n in names if n not in hidden],
                        net_values(data, hidden), bool(result.cumulative))
