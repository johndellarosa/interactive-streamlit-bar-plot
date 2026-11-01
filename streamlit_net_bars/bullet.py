"""Interactive performance bullet charts."""
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from numbers import Real
from pathlib import Path
import re
from .appearance import appearance_assets, prepare_appearance


def prepare_bullets(values, targets, ranges=None, higher_is_better=True):
    if not isinstance(values, Mapping) or not values or any(not isinstance(n, str) or not n.strip() for n in values):
        raise ValueError('values must map non-empty metric names to measurements.')
    if not isinstance(targets, Mapping) or set(targets) != set(values):
        raise ValueError('targets must contain exactly the metric names in values.')
    if ranges is not None and (not isinstance(ranges, Mapping) or set(ranges)-set(values)):
        raise ValueError('ranges must map known metric names to three increasing upper bounds.')
    if not isinstance(higher_is_better, bool):
        raise ValueError('higher_is_better must be boolean.')
    def valid(v):
        return not isinstance(v, bool) and isinstance(v, Real) and isfinite(v) and 0 <= v <= 1e300
    rows = []
    for name, value in values.items():
        target = targets[name]
        if not valid(value) or not valid(target):
            raise ValueError('Measurements and targets must be finite nonnegative numbers.')
        maximum = max(value, target) or 1
        edges = list(ranges[name]) if ranges is not None and name in ranges else [maximum*.6, maximum*.8, maximum]
        if len(edges) != 3 or not all(valid(v) and v > 0 for v in edges) or not edges[0] < edges[1] < edges[2]:
            raise ValueError('Each range must contain exactly three positive increasing upper bounds.')
        rows.append({'name': name, 'value': float(value), 'target': float(target), 'ranges': [float(v) for v in edges]})
    return rows


@dataclass(frozen=True)
class BulletResult:
    selected_metrics: list[str]
    visible_metrics: list[dict]
    targets: dict[str, float]
    shared_scale: bool
    filter: str


_renderer = None
_asset_version = None


def bullet_chart(values, targets, *, key: str, ranges=None, title='Performance against targets',
                 higher_is_better=True, shared_scale=False, editable_targets=False, row_height=105,
                 colors=None, range_colors=('#e3e9ef', '#c7d4e0', '#a6bdd0'),
                 target_color='#243247', show_values=True, on_change=None, **appearance) -> BulletResult:
    """Compare nonnegative measurements with targets and three qualitative bands.

    Individual axes are the default; use shared_scale only for comparable units.
    Edited targets are session overrides returned to Python, never input edits.
    Qualitative bands keep their supplied order when ranking direction changes.
    """
    import streamlit as st
    global _renderer, _asset_version
    rows = prepare_bullets(values, targets, ranges, higher_is_better)
    names = list(values)
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if any(not isinstance(v, bool) for v in [shared_scale, editable_targets, show_values]):
        raise ValueError('shared_scale, editable_targets and show_values must be boolean.')
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 80 <= row_height <= 180:
        raise ValueError('row_height must be an integer between 80 and 180.')
    colors = {} if colors is None else colors
    if not isinstance(colors, Mapping) or set(colors)-set(names):
        raise ValueError('colors must map known metrics to hex colors.')
    if not isinstance(range_colors, (list, tuple)) or len(range_colors) != 3 or any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in [*range_colors, target_color, *colors.values()]):
        raise ValueError('Provide three range_colors and other colors as #RRGGBB.')
    saved = st.session_state.get(key, {}).get('selection', {})
    originals = {r['name']: r['target'] for r in rows}
    overrides = {n: v for n, v in saved.get('targets', {}).items() if editable_targets and n in names and
                 isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v) and 0 <= v <= 1e300
                 and saved.get('original_targets', originals).get(n)==originals[n]}
    state = {'selected': [n for n in saved.get('selected', []) if n in names], 'targets': overrides,
             'original_targets': originals, 'filter': saved.get('filter', 'all'), 'sort': saved.get('sort', 'input'),
             'shared': saved.get('shared', shared_scale) if saved.get('shared_default', shared_scale)==shared_scale else shared_scale,
             'shared_default': shared_scale}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'bullet.js').read_text(encoding='utf-8'), (assets/'bullet.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'bullet_{version}', html='<div class="bullet"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={'rows': rows, 'selection': state, 'title': str(title),
                       'higher': higher_is_better, 'editable_targets': editable_targets, 'row_height': row_height,
                       'colors': dict(colors), 'range_colors': list(range_colors), 'target_color': target_color,
                       'show_values': show_values, 'appearance': prepare_appearance(appearance)},
                       default={'selection': state}, on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    effective_targets = {n: v for n, v in current.get('targets', {}).items() if editable_targets and n in names and
                         isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v) and 0 <= v <= 1e300 and
                         current.get('original_targets', originals).get(n)==originals[n]}
    computed = []
    for row in rows:
        target = effective_targets.get(row['name'], row['target'])
        met = row['value'] >= target if higher_is_better else row['value'] <= target
        if current['filter']=='met' and not met or current['filter']=='missed' and met:
            continue
        computed.append({**row, 'target': target, 'met': met, 'gap': row['value']-target})
    if current.get('sort') in ('value', 'gap'):
        computed.sort(key=lambda r: r[current['sort']], reverse=True)
    return BulletResult([r['name'] for r in computed if r['name'] in current['selected']], computed,
                        {r['name']: effective_targets.get(r['name'], r['target']) for r in rows},
                        current['shared'], current['filter'])
