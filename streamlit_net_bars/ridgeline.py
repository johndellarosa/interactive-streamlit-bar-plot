"""Interactive ridgeline distributions using shared Gaussian KDE utilities."""
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from numbers import Real
from pathlib import Path
from .raincloud import prepare_raincloud, prepare_style
from .box import box_summary
from .appearance import appearance_assets, prepare_appearance
import re


@dataclass(frozen=True)
class RidgelineResult:
    selected_groups: list[str]
    selected_ids: list[str]
    selected_points: list[dict]
    hidden_groups: list[str]
    value_range: list[float] | None
    smoothing: float
    overlap: float
    sort: str
    summaries: list[dict]


_renderer = None
_asset_version = None


def ridgeline_chart(groups, *, key: str, ids=None, title='Ridgeline distributions',
                    row_height=52, smoothing=1.0, overlap=1.2, colors=None,
                    fill_opacity=.7, line_width=1.5, selected_color='#d89432',
                    show_median=True, show_grid=True, xlim=None, on_change=None,
                    **appearance) -> RidgelineResult:
    """Compare equal-peak density shapes, select groups, or brush a value range.

    Selected records satisfy the range AND selected groups, when supplied.
    A range alone selects across all visible groups; no active selection returns
    no records. Hidden groups are excluded from selection. Singleton/constant
    groups show a marker rather than an invented density.
    """
    import streamlit as st
    global _renderer, _asset_version
    rows = prepare_raincloud(groups, ids)
    names = [r['name'] for r in rows]
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 35 <= row_height <= 120:
        raise ValueError('row_height must be an integer between 35 and 120.')
    for name, value, low, high in [('smoothing', smoothing, .3, 3), ('overlap', overlap, .5, 2.5),
                                  ('fill_opacity', fill_opacity, 0, 1), ('line_width', line_width, 0, 8)]:
        if isinstance(value, bool) or not isinstance(value, Real) or not isfinite(value) or not low <= value <= high:
            raise ValueError(f'{name} must be a finite number between {low} and {high}.')
    if not isinstance(show_median, bool) or not isinstance(selected_color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', selected_color):
        raise ValueError('show_median must be boolean; selected_color must be #RRGGBB.')
    style = prepare_style(names, colors=colors, show_grid=show_grid, xlim=xlim)
    saved = st.session_state.get(key, {}).get('selection', {})
    hidden = [n for n in saved.get('hidden', []) if n in names]
    state = {'hidden': hidden, 'selected': [n for n in saved.get('selected', []) if n in names and n not in hidden],
             'range': saved.get('range'), 'sort': saved.get('sort', 'input'), 'mode': saved.get('mode', 'groups'),
             'smoothing': saved.get('smoothing', smoothing) if saved.get('smoothing_default', smoothing)==smoothing else smoothing,
             'smoothing_default': smoothing,
             'overlap': saved.get('overlap', overlap) if saved.get('overlap_default', overlap)==overlap else overlap,
             'overlap_default': overlap}
    assets = Path(__file__).parent/'frontend'
    js = (assets/'distribution.js').read_text(encoding='utf-8')+(assets/'ridgeline.js').read_text(encoding='utf-8')
    js, css = appearance_assets(js, (assets/'ridgeline.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'ridgeline_{version}', html='<div class="ridgeline"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={'groups': rows, 'title': str(title), 'row_height': row_height,
                       'fill_opacity': fill_opacity, 'line_width': line_width, 'selected_color': selected_color,
                       'show_median': show_median, 'style': style, 'selection': state,
                       'appearance': prepare_appearance(appearance)}, default={'selection': state},
                       on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    hidden = [n for n in current['hidden'] if n in names]
    selected = [n for n in current['selected'] if n in names and n not in hidden]
    value_range = current.get('range')
    visible = [r for r in rows if r['name'] not in hidden]
    summaries = []
    for row in visible:
        summary = box_summary(row['points'])
        summaries.append({'group': row['name'], 'count': len(row['points']),
                          'mean': summary['mean'] if summary else None, 'median': summary['median'] if summary else None})
    if current['sort'] in ('mean', 'median'):
        summaries.sort(key=lambda r: (r[current['sort']] is None, -(r[current['sort']] or 0)))
    points = [{'group': r['name'], **p} for r in visible for p in r['points'] if
              (selected or value_range is not None) and (not selected or r['name'] in selected) and
              (value_range is None or value_range[0] <= p['value'] <= value_range[1])]
    return RidgelineResult(selected, [p['id'] for p in points], points, hidden, value_range,
                           current['smoothing'], current['overlap'], current['sort'], summaries)
