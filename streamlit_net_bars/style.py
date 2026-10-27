"""Plot-specific styling, validated before reaching the browser."""
from collections.abc import Mapping
from math import isfinite
import re

OPTIONS = {
    'chart': {'colors', 'bar_width', 'bar_opacity', 'line_width', 'point_size', 'net_color', 'reference_color', 'show_points'},
    'marimekko': {'colors', 'segment_opacity', 'segment_border_width', 'segment_border_color', 'show_segment_labels'},
    'horizon': {'positive_colors', 'negative_colors', 'band_opacity', 'line_width'},
    'paired_change': {'colors', 'increase_color', 'decrease_color', 'unchanged_color', 'line_width', 'line_opacity', 'point_size', 'histogram_color'},
    'upset': {'bar_color', 'set_bar_color', 'selected_color', 'dot_size', 'bar_opacity'},
}
COMMON = {'show_grid', 'grid_color', 'background_color', 'text_color'}


def extract_style(kind, options, names):
    result = {k: options.pop(k) for k in list(options) if k in OPTIONS[kind] | COMMON}
    def color(value):
        return isinstance(value, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', value)
    for key, value in result.items():
        if key == 'colors':
            if not isinstance(value, Mapping) or set(value)-set(names) or not all(color(v) for v in value.values()):
                raise ValueError('colors must map known series/group names to #RRGGBB colors.')
            result[key] = dict(value)
        elif key in ('positive_colors', 'negative_colors'):
            if not isinstance(value, (list, tuple)) or len(value) != 5 or not all(color(v) for v in value):
                raise ValueError(f'{key} must contain five #RRGGBB colors, light to dark.')
            result[key] = list(value)
        elif key.endswith('_color'):
            if not color(value):
                raise ValueError(f'{key} must be a #RRGGBB color.')
        elif key.startswith('show_'):
            if not isinstance(value, bool):
                raise ValueError(f'{key} must be a boolean.')
        else:
            low, high = (0, 1) if key.endswith('_opacity') else (.05, 1) if key == 'bar_width' else (1, 12) if key in ('point_size', 'dot_size') else (0, 8)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not low <= value <= high:
                raise ValueError(f'{key} must be a finite number between {low} and {high}.')
    return result
