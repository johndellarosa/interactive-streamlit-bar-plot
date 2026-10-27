"""Raincloud distributions with selectable observations."""
from dataclasses import dataclass
from collections.abc import Mapping
from hashlib import sha256
from math import isfinite
from pathlib import Path
import re
from .appearance import appearance_assets, prepare_appearance


def prepare_raincloud(groups, ids=None):
    if not isinstance(groups, Mapping) or not groups:
        raise ValueError('groups must map non-empty group names to numeric observations.')
    if ids is not None and (not isinstance(ids, Mapping) or set(ids) != set(groups)):
        raise ValueError('ids must contain exactly the group names in groups.')
    rows, seen = [], set()
    for name, values in groups.items():
        if not isinstance(name, str) or not name.strip() or isinstance(values, (str, bytes)):
            raise ValueError('Group names must be non-empty strings and values numeric sequences.')
        values = list(values)
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not isfinite(v) for v in values):
            raise ValueError('Observations must be finite numbers; remove missing values first.')
        labels = list(ids[name]) if ids is not None else [f'{name}:{i+1}' for i in range(len(values))]
        if len(labels) != len(values) or any(not isinstance(i, str) or not i for i in labels):
            raise ValueError('Provide one non-empty string ID per observation.')
        if len(set(labels)) != len(labels) or seen.intersection(labels):
            raise ValueError('Observation IDs must be unique across all groups.')
        seen.update(labels)
        rows.append({'name': name, 'points': [{'id': i, 'value': v} for i, v in zip(labels, values)]})
    values = [p['value'] for r in rows for p in r['points']]
    if values and (not isfinite(max(values)-min(values)) or max(abs(v) for v in values)>1e300):
        raise ValueError('Observation range is too large to plot safely.')
    return rows


@dataclass(frozen=True)
class RaincloudResult:
    selected_ids: list[str]
    selected_points: list[dict]
    hidden_groups: list[str]
    visible_points: list[dict]
    smoothing: float


_renderer = None
_asset_version = None


def prepare_style(names, *, colors=None, point_size=3.2, point_alpha=.7,
                  cloud_alpha=.45, box_alpha=.7, jitter=15, show_density=True,
                  show_box=True, show_points=True, show_grid=True, xlim=None,
                  tick_count=5, group_order=None):
    options = dict(point_size=point_size, point_alpha=point_alpha, cloud_alpha=cloud_alpha,
                   box_alpha=box_alpha, jitter=jitter, show_density=show_density,
                   show_box=show_box, show_points=show_points, show_grid=show_grid,
                   tick_count=tick_count)
    for name, low, high in [('point_size', 1, 12), ('point_alpha', 0, 1),
                            ('cloud_alpha', 0, 1), ('box_alpha', 0, 1), ('jitter', 0, 24)]:
        value = options[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not low <= value <= high:
            raise ValueError(f'{name} must be a finite number between {low} and {high}.')
    for name in ['show_density', 'show_box', 'show_points', 'show_grid']:
        if not isinstance(options[name], bool):
            raise ValueError(f'{name} must be a boolean.')
    if isinstance(tick_count, bool) or not isinstance(tick_count, int) or not 2 <= tick_count <= 12:
        raise ValueError('tick_count must be an integer between 2 and 12.')
    colors = {} if colors is None else colors
    if not isinstance(colors, Mapping) or set(colors)-set(names) or any(
            not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in colors.values()):
        raise ValueError('colors must map known group names to #RRGGBB hex colors.')
    options['colors'] = dict(colors)
    if xlim is not None:
        xlim = list(xlim)
        if len(xlim) != 2 or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not isfinite(v) for v in xlim) or not xlim[0] < xlim[1] or not isfinite(xlim[1]-xlim[0]):
            raise ValueError('xlim must contain two finite increasing numbers with a finite span.')
    options['xlim'] = xlim
    order = list(names) if group_order is None else list(group_order)
    if len(order) != len(names) or set(order) != set(names):
        raise ValueError('group_order must list every group exactly once.')
    options['group_order'] = order
    return options


def raincloud_chart(groups: Mapping, *, key: str, ids: Mapping | None = None,
                    title='Group distributions', row_height=145, smoothing=1.0,
                    colors=None, point_size=3.2, point_alpha=.7, cloud_alpha=.45,
                    box_alpha=.7, jitter=15, show_density=True, show_box=True,
                    show_points=True, show_grid=True, xlim=None, tick_count=5,
                    group_order=None,
                    on_change=None, **appearance) -> RaincloudResult:
    """Combine Gaussian KDE half-densities, Tukey boxes and jittered observations.

    Groups may differ in size. IDs identify independent observations, not matched
    subjects. Selection and group visibility persist with a stable key. Density
    curves have equal peak heights, so compare shape rather than sample size.
    Single and constant groups display points and boxes without a density.
    """
    import streamlit as st
    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(row_height, bool) or not isinstance(row_height, int) or not 110 <= row_height <= 300:
        raise ValueError('row_height must be an integer between 110 and 300.')
    if isinstance(smoothing, bool) or not isinstance(smoothing, (int, float)) or not isfinite(smoothing) or not .3 <= smoothing <= 3:
        raise ValueError('smoothing must be between 0.3 and 3.')
    rows = prepare_raincloud(groups, ids)
    names = [r['name'] for r in rows]
    style = prepare_style(names, colors=colors, point_size=point_size, point_alpha=point_alpha,
                          cloud_alpha=cloud_alpha, box_alpha=box_alpha, jitter=jitter,
                          show_density=show_density, show_box=show_box, show_points=show_points,
                          show_grid=show_grid, xlim=xlim, tick_count=tick_count, group_order=group_order)
    saved = st.session_state.get(key, {}).get('selection', {})
    state = {'hidden': [n for n in saved.get('hidden', []) if n in names],
             'selected': saved.get('selected', []), 'smoothing': saved.get('smoothing', smoothing),
             'points': saved.get('points', show_points) if saved.get('points_default', show_points) == show_points else show_points,
             'points_default': show_points}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'raincloud.js').read_text(encoding='utf-8'),
                                (assets/'raincloud.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'raincloud_{version}', html='<div class="raincloud"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={'groups': rows, 'title': str(title), 'row_height': row_height,
                       'selection': state, 'style': style, 'appearance': prepare_appearance(appearance)},
                       default={'selection': state}, on_selection_change=on_change or (lambda: None))
    state = result.selection or state
    hidden = [n for n in state.get('hidden', []) if n in names]
    visible = [{'group': r['name'], **p} for r in rows if r['name'] not in hidden for p in r['points']]
    selected = [p for p in visible if p['id'] in state.get('selected', [])]
    return RaincloudResult([p['id'] for p in selected], selected, hidden, visible, state['smoothing'])
