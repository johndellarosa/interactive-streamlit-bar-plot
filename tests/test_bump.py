from pathlib import Path
import unittest
from streamlit_net_bars.bump import rank_series
from streamlit_net_bars.model import prepare_data


class BumpTests(unittest.TestCase):
    def test_competition_ties_and_direction(self):
        data = prepare_data(['Jan', 'Feb'], {'A': [10, 1], 'B': [10, 3], 'C': [5, 2]})
        self.assertEqual([r['ranks'] for r in rank_series(data)], [[1, 3], [1, 1], [3, 2]])
        self.assertEqual([r['ranks'] for r in rank_series(data, False)], [[2, 1], [2, 3], [1, 2]])

    def test_demo_filters_and_highlights_preserve_full_ranks(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'bump_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[0].value), 40)
        at.session_state['competitors']['selection'] = {'hidden': ['Cedar'], 'selected': ['Atlas'], 'mode': 'value', 'higher': True}
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(len(table), 32)
        self.assertEqual(table[(table['Competitor']=='Atlas') & (table['Period']=='Jan')]['Rank'].iloc[0], 3)
        self.assertTrue(any('Atlas' in item.value for item in at.markdown))
