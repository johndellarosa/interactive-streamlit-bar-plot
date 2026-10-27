"""Interactive exclusive set intersections."""
from collections.abc import Callable, Mapping, Iterable
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from .style import extract_style
from .appearance import prepare_appearance, appearance_assets


def prepare_upset(sets: Mapping[str, Iterable[str]], universe=None):
    if not isinstance(sets, Mapping) or not sets:
        raise ValueError('sets must be a non-empty mapping of names to record IDs.')
    names = list(sets)
    if any(not isinstance(n, str) or not n.strip() for n in names):
        raise ValueError('Set names must be non-empty strings.')
    def ids(values):
        if isinstance(values, (str, bytes)):
            raise ValueError('Record IDs must be a sequence of strings, not a string.')
        values = list(values)
        if any(not isinstance(v, str) or not v for v in values):
            raise ValueError('Record IDs must be non-empty strings.')
        return list(dict.fromkeys(values))
    members = [ids(values) for values in sets.values()]
    observed = list(dict.fromkeys(v for group in members for v in group))
    records = ids(universe) if universe is not None else observed
    if not set(observed).issubset(records):
        raise ValueError('universe must include every record in the sets.')
    memberships = [set(group) for group in members]
    grouped = {}
    for record in records:
        signature = ''.join('1' if record in group else '0' for group in memberships)
        grouped.setdefault(signature, []).append(record)
    intersections = [{'key': signature, 'sets': [n for n, bit in zip(names, signature) if bit == '1'],
                      'degree': signature.count('1'), 'count': len(values), 'ids': values}
                     for signature, values in grouped.items()]
    return {'names': names, 'sizes': [len(group) for group in members],
            'total': len(records), 'intersections': intersections}


def filter_intersections(data, state):
    required, excluded = state.get('required', []), state.get('excluded', [])
    rows = [r for r in data['intersections'] if all(n in r['sets'] for n in required)
            and not any(n in r['sets'] for n in excluded)
            and r['count'] >= state.get('min_count', 1)]
    rows.sort(key=(lambda r: (-r['degree'], -r['count'], r['key'])) if state.get('sort') == 'degree'
              else (lambda r: (-r['count'], -r['degree'], r['key'])))
    return rows


@dataclass(frozen=True)
class UpSetResult:
    selected_ids: list[str]
    selected_intersections: list[dict]
    visible_intersections: list[dict]
    required_sets: list[str]
    excluded_sets: list[str]
    set_sizes: dict[str, int]
    total_records: int


_renderer = None
_asset_version = None


def upset_chart(sets: Mapping[str, Iterable[str]], *, key: str, universe=None,
                title='Set intersections', height=260, max_intersections=30,
                on_change: Callable | None = None, **appearance) -> UpSetResult:
    """Plot exact membership combinations; counts never duplicate records.

    Set members are stable string IDs; duplicates within a set are deduplicated.
    An optional universe includes records belonging to none of the sets.
    Required/excluded filters constrain whole combinations, without projecting
    away sets. Select multiple intersections to return their combined record IDs.
    max_intersections caps displayed columns, not the underlying combinations.
    """
    import streamlit as st
    global _renderer, _asset_version
    if not isinstance(key, str) or not key:
        raise ValueError('key must be a non-empty unique string.')
    if isinstance(height, bool) or not isinstance(height, int) or not 180 <= height <= 700:
        raise ValueError('height must be an integer between 180 and 700.')
    if isinstance(max_intersections, bool) or not isinstance(max_intersections, int) or not 1 <= max_intersections <= 200:
        raise ValueError('max_intersections must be an integer between 1 and 200.')
    data = prepare_upset(sets, universe)
    saved = st.session_state.get(key, {}).get('selection', {})
    names = data['names']
    required = [n for n in saved.get('required', []) if n in names]
    state = {'required': required, 'excluded': [n for n in saved.get('excluded', []) if n in names and n not in required],
             'sort': saved.get('sort', 'size'), 'min_count': max(1, int(saved.get('min_count', 1))),
             'selected': saved.get('selected', []) if saved.get('names', names) == names else [], 'names': names}
    valid = {r['key'] for r in filter_intersections(data, state)}
    state['selected'] = [k for k in state['selected'] if k in valid]
    plot_style = extract_style('upset', appearance, data['names'])
    assets = Path(__file__).parent / 'frontend'
    js, css = appearance_assets((assets/'upset.js').read_text(encoding='utf-8'),
                                (assets/'upset.css').read_text(encoding='utf-8'))
    version = sha256((js+'\0'+css).encode()).hexdigest()[:16]
    if _renderer is None or _asset_version != version:
        _renderer = st.components.v2.component(f'upset_{version}', html='<div class="upset"></div>', js=js, css=css)
        _asset_version = version
    result = _renderer(key=key, data={**data, 'selection': state, 'title': str(title), 'height': height,
                       'max_intersections': max_intersections, 'plot_style': plot_style, 'appearance': prepare_appearance(appearance)},
                       default={'selection': state}, on_selection_change=on_change or (lambda: None))
    current = result.selection or state
    visible = filter_intersections(data, current)
    selected = [r for r in visible if r['key'] in current.get('selected', [])]
    return UpSetResult([i for r in selected for i in r['ids']], selected, visible,
                       current.get('required', []), current.get('excluded', []),
                       dict(zip(names, data['sizes'])), data['total'])
