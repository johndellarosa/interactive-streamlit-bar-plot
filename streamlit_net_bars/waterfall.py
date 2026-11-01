"""Interactive waterfall contributions and recomputed running totals."""
from dataclasses import dataclass, field
from collections.abc import Mapping
from hashlib import sha256
from math import isfinite
from numbers import Real
from pathlib import Path
import re
from .appearance import appearance_assets, prepare_appearance


def prepare_waterfall(labels, values, ids=None, start=0):
    labels, values = [str(v) for v in labels], list(values)
    ids = list(ids) if ids is not None else [f'Step {i+1}' for i in range(len(labels))]
    if len(labels) != len(values) or len(ids) != len(values):
        raise ValueError('labels, values and ids must have equal lengths.')
    if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('Step IDs must be unique non-empty strings.')
    if any(isinstance(v, bool) or not isinstance(v, Real) or not isfinite(v) or abs(v)>1e300 for v in [start, *values]):
        raise ValueError('start and contributions must be finite numbers with magnitude at most 1e300.')
    upper = float(start)+sum(max(0, v) for v in values)
    lower = float(start)+sum(min(0, v) for v in values)
    if not all(isfinite(v) for v in [upper, lower, upper-lower]):
        raise ValueError('The range of possible running totals must be finite.')
    return [{'id': i, 'label': label, 'value': float(v)} for i, label, v in zip(ids, labels, values)]


def waterfall_steps(rows, excluded=(), start=0):
    total, result = float(start), []
    for row in rows:
        if row['id'] in excluded:
            continue
        end = total+row['value']
        result.append({**row, 'start': total, 'end': end})
        total = end
    return result, total


def prepare_structure(rows, subtotals=None, groups=None):
    """Validate flat contiguous groups and checkpoint anchors by stable step ID."""
    ids = [r['id'] for r in rows]
    subtotals = {} if subtotals is None else subtotals
    groups = {} if groups is None else groups
    if not isinstance(subtotals, Mapping) or any(k not in ids or not isinstance(v, str) or not v.strip() for k, v in subtotals.items()):
        raise ValueError('subtotals must map existing step IDs to non-empty checkpoint labels.')
    if not isinstance(groups, Mapping):
        raise ValueError('groups must map names to contiguous sequences of step IDs.')
    result, used = [], set()
    for name, members in groups.items():
        if not isinstance(name, str) or not name.strip() or isinstance(members, (str, bytes)):
            raise ValueError('Group names must be non-empty and members must be step-ID sequences.')
        members = list(members)
        if not members or any(not isinstance(i, str) or i not in ids for i in members) or len(set(members)) != len(members) or used.intersection(members):
            raise ValueError('Group members must be existing, unique step IDs, without overlapping groups.')
        positions = sorted(ids.index(i) for i in members)
        if positions != list(range(positions[0], positions[-1]+1)):
            raise ValueError('Each group must occupy contiguous input steps; grouping never reorders contributions.')
        ordered = [ids[i] for i in positions]
        if any(i in subtotals for i in ordered[:-1]):
            raise ValueError('Place subtotal checkpoints at group boundaries, not inside a collapsible group.')
        result.append({'name': name, 'ids': ordered})
        used.update(members)
    return dict(subtotals), result


