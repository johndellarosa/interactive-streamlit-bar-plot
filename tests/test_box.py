from pathlib import Path
import unittest
from streamlit_net_bars.box import box_summary


class BoxTests(unittest.TestCase):
    def test_summary_outliers_and_small_samples(self):
        points = [{'id': str(i), 'value': v} for i, v in enumerate([1, 2, 3, 4, 100])]
        summary = box_summary(points)
        self.assertEqual(summary['outlier_ids'], ['4'])
        self.assertEqual(summary['median'], 3)
        self.assertEqual(summary['high'], 4)
        self.assertEqual(box_summary(points[:-1])['median'], 2.5)
        self.assertIsNone(box_summary([]))
        self.assertEqual(box_summary([{'id': 'one', 'value': 7}])['q1'], 7)
        self.assertEqual(box_summary([{'id': 'a', 'value': 0}, {'id': 'b', 'value': 100}], 0)['low'], 25)

    def test_demo_selection_and_exclusion_recompute_summaries(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'box_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(at.dataframe[1].value['count'].sum(), 150)
        at.session_state['box_observations']['selection'] = {'hidden': [], 'selected': ['Control:1'],
            'excluded': ['Control:47'], 'history': [[]], 'fixed': True}
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.dataframe[1].value['count'].sum(), 149)
        self.assertEqual(at.dataframe[0].value['id'].tolist(), ['Control:1'])
