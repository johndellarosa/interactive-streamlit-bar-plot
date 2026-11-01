"""Interactive shared-bin histograms with reversible record filtering."""
from dataclasses import dataclass
from pathlib import Path
from hashlib import sha256
from bisect import bisect_right
from .raincloud import prepare_raincloud, prepare_style
from .appearance import appearance_assets, prepare_appearance


def histogram_bins(rows, state, bins=20):
    original = [dict(p, group=r['name']) for r in rows for p in r['points']]
    visible = [p for p in original if p['group'] not in state.get('hidden', []) and p['id'] not in state.get('excluded', [])]
    values = [p['value'] for p in original]
    low, high = (min(values), max(values)) if values else (0, 1)
    if low == high:
        pad = abs(low)*.1 or 1
        low, high = low-pad, high+pad
    count = state.get('bins', bins)
    edges = [low+(high-low)*i/count for i in range(count+1)]
    result = [{'low': edges[i], 'high': edges[i+1], 'count': 0, 'ids': [], 'value': 0.0} for i in range(count)]
    for p in visible:
        i = max(0, min(count-1, bisect_right(edges, p['value'])-1))
        result[i]['count'] += 1
        result[i]['ids'].append(p['id'])
    for b in result:
        mode = state.get('normalization', 'count')
        b['value'] = b['count'] if mode == 'count' else b['count']/len(visible)*(100 if mode=='percent' else 1/(b['high']-b['low'])) if visible else 0.0
    return visible, result


@dataclass(frozen=True)
class HistogramResult:
    selected_ids: list[str]
    selected_points: list[dict]
    excluded_ids: list[str]
    hidden_groups: list[str]
    visible_points: list[dict]
    bins: list[dict]
    normalization: str


_renderer = None
_asset_version = None


def histogram_chart(groups, *, key: str, ids=None, title='Interactive histogram', height=400,
                    bins=20, normalization='count', colors=None, bar_opacity=.8,
                    show_grid=True, show_reference=True, bar_gap=2, tick_count=5,
                    selected_color='#d89432', reference_color=None,
                    show_bin_counts=False, on_change=None, **appearance) -> HistogramResult:
    """Stack groups in shared bins. Click bins to toggle their record selection.

    Bin edges always use the full input range, preserving comparisons after
    filtering. All bins are left-inclusive/right-exclusive except the last,
    which includes the maximum. Percent and density normalize all visible groups
    together. Selection identities persist through rebinning.
    """
    import streamlit as st
    from math import isfinite
    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(height, bool) or not isinstance(height, int) or not 280 <= height <= 1000:
        raise ValueError('height must be an integer between 280 and 1000.')
    if isinstance(bins, bool) or not isinstance(bins, int) or not 1 <= bins <= 100:
        raise ValueError('bins must be an integer between 1 and 100.')
    if normalization not in ('count', 'percent', 'density'):
        raise ValueError('normalization must be count, percent, or density.')
    if isinstance(bar_opacity, bool) or not isinstance(bar_opacity, (int, float)) or not isfinite(bar_opacity) or not 0 <= bar_opacity <= 1 or not isinstance(show_reference, bool):
        raise ValueError('bar_opacity must be between 0 and 1; show_reference must be boolean.')
    if isinstance(bar_gap, bool) or not isinstance(bar_gap, (int, float)) or not isfinite(bar_gap) or not 0 <= bar_gap <= 20:
        raise ValueError('bar_gap must be between 0 and 20 pixels.')
    if isinstance(tick_count, bool) or not isinstance(tick_count, int) or not 2 <= tick_count <= 12:
        raise ValueError('tick_count must be an integer between 2 and 12.')
    import re
    if any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in [selected_color]+([reference_color] if reference_color is not None else [])) or not isinstance(show_bin_counts, bool):
        raise ValueError('selected/reference colors must be #RRGGBB; show_bin_counts must be boolean.')
    rows = prepare_raincloud(groups, ids)
    names = [r['name'] for r in rows]
    style = prepare_style(names, colors=colors, show_grid=show_grid)
    saved = st.session_state.get(key, {}).get('selection', {})
    valid_ids = {p['id'] for r in rows for p in r['points']}
    state = {'hidden': [n for n in saved.get('hidden', []) if n in names],
             'selected': [i for i in saved.get('selected', []) if i in valid_ids],
             'excluded': [i for i in saved.get('excluded', []) if i in valid_ids],
             'history': [[i for i in h if i in valid_ids] for h in saved.get('history', [])],
             'bins': saved.get('bins', bins) if saved.get('bins_default', bins)==bins else bins, 'bins_default': bins,
             'normalization': saved.get('normalization', normalization) if saved.get('normalization_default', normalization)==normalization else normalization,
             'normalization_default': normalization}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'histogram.js').read_text(encoding='utf-8'), (assets/'histogram.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'histogram_{version}', html='<div class="histogram"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={'groups': rows, 'selection': state, 'title': str(title), 'height': height,
                       'style': style, 'bar_opacity': bar_opacity, 'show_reference': show_reference,
                       'bar_gap': bar_gap, 'tick_count': tick_count, 'selected_color': selected_color,
                       'reference_color': reference_color, 'show_bin_counts': show_bin_counts,
                       'appearance': prepare_appearance(appearance)}, default={'selection': state},
                       on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    visible, computed = histogram_bins(rows, current, bins)
    selected = [p for p in visible if p['id'] in current['selected']]
    return HistogramResult([p['id'] for p in selected], selected, current['excluded'], current['hidden'],
                           visible, computed, current['normalization'])
