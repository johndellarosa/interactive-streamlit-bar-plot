"""Interactive box plots with reversible observation exclusion."""
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from math import isfinite
from .raincloud import prepare_raincloud, prepare_style
from .appearance import appearance_assets, prepare_appearance


def box_summary(points, whis=1.5):
    values = sorted(p['value'] for p in points)
    if not values:
        return None
    def q(p):
        pos = (len(values)-1)*p
        i, f = int(pos), pos-int(pos)
        return values[i]*(1-f)+values[min(i+1, len(values)-1)]*f
    q1, median, q3 = q(.25), q(.5), q(.75)
    low_fence, high_fence = q1-whis*(q3-q1), q3+whis*(q3-q1)
    return {'count': len(values), 'q1': q1, 'median': median, 'q3': q3,
            'low': min(q1, next((v for v in values if v >= low_fence), q1)),
            'high': max(q3, next((v for v in reversed(values) if v <= high_fence), q3)),
            'mean': sum(v/len(values) for v in values),
            'outlier_ids': [p['id'] for p in points if p['value'] < low_fence or p['value'] > high_fence]}


@dataclass(frozen=True)
class BoxPlotResult:
    selected_ids: list[str]
    selected_points: list[dict]
    excluded_ids: list[str]
    hidden_groups: list[str]
    visible_points: list[dict]
    summaries: list[dict]


_renderer = None
_asset_version = None


def box_plot(groups, *, key: str, ids=None, title='Interactive box plot', row_height=110,
             whis=1.5, colors=None, point_size=3.2, point_alpha=.7, box_alpha=.7,
             jitter=15, show_points=True, show_mean=False, show_grid=True,
             xlim=None, on_change=None, **appearance) -> BoxPlotResult:
    """Select points or quartile value intervals; exclude and undo observations.

    Quartiles use linear interpolation. Whiskers reach observed values within
    whis × IQR. Exclusion recalculates summaries; hiding groups does not exclude
    their observations. The default axis retains the full input domain.
    """
    import streamlit as st
    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 90 <= row_height <= 240:
        raise ValueError('row_height must be an integer between 90 and 240.')
    if isinstance(whis, bool) or not isinstance(whis, (int, float)) or not isfinite(whis) or not 0 <= whis <= 5:
        raise ValueError('whis must be between 0 and 5.')
    if not isinstance(show_mean, bool):
        raise ValueError('show_mean must be boolean.')
    rows = prepare_raincloud(groups, ids)
    names = [r['name'] for r in rows]
    style = prepare_style(names, colors=colors, point_size=point_size, point_alpha=point_alpha,
                          box_alpha=box_alpha, jitter=jitter, show_points=show_points,
                          show_grid=show_grid, xlim=xlim)
    saved = st.session_state.get(key, {}).get('selection', {})
    valid_ids = {p['id'] for r in rows for p in r['points']}
    state = {'hidden': [n for n in saved.get('hidden', []) if n in names],
             'selected': [i for i in saved.get('selected', []) if i in valid_ids],
             'excluded': [i for i in saved.get('excluded', []) if i in valid_ids],
             'history': [[i for i in h if i in valid_ids] for h in saved.get('history', [])],
             'fixed': saved.get('fixed', True)}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'box.js').read_text(encoding='utf-8'), (assets/'box.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'box_{version}', html='<div class="box-plot"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={'groups': rows, 'title': str(title), 'row_height': row_height,
                       'whis': whis, 'show_mean': show_mean, 'style': style, 'selection': state,
                       'appearance': prepare_appearance(appearance)}, default={'selection': state},
                       on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    hidden = [n for n in current['hidden'] if n in names]
    excluded = [i for i in current['excluded'] if i in valid_ids]
    points, summaries = [], []
    for r in rows:
        if r['name'] in hidden:
            continue
        retained = [p for p in r['points'] if p['id'] not in excluded]
        points.extend({'group': r['name'], **p} for p in retained)
        summaries.append({'group': r['name'], 'summary': box_summary(retained, whis)})
    selected = [p for p in points if p['id'] in current['selected']]
    return BoxPlotResult([p['id'] for p in selected], selected, excluded, hidden, points, summaries)
