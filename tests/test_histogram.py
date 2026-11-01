from pathlib import Path
import unittest
from streamlit_net_bars.histogram import histogram_bins


class HistogramTests(unittest.TestCase):
    def test_constructor_customization_and_invalid_options(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        from streamlit_net_bars.histogram import histogram_chart
        captured = {}
        def renderer(**kwargs):
            captured.update(kwargs['data'])
            return SimpleNamespace(**kwargs['default'])
        with patch('streamlit_net_bars.histogram._renderer', None), patch('streamlit.components.v2.component', return_value=renderer):
            histogram_chart({'A': [1, 2]}, key='custom_hist', bar_gap=6, tick_count=8,
                            selected_color='#123456', reference_color='#abcdef', show_bin_counts=True)
        self.assertEqual(captured['bar_gap'], 6)
        self.assertEqual(captured['tick_count'], 8)
        self.assertTrue(captured['show_bin_counts'])
        for options in [{'bar_gap': -1}, {'tick_count': True}, {'selected_color': 'red'}, {'show_bin_counts': 1}]:
            with self.assertRaises(ValueError):
                histogram_chart({'A': [1]}, key='invalid_hist', **options)

    def test_boundaries_normalization_and_exclusion(self):
        rows = [{'name': 'A', 'points': [{'id': str(i), 'value': i} for i in range(5)]}]
        visible, bins = histogram_bins(rows, {'bins': 4})
        self.assertEqual([b['count'] for b in bins], [1, 1, 1, 2])
        self.assertEqual(len(visible), 5)
        visible, bins = histogram_bins(rows, {'bins': 2, 'excluded': ['4'], 'normalization': 'density'})
        self.assertEqual(len(visible), 4)
        self.assertEqual(sum(b['value']*(b['high']-b['low']) for b in bins), 1)

    def test_demo_selection_and_exclusion(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'histogram_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(at.dataframe[1].value['count'].sum(), 330)
        at.session_state['hist_observations']['selection'] = {'hidden': [], 'selected': ['Control:1'],
            'excluded': ['Control:2'], 'history': [[]], 'bins': 10, 'normalization': 'percent'}
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.dataframe[0].value['id'].tolist(), ['Control:1'])
        self.assertEqual(at.dataframe[1].value['count'].sum(), 329)
        self.assertAlmostEqual(at.dataframe[1].value['value'].sum(), 100)
