"""Interactive rank trajectories calculated from per-period scores."""
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from .model import prepare_data
from .appearance import appearance_assets, prepare_appearance
from .style import extract_style


def rank_series(data, higher_is_better=True):
    """Competition ranks: equal scores share a rank and leave a gap (1,1,3)."""
    return [{'name': s['name'], 'values': s['values'], 'ranks': [
        1 + sum((other['values'][i] > value if higher_is_better else other['values'][i] < value)
                for other in data['series']) for i, value in enumerate(s['values'])]}
        for s in data['series']]


@dataclass(frozen=True)
class BumpResult:
    selected_series: list[str]
    hidden_series: list[str]
    mode: str
    higher_is_better: bool
    trajectories: list[dict]


_renderer = None
_asset_version = None


def bump_chart(x, series, *, key: str, title='Rank trajectories', height=420,
               higher_is_better=True, mode='rank', on_change=None, **appearance) -> BumpResult:
    """Rank score sequences at each period; input order defines time order.

    All input competitors determine ranks, including hidden competitors. Ties
    use competition ranking (1,1,3). Click trajectories to highlight them; legend
    chips control visibility. Rank 1 is at the top. Values must be finite.
    """
    import streamlit as st
    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(height, bool) or not isinstance(height, int) or not 280 <= height <= 1000:
        raise ValueError('height must be an integer between 280 and 1000.')
    if not isinstance(higher_is_better, bool) or mode not in ('rank', 'value'):
        raise ValueError("higher_is_better must be boolean; mode must be 'rank' or 'value'.")
    data = prepare_data(x, series)
    if len(set(data['x'])) != len(data['x']):
        raise ValueError('Period labels must be unique.')
    values = [v for row in data['series'] for v in row['values']]
    from math import isfinite
    if not isfinite(max(values)-min(values)) or max(abs(v) for v in values)>1e300:
        raise ValueError('Score range is too large to plot safely.')
    names = [s['name'] for s in data['series']]
    saved = st.session_state.get(key, {}).get('selection', {})
    hidden = [n for n in saved.get('hidden', []) if n in names]
    state = {'hidden': hidden, 'selected': [n for n in saved.get('selected', []) if n in names and n not in hidden],
             'mode': saved.get('mode', mode) if saved.get('mode_default', mode) == mode else mode,
             'higher': saved.get('higher', higher_is_better) if saved.get('higher_default', higher_is_better) == higher_is_better else higher_is_better,
             'mode_default': mode, 'higher_default': higher_is_better}
    plot_style = extract_style('bump', appearance, names)
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'bump.js').read_text(encoding='utf-8'), (assets/'bump.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'bump_{version}', html='<div class="bump"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={**data, 'title': str(title), 'height': height, 'selection': state,
                       'plot_style': plot_style, 'appearance': prepare_appearance(appearance)},
                       default={'selection': state}, on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    hidden = [n for n in current.get('hidden', []) if n in names]
    rows = [r for r in rank_series(data, current['higher']) if r['name'] not in hidden]
    return BumpResult([n for n in current.get('selected', []) if n in names and n not in hidden],
                      hidden, current['mode'], current['higher'], rows)
