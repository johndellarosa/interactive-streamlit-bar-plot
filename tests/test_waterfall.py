from pathlib import Path
import unittest
from streamlit_net_bars.waterfall import prepare_waterfall, waterfall_steps, prepare_structure, waterfall_layout


class WaterfallTests(unittest.TestCase):
    def test_group_collapse_and_checkpoint_exclusion_are_calculation_independent(self):
        rows = prepare_waterfall(['A', 'B', 'C'], [50, -80, 10], ['a', 'b', 'c'], 100)
        rows = [{**r, 'scenario_value': v} for r, v in zip(rows, [70, -60, 20])]
        subs, groups = prepare_structure(rows, {'b': 'Subtotal'}, {'Operations': ['a', 'b']})
        display, checkpoints, scenario = waterfall_layout(rows, ['b'], 100, subs, groups, ['Operations'], 110)
        self.assertEqual(display[0]['kind'], 'group')
        self.assertEqual(display[0]['ids'], ['a'])
        self.assertEqual(display[0]['end'], 150)
        self.assertEqual(checkpoints[0]['total'], 150)
        self.assertEqual(checkpoints[0]['scenario_total'], 180)
        self.assertEqual(scenario, 200)
        expanded, expanded_checkpoints, expanded_total = waterfall_layout(rows, ['b'], 100, subs, groups, [], 110)
        self.assertEqual(expanded_checkpoints, checkpoints)
        self.assertEqual(expanded_total, scenario)

    def test_invalid_group_structures_and_checkpoint_anchors_rejected(self):
        rows = prepare_waterfall(['A', 'B', 'C'], [1, 2, 3], ['a', 'b', 'c'])
        cases = [({'missing': 'No'}, {}), ({}, {'Bad': ['a', 'c']}),
                 ({}, {'One': ['a', 'b'], 'Two': ['b', 'c']}),
                 ({'a': 'Inside group'}, {'Both': ['a', 'b']})]
        for subs, groups in cases:
            with self.assertRaises(ValueError):
                prepare_structure(rows, subs, groups)

    def test_running_totals_and_exclusion(self):
        rows = prepare_waterfall(['A', 'B', 'C'], [50, -80, 10], start=100)
        steps, total = waterfall_steps(rows, ['Step 2'], 100)
        self.assertEqual(total, 160)
        self.assertEqual([(r['start'], r['end']) for r in steps], [(100, 150), (150, 160)])
        self.assertEqual(waterfall_steps(rows, [r['id'] for r in rows], 100), ([], 100.0))

    def test_validation_and_duplicate_display_labels(self):
        self.assertEqual(len(prepare_waterfall(['Same', 'Same'], [1, 2])), 2)
        self.assertEqual(prepare_waterfall([], []), [])
        for labels, values, ids in [(['A'], [1, 2], None), (['A'], [True], None),
                                     (['A'], [float('nan')], None), (['A', 'B'], [1, 2], ['same', 'same'])]:
            with self.assertRaises(ValueError):
                prepare_waterfall(labels, values, ids)

    def test_demo_exclusion_and_selection_persist(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'waterfall_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(at.metric[0].value, '170.00')
        at.session_state['bridge']['selection'] = {'selected': ['Step 1'], 'excluded': ['Step 3'], 'history': [[]], 'fixed': True}
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.metric[0].value, '235.00')
        self.assertEqual(at.metric[1].value, '170.00')
        self.assertEqual(len(at.dataframe[0].value), 5)
        self.assertEqual(at.metric[3].value, '281.00')
        self.assertEqual(at.dataframe[1].value['total'].tolist(), [250, 220])
