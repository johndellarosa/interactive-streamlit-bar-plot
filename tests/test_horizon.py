import importlib.util
from pathlib import Path
import unittest
from streamlit_net_bars.horizon import prepare_horizon


class HorizonDataTests(unittest.TestCase):
    def test_baselines_and_deviations(self):
        self.assertEqual(prepare_horizon(['A', 'B'], {'One': [2, 4]}, 'first')['series'][0]['deviations'], [0, 2])
        row = prepare_horizon(['A', 'B'], {'One': [2, 4]}, 'mean')['series'][0]
        self.assertEqual(row['baseline'], 3)
        self.assertEqual(row['deviations'], [-1, 1])
        self.assertEqual(prepare_horizon(['A'], {'One': [1e-12]})['series'][0]['deviations'], [1e-12])

    def test_invalid_baselines_and_nonfinite_deviations(self):
        with self.assertRaises(ValueError):
            prepare_horizon(['A'], {'One': [1]}, 'unknown')
        with self.assertRaises(ValueError):
            prepare_horizon(['A', 'B'], {'One': [-1e308, 1e308]}, 'first')


@unittest.skipUnless(importlib.util.find_spec('streamlit'), 'Install Streamlit first')
class HorizonAppTests(unittest.TestCase):
    def test_controls_and_visibility_persist(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1] / 'horizon_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[0].value), 8)
        at.session_state['store_horizons']['selection'] = {
            'hidden': ['North · Flagship'], 'baseline': 'first', 'scale': 'individual',
            'bands': 4, 'start': 10, 'end': 30, 'expanded': 'South · Outlet',
        }
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(len(table), 7)
        self.assertNotIn('North · Flagship', table['Series'].tolist())
        self.assertTrue((table['Band width'] >= 0).all())
        saved = at.session_state['store_horizons']['selection']
        self.assertEqual(saved['start'], 10)
        self.assertEqual(saved['end'], 30)
