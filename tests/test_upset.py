from pathlib import Path
import unittest
from streamlit_net_bars.upset import prepare_upset, filter_intersections


class UpSetTests(unittest.TestCase):
    def test_exact_membership_and_universe(self):
        data = prepare_upset({'A': ['1', '2', '2'], 'B': ['2', '3']}, ['1', '2', '3', '4'])
        self.assertEqual(data['sizes'], [2, 2])
        self.assertEqual({r['key']: r['ids'] for r in data['intersections']},
                         {'10': ['1'], '11': ['2'], '01': ['3'], '00': ['4']})
        self.assertEqual(sum(r['count'] for r in data['intersections']), 4)
        self.assertEqual([r['ids'] for r in filter_intersections(data, {'required': ['A'], 'excluded': ['B']})], [['1']])

    def test_empty_sets_large_number_of_sets_and_invalid_input(self):
        self.assertEqual(prepare_upset({'A': []})['intersections'], [])
        self.assertEqual(prepare_upset({str(i): ['same'] for i in range(40)})['intersections'][0]['degree'], 40)
        for sets, universe in [({}, None), ({'': []}, None), ({'A': 'one'}, None),
                               ({'A': [None]}, None), ({'A': ['1']}, [])]:
            with self.assertRaises(ValueError):
                prepare_upset(sets, universe)

    def test_demo_selection_and_filters_persist(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'upset_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        initial = at.dataframe[1].value
        self.assertEqual(initial['Records'].sum(), 120)
        at.session_state['adoption']['selection'] = {'required': ['Analytics'], 'excluded': ['Reporting'],
            'selected': ['1100'], 'sort': 'degree', 'min_count': 1,
            'names': ['Analytics', 'Automation', 'Reporting', 'Integrations']}
        at.run()
        self.assertFalse(at.exception)
        selected = at.dataframe[0].value
        self.assertGreater(len(selected), 0)
        self.assertTrue(selected['Analytics'].all())
        self.assertFalse(selected['Reporting'].any())
