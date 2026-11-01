"""Interactive longitudinal heatmaps with explicit missing observations."""
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from numbers import Real
from pathlib import Path
from .appearance import appearance_assets, prepare_appearance
import re


def prepare_lasagna(x, series):
    labels = [str(v) for v in x]
    if not labels or len(set(labels)) != len(labels):
        raise ValueError('x must contain unique period labels.')
    if not isinstance(series, Mapping) or not series:
        raise ValueError('series must map subject names to observation sequences.')
    rows = []
    for name, values in series.items():
        values = list(values)
        if not isinstance(name, str) or not name.strip() or len(values) != len(labels):
            raise ValueError('Subject names must be non-empty; each row must match x.')
        if any(v is not None and (isinstance(v, bool) or not isinstance(v, Real) or not isfinite(v) or abs(v)>1e300) for v in values):
            raise ValueError('Observations must be finite numbers or None for missing values.')
        rows.append({'name': name, 'values': [None if v is None else float(v) for v in values]})
    return {'x': labels, 'series': rows}


@dataclass(frozen=True)
class LasagnaResult:
    selected_cells: list[dict]
    hidden_rows: list[str]
    start: int
    end: int
    scale: str
    sort: str
    summaries: list[dict]


_renderer = None
_asset_version = None


def lasagna_chart(x, series, *, key: str, title='Longitudinal observations', row_height=25,
                  scale='raw', palette=('#edf4fa', '#719fc3', '#244d70'),
                  missing_color='#e4e7eb', cell_gap=1, vmin=None, vmax=None,
                  show_values=False, on_change=None, **appearance) -> LasagnaResult:
    """Heatmap subjects over equally spaced periods in input order.

    None marks missing values. Raw and row-centered color domains use all input
    observations, independent of hidden rows or selected time windows. Click
    cells to select them; missing cells can be inspected but are not selected.
    """
    import streamlit as st
    global _renderer, _asset_version
    data = prepare_lasagna(x, series)
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 18 <= row_height <= 80:
        raise ValueError('row_height must be an integer between 18 and 80.')
    if scale not in ('raw', 'centered') or not isinstance(show_values, bool):
        raise ValueError("scale must be 'raw' or 'centered'; show_values must be boolean.")
    if not isinstance(palette, (list, tuple)) or not 2 <= len(palette) <= 9 or any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in [*palette, missing_color]):
        raise ValueError('palette must contain 2–9 #RRGGBB colors; missing_color must be #RRGGBB.')
    if isinstance(cell_gap, bool) or not isinstance(cell_gap, (int, float)) or not isfinite(cell_gap) or not 0 <= cell_gap <= 4:
        raise ValueError('cell_gap must be between 0 and 4 pixels.')
    if (vmin is None) != (vmax is None) or vmin is not None and (
            any(isinstance(v, bool) or not isinstance(v, Real) or not isfinite(v) or abs(v)>1e300 for v in [vmin, vmax]) or vmin >= vmax):
        raise ValueError('Provide both vmin and vmax as finite increasing numbers, or omit both.')
    names = [r['name'] for r in data['series']]
    saved = st.session_state.get(key, {}).get('selection', {})
    start = max(0, min(len(data['x'])-1, int(saved.get('start', 0))))
    end = max(start, min(len(data['x'])-1, int(saved.get('end', len(data['x'])-1))))
    state = {'hidden': [n for n in saved.get('hidden', []) if n in names],
             'selected': saved.get('selected', []) if saved.get('periods', data['x']) == data['x'] else [],
             'periods': data['x'], 'start': start, 'end': end, 'sort': saved.get('sort', 'input'),
             'scale': saved.get('scale', scale) if saved.get('scale_default', scale) == scale else scale, 'scale_default': scale}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'lasagna.js').read_text(encoding='utf-8'), (assets/'lasagna.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'lasagna_{version}', html='<div class="lasagna"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={**data, 'title': str(title), 'row_height': row_height,
                       'selection': state, 'palette': list(palette), 'missing_color': missing_color,
                       'cell_gap': cell_gap, 'vmin': vmin, 'vmax': vmax, 'show_values': show_values,
                       'appearance': prepare_appearance(appearance)}, default={'selection': state},
                       on_selection_change=on_change or (lambda: None))
    state = result.selection or state
    start = max(0, min(len(data['x'])-1, int(state['start'])))
    end = max(start, min(len(data['x'])-1, int(state['end'])))
    hidden = [n for n in state['hidden'] if n in names]
    selected, summaries = [], []
    for row in data['series']:
        if row['name'] in hidden:
            continue
        values = row['values'][start:end+1]
        valid = [v for v in values if v is not None]
        summaries.append({'Subject': row['name'], 'Observed': len(valid), 'Missing': len(values)-len(valid),
                          'Mean': sum(v/len(valid) for v in valid) if valid else None})
        for i in range(start, end+1):
            if row['values'][i] is not None and [row['name'], i] in state['selected']:
                selected.append({'subject': row['name'], 'period': data['x'][i], 'index': i, 'value': row['values'][i]})
    return LasagnaResult(selected, hidden, start, end, state['scale'], state['sort'], summaries)