def waterfall_layout(rows, excluded=(), start=0, subtotals=None, groups=(), collapsed=(), scenario_start=None):
    """Display aggregation is independent from retained record identities."""
    subtotals = subtotals or {}
    baseline, scenario = float(start), float(start if scenario_start is None else scenario_start)
    positions = []
    for row in rows:
        retained = row['id'] not in excluded
        end = baseline+(row['value'] if retained else 0)
        scenario_end = scenario+(row.get('scenario_value', row['value']) if retained else 0)
        positions.append({'start': baseline, 'end': end, 'scenario_start': scenario, 'scenario_end': scenario_end})
        baseline, scenario = end, scenario_end
    first = {g['ids'][0]: g for g in groups if g['name'] in collapsed}
    display, checkpoints, i = [], [], 0
    while i < len(rows):
        row = rows[i]
        if row['id'] in first:
            group = first[row['id']]
            last = i+len(group['ids'])-1
            retained = [r for r in rows[i:last+1] if r['id'] not in excluded]
            if retained:
                display.append({'kind': 'group', 'label': group['name'], 'ids': [r['id'] for r in retained],
                    'start': positions[i]['start'], 'end': positions[last]['end'],
                    'value': sum(r['value'] for r in retained),
                    'scenario_start': positions[i]['scenario_start'], 'scenario_end': positions[last]['scenario_end'],
                    'scenario_value': sum(r.get('scenario_value', r['value']) for r in retained)})
            i = last
        elif row['id'] not in excluded:
            display.append({**row, **positions[i], 'kind': 'step', 'ids': [row['id']],
                            'scenario_value': row.get('scenario_value', row['value'])})
        anchor = rows[i]['id']
        if anchor in subtotals:
            checkpoint = {'after_id': anchor, 'label': subtotals[anchor], 'total': positions[i]['end'],
                          'scenario_total': positions[i]['scenario_end']}
            checkpoints.append(checkpoint)
            display.append({'kind': 'subtotal', 'label': checkpoint['label'], 'ids': [],
                            'start': 0, 'end': checkpoint['total'], 'value': checkpoint['total'],
                            'scenario_start': 0, 'scenario_end': checkpoint['scenario_total'], 'scenario_value': checkpoint['scenario_total']})
        i += 1
    return display, checkpoints, scenario


@dataclass(frozen=True)
class WaterfallResult:
    selected_ids: list[str]
    excluded_ids: list[str]
    steps: list[dict]
    start: float
    total: float
    original_total: float
    fixed_axis: bool
    scenario_total: float | None = None
    original_scenario_total: float | None = None
    checkpoints: list[dict] = field(default_factory=list)
    displayed_steps: list[dict] = field(default_factory=list)
    collapsed_groups: list[str] = field(default_factory=list)
    view: str = 'baseline'


_renderer = None
_asset_version = None


