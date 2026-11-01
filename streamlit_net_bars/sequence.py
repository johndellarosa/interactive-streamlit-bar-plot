"""Categorical longitudinal sequence index plots."""
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from math import isfinite
import re
from .appearance import appearance_assets, prepare_appearance


def prepare_sequences(x, sequences, state_order=None):
    periods = [str(p) for p in x]
    if not periods or len(set(periods)) != len(periods):
        raise ValueError('x must contain unique period labels.')
    if not isinstance(sequences, Mapping) or not sequences:
        raise ValueError('sequences must map subject names to categorical sequences.')
    rows, states = [], []
    for name, values in sequences.items():
        if not isinstance(name, str) or not name.strip() or isinstance(values, (str, bytes)):
            raise ValueError('Subject names must be non-empty and sequences must be lists of states.')
        values = list(values)
        if len(values) != len(periods) or any(v is not None and (not isinstance(v, str) or not v.strip()) for v in values):
            raise ValueError('Each sequence must match x and contain non-empty strings or None for missing states.')
        for value in values:
            if value is not None and value not in states:
                states.append(value)
        rows.append({'name': name, 'values': values})
    order = states if state_order is None else list(state_order)
    if len(order) != len(states) or any(not isinstance(v, str) for v in order) or set(order) != set(states):
        raise ValueError('state_order must contain each observed state exactly once.')
    return {'x': periods, 'rows': rows, 'states': order}


def transitions(values):
    return [(a, b) for a, b in zip(values, values[1:]) if a is not None and b is not None and a != b]


@dataclass(frozen=True)
class SequenceResult:
    selected_subjects: list[str]
    visible_subjects: list[str]
    inspected_cell: dict | None
    start: int
    end: int
    contains: str | None
    transition: list[str] | None
    summaries: list[dict]


_renderer = None
_asset_version = None


def sequence_chart(x, sequences, *, key: str, title='Categorical sequences', state_order=None,
                   colors=None, missing_color='#e4e7eb', row_height=27, cell_gap=1,
                   show_labels=False, on_change=None, **appearance) -> SequenceResult:
    """Merge repeated states into runs. Missing observations break transitions.

    Filters/sorting use complete sequences, independently of the display window.
    Click a run to inspect a period and toggle that subject's selection.
    """
    import streamlit as st
    global _renderer, _asset_version
    data = prepare_sequences(x, sequences, state_order)
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 18 <= row_height <= 80:
        raise ValueError('row_height must be an integer between 18 and 80.')
    if isinstance(cell_gap, bool) or not isinstance(cell_gap, (int, float)) or not isfinite(cell_gap) or not 0 <= cell_gap <= 4 or not isinstance(show_labels, bool):
        raise ValueError('cell_gap must be between 0 and 4; show_labels must be boolean.')
    colors = {} if colors is None else colors
    if not isinstance(colors, Mapping) or set(colors)-set(data['states']) or any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in [*colors.values(), missing_color]):
        raise ValueError('colors must map known states to #RRGGBB colors; missing_color must be hex.')
    names = [r['name'] for r in data['rows']]
    saved = st.session_state.get(key, {}).get('selection', {})
    start = max(0, min(len(data['x'])-1, int(saved.get('start', 0))))
    end = max(start, min(len(data['x'])-1, int(saved.get('end', len(data['x'])-1))))
    same_periods = saved.get('periods', data['x'])==data['x']
    state = {'selected': [n for n in saved.get('selected', []) if n in names],
             'contains': saved.get('contains') if saved.get('contains') in data['states'] else None,
             'transition': saved.get('transition') if saved.get('transition') and all(v in data['states'] for v in saved['transition']) else None,
             'sort': saved.get('sort', 'input'), 'start': start, 'end': end,
             'inspect': saved.get('inspect') if same_periods else None, 'periods': data['x']}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'sequence.js').read_text(encoding='utf-8'), (assets/'sequence.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'sequence_{version}', html='<div class="sequence"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={**data, 'selection': state, 'title': str(title), 'colors': dict(colors),
                       'missing_color': missing_color, 'row_height': row_height, 'cell_gap': cell_gap,
                       'show_labels': show_labels, 'appearance': prepare_appearance(appearance)},
                       default={'selection': state}, on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    start = max(0, min(len(data['x'])-1, int(current['start'])))
    end = max(start, min(len(data['x'])-1, int(current['end'])))
    visible = [r for r in data['rows'] if (not current['contains'] or current['contains'] in r['values']) and
               (not current['transition'] or tuple(current['transition']) in transitions(r['values']))]
    order = {v: i for i, v in enumerate(data['states'])}
    if current['sort']=='transitions':
        visible.sort(key=lambda r: -len(transitions(r['values'])))
    elif current['sort']=='sequence':
        visible.sort(key=lambda r: [order.get(v, len(order)) for v in r['values']])
    inspected = None
    if isinstance(current.get('inspect'), list) and len(current['inspect'])==2:
        name, i = current['inspect']
        row = next((r for r in visible if r['name']==name), None)
        if row and isinstance(i, int) and start <= i <= end:
            inspected = {'subject': name, 'period': data['x'][i], 'index': i, 'state': row['values'][i]}
    summaries = [{'subject': r['name'], 'transitions': len(transitions(r['values'])),
                  'missing_in_window': sum(v is None for v in r['values'][start:end+1])} for r in visible]
    return SequenceResult([r['name'] for r in visible if r['name'] in current['selected']], [r['name'] for r in visible],
                          inspected, start, end, current['contains'], current['transition'], summaries)
