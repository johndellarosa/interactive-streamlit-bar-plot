from pathlib import Path
import unittest
from streamlit_net_bars.raincloud import prepare_raincloud, prepare_style


class RaincloudTests(unittest.TestCase):
    def test_custom_style_validation(self):
        options = prepare_style(['A', 'B'], colors={'A': '#123abc'}, xlim=[0, 10],
                                group_order=['B', 'A'], point_size=6, jitter=0)
        self.assertEqual(options['group_order'], ['B', 'A'])
        self.assertEqual(options['xlim'], [0, 10])
        for options in [{'point_alpha': 2}, {'point_size': True}, {'jitter': -1},
                        {'colors': {'Unknown': '#123456'}}, {'colors': {'A': 'red'}},
                        {'xlim': [2, 1]}, {'tick_count': 1}, {'show_grid': 'yes'},
                        {'group_order': ['A', 'A']}]:
            with self.assertRaises(ValueError):
                prepare_style(['A', 'B'], **options)

    def test_validation_and_stable_ids(self):
        self.assertEqual(prepare_raincloud({'A': [1, 2]})[0]['points'][1]['id'], 'A:2')
        self.assertEqual(prepare_raincloud({'Empty': []})[0]['points'], [])
        for groups, ids in [({}, None), ({'A': [float('nan')]}, None), ({'A': [True]}, None),
                            ({'A': [1]}, {'A': []}), ({'A': [1], 'B': [2]}, {'A': ['same'], 'B': ['same']})]:
            with self.assertRaises(ValueError):
                prepare_raincloud(groups, ids)

    def test_demo_visibility_and_selection(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'raincloud_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[1].value), 220)
        at.session_state['outcomes']['selection'] = {'hidden': ['Baseline'], 'selected': ['Program A:1', 'Baseline:1'], 'smoothing': 2, 'points': True}
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[1].value), 155)
        self.assertEqual(at.dataframe[0].value['id'].tolist(), ['Program A:1'])
