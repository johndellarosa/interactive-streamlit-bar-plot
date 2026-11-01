from pathlib import Path
import unittest
from streamlit_net_bars.sequence import prepare_sequences, transitions


class SequenceTests(unittest.TestCase):
    def test_validation_and_missing_transitions(self):
        self.assertEqual(transitions(['A', 'A', None, 'B', 'A']), [('B', 'A')])
        self.assertEqual(prepare_sequences(['1'], {'A': [None]})['states'], [])
        for x, rows, order in [([], {'A': []}, None), (['1'], {'A': [1]}, None),
                (['1'], {'A': ['A']}, ['B']), (['1'], {'A': []}, None)]:
            with self.assertRaises(ValueError):
                prepare_sequences(x, rows, order)

    def test_demo_selection_and_filtering(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'sequence_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[0].value), 16)
        at.session_state['journeys']['selection'] = {'selected': ['Customer 01'], 'contains': 'Trial', 'transition': None,
            'sort': 'transitions', 'start': 0, 'end': 2, 'inspect': ['Customer 01', 0]}
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[0].value), 16)