def waterfall_chart(labels, values, *, key: str, ids=None, start=0, title='Interactive waterfall',
                    start_label='Start', total_label='Total', height=420, fixed_axis=True,
                    positive_color='#56a69a', negative_color='#c77e88', total_color='#4b80b6',
                    neutral_color='#94a3b8', selected_color='#d89432', bar_width=.65,
                    bar_opacity=.85, tick_count=5, show_values=True, show_connectors=True,
                    show_reference=True, show_grid=True, ylim=None, on_change=None,
                    subtotals=None, groups=None, collapsed_groups=(), scenario=None,
                    scenario_start=None, baseline_label='Baseline', scenario_label='Scenario',
                    **appearance) -> WaterfallResult:
    """Select signed contributions and exclude/undo them to recompute all steps.

    Inputs are relative changes applied in supplied order to start. Start and
    total bars are anchored at zero and cannot be excluded. Fixed axes cover
    every possible retained subset, not merely the original running totals.
    """
    import streamlit as st
    global _renderer, _asset_version
    rows = prepare_waterfall(labels, values, ids, start)
    subtotals, groups = prepare_structure(rows, subtotals, groups)
    group_names = [g['name'] for g in groups]
    if isinstance(collapsed_groups, (str, bytes)):
        raise ValueError('collapsed_groups must be a sequence of group names.')
    collapsed_groups = list(collapsed_groups)
    if any(n not in group_names for n in collapsed_groups):
        raise ValueError('collapsed_groups must contain known group names.')
    has_scenario = scenario is not None
    if not has_scenario and scenario_start is not None:
        raise ValueError('scenario_start requires scenario values.')
    scenario_start = start if scenario_start is None else scenario_start
    if has_scenario:
        scenario_rows = prepare_waterfall([r['label'] for r in rows], scenario, [r['id'] for r in rows], scenario_start)
        rows = [{**r, 'scenario_value': s['value']} for r, s in zip(rows, scenario_rows)]
        lo = min(0, start+sum(min(0, r['value']) for r in rows), scenario_start+sum(min(0, r['scenario_value']) for r in rows))
        hi = max(0, start+sum(max(0, r['value']) for r in rows), scenario_start+sum(max(0, r['scenario_value']) for r in rows))
        if not isfinite(hi-lo):
            raise ValueError('Combined baseline/scenario range must be finite.')
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(height, bool) or not isinstance(height, int) or not 280 <= height <= 1000:
        raise ValueError('height must be an integer between 280 and 1000.')
    if any(not isinstance(v, bool) for v in [fixed_axis, show_values, show_connectors, show_reference, show_grid]):
        raise ValueError('Visibility flags and fixed_axis must be booleans.')
    if isinstance(tick_count, bool) or not isinstance(tick_count, int) or not 2 <= tick_count <= 12:
        raise ValueError('tick_count must be an integer between 2 and 12.')
    for name, v, low in [('bar_width', bar_width, .1), ('bar_opacity', bar_opacity, 0)]:
        if isinstance(v, bool) or not isinstance(v, Real) or not isfinite(v) or not low <= v <= 1:
            raise ValueError(f'{name} must be between {low} and 1.')
    if any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in [positive_color, negative_color, total_color, neutral_color, selected_color]):
        raise ValueError('Colors must use #RRGGBB.')
    if ylim is not None:
        ylim = list(ylim)
        if len(ylim) != 2 or any(isinstance(v, bool) or not isinstance(v, Real) or not isfinite(v) for v in ylim) or not ylim[0] < ylim[1] or not isfinite(ylim[1]-ylim[0]):
            raise ValueError('ylim must contain two finite increasing values.')
    valid = {r['id'] for r in rows}
    saved = st.session_state.get(key, {}).get('selection', {})
    state = {'selected': [i for i in saved.get('selected', []) if i in valid],
             'excluded': [i for i in saved.get('excluded', []) if i in valid],
             'history': [[i for i in h if i in valid] for h in saved.get('history', [])],
             'fixed': saved.get('fixed', fixed_axis) if saved.get('fixed_default', fixed_axis)==fixed_axis else fixed_axis,
             'fixed_default': fixed_axis,
             'collapsed': [n for n in saved.get('collapsed', collapsed_groups) if n in group_names]
                          if saved.get('collapsed_default', collapsed_groups)==collapsed_groups else collapsed_groups,
             'collapsed_default': collapsed_groups,
             'view': saved.get('view', 'comparison') if has_scenario else 'baseline'}
    assets = Path(__file__).parent/'frontend'
    js, css = appearance_assets((assets/'waterfall.js').read_text(encoding='utf-8'), (assets/'waterfall.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'waterfall_{version}', html='<div class="waterfall"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={'rows': rows, 'start': float(start), 'selection': state,
                       'subtotals': subtotals, 'groups': groups, 'has_scenario': has_scenario,
                       'scenario_start': float(scenario_start), 'baseline_label': str(baseline_label), 'scenario_label': str(scenario_label),
                       'title': str(title), 'start_label': str(start_label), 'total_label': str(total_label), 'height': height,
                       'positive_color': positive_color, 'negative_color': negative_color, 'total_color': total_color,
                       'neutral_color': neutral_color, 'selected_color': selected_color, 'bar_width': bar_width,
                       'bar_opacity': bar_opacity, 'tick_count': tick_count, 'show_values': show_values,
                       'show_connectors': show_connectors, 'show_reference': show_reference, 'show_grid': show_grid,
                       'ylim': ylim, 'appearance': prepare_appearance(appearance)}, default={'selection': state},
                       on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    excluded = [i for i in current['excluded'] if i in valid]
    steps, total = waterfall_steps(rows, excluded, start)
    _, original = waterfall_steps(rows, (), start)
    collapsed = [n for n in current.get('collapsed', []) if n in group_names]
    display, checkpoints, scenario_total = waterfall_layout(rows, excluded, start, subtotals, groups, collapsed, scenario_start)
    original_scenario = float(scenario_start)
    for row in rows:
        original_scenario += row.get('scenario_value', row['value'])
    if not has_scenario:
        for checkpoint in checkpoints:
            checkpoint['scenario_total'] = None
    return WaterfallResult([r['id'] for r in steps if r['id'] in current['selected']], excluded, steps,
                           float(start), total, original, current['fixed'],
                           scenario_total if has_scenario else None, original_scenario if has_scenario else None,
                           checkpoints, display, collapsed, current.get('view', 'comparison') if has_scenario else 'baseline')
