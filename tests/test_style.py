import unittest
from streamlit_net_bars.style import extract_style


class PlotStyleTests(unittest.TestCase):
    def test_plot_options_are_separate_from_typography(self):
        options = {'colors': {'A': '#123456'}, 'bar_width': .6, 'tick_fontsize': 14}
        result = extract_style('chart', options, ['A'])
        self.assertEqual(result['bar_width'], .6)
        self.assertEqual(options, {'tick_fontsize': 14})

    def test_validation_for_each_plot(self):
        cases = [('chart', {'bar_width': 2}), ('marimekko', {'segment_opacity': -1}),
                 ('horizon', {'positive_colors': ['red']}), ('paired_change', {'point_size': True}),
                 ('upset', {'dot_size': 50}), ('chart', {'colors': {'Missing': '#123456'}}),
                 ('upset', {'show_grid': 'yes'}), ('paired_change', {'line_width': float('nan')})]
        for kind, options in cases:
            with self.assertRaises(ValueError):
                extract_style(kind, options, ['A'])

    def test_default_styles_are_empty_and_color_ramps_are_copied(self):
        for kind in ['chart', 'marimekko', 'horizon', 'paired_change', 'upset']:
            self.assertEqual(extract_style(kind, {}, []), {})
        ramp = ['#000000'] * 5
        options = extract_style('horizon', {'positive_colors': ramp}, [])
        self.assertIsNot(options['positive_colors'], ramp)
