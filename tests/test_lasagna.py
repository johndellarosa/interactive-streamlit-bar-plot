from pathlib import Path
import unittest
from streamlit_net_bars.lasagna import prepare_lasagna


class LasagnaTests(unittest.TestCase):
    def test_validation_and_missing_data(self):
        self.assertEqual(prepare_lasagna(['A', 'B'], {'One': [1, None]})['series'][0]['values'], [1, None])
        for x, rows in [([], {'A': []}), (['A', 'A'], {'One': [1, 2]}),
                        (['A'], {}), (['A'], {'One': [True]}), (['A'], {'One': [float('nan')]}),
                        (['A'], {'One': [1, 2]})]:
            with self.assertRaises(ValueError):
                prepare_lasagna(x, rows)

    def test_demo_window_filter_and_selected_values(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'lasagna_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[1].value), 18)
        at.session_state['subjects']['selection'] = {'hidden': ['Subject 02'], 'selected': [['Subject 01', 0]],
            'start': 0, 'end': 2, 'sort': 'mean', 'scale': 'centered'}
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[1].value
        self.assertEqual(len(table), 17)
        self.assertTrue(((table['Observed']+table['Missing'])==3).all())
        self.assertEqual(at.dataframe[0].value['period'].tolist(), ['Week 1'])
