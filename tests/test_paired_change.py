from pathlib import Path
import unittest
from streamlit_net_bars.paired_change import prepare_pairs, pair_summary


class PairedChangeTests(unittest.TestCase):
    def test_pair_summary_and_ids(self):
        rows = prepare_pairs([10, 15, 20, 12], [14, 13, 25, 12])
        self.assertEqual(rows[0]['id'], 'Pair 1')
        summary = pair_summary(rows)
        self.assertEqual(summary['mean_change'], 1.75)
        self.assertEqual(summary['median_change'], 2)
        self.assertEqual(summary['increased'], 2)
        self.assertEqual(summary['unchanged'], 1)
        self.assertIsNone(pair_summary([])['mean_change'])

    def test_incomplete_duplicate_and_nonfinite_pairs_rejected(self):
        for args in [([], []), ([1], [1, 2]), ([1], [float('nan')]),
                     ([-1e308], [1e308]), ([True], [2])]:
            with self.assertRaises((ValueError, TypeError)):
                prepare_pairs(*args)
        with self.assertRaises(ValueError):
            prepare_pairs([1, 2], [2, 3], ids=['A', 'A'])
        with self.assertRaises(ValueError):
            prepare_pairs([1], [2], groups=[])

    def test_app_selection_and_filters_persist(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1] / 'paired_change_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[0].value), 48)
        at.session_state['paired_items']['selection'] = {
            'selected': ['Item 02'], 'excluded': ['Item 01'], 'hidden_groups': ['South'],
            'direction': 'all', 'bins': 5, 'color': 'group',
        }
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(len(table), 31)
        self.assertNotIn('Item 01', table['id'].tolist())
        self.assertNotIn('South', table['group'].tolist())
        self.assertTrue(any('Item 02' in item.value for item in at.markdown))
