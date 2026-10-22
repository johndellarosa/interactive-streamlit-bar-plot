"""Validation and net calculations, independent of Streamlit."""

import math
from collections.abc import Mapping, Sequence
from numbers import Real
from itertools import accumulate


def prepare_data(x: Sequence, series: Mapping) -> dict:
    labels = [str(label) for label in x]
    if not labels:
        raise ValueError("x must contain at least one label.")
    if not isinstance(series, Mapping) or not series:
        raise ValueError("series must be a non-empty mapping of names to values.")
    traces = []
    for name, values in series.items():
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Series names must be non-empty strings.")
        values = list(values)
        if len(values) != len(labels):
            raise ValueError(f"Series {name!r} must have {len(labels)} values.")
        if any(isinstance(v, bool) or not isinstance(v, Real) or not math.isfinite(v) for v in values):
            raise ValueError(f"Series {name!r} must contain finite numbers (no missing values).")
        traces.append({"name": name, "values": [float(v) for v in values]})
    return {"x": labels, "series": traces}


def net_values(data: dict, hidden=()) -> list[float]:
    hidden = set(hidden)
    return [sum(s["values"][i] for s in data["series"] if s["name"] not in hidden)
            for i in range(len(data["x"]))]


def cumulative_values(values: Sequence[float]) -> list[float]:
    """Running signed total in the caller's x-axis order."""
    return list(accumulate(values))
