from pathlib import Path
import unittest
from streamlit_net_bars.bullet import prepare_bullets


class BulletTests(unittest.TestCase):
    def test_validation_and_zero_metrics(self):
        self.assertEqual(prepare_bullets({'A': 0}, {'A': 0})[0]['ranges'], [.6, .8, 1])
        for values, targets, ranges in [({}, {}, None), ({'A': -1}, {'A': 1}, None),
                ({'A': 1}, {}, None), ({'A': True}, {'A': 1}, None),
                ({'A': 1}, {'A': 2}, {'A': [1, 1, 2]})]:
            with self.assertRaises(ValueError):
                prepare_bullets(values, targets, ranges)

    def test_demo_edit_targets_and_filter_status(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'bullet_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[0].value), 4)
        at.session_state['performance']['selection'] = {'selected': ['Revenue'], 'targets': {'Revenue': 70}, 'filter': 'met', 'sort': 'input', 'shared': True}
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(len(table), 3)
        self.assertEqual(table[table['name']=='Revenue']['target'].iloc[0], 70)

    def test_changing_input_target_discards_old_session_override(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_string('''
import streamlit as st
from streamlit_interactive_charts import bullet_chart
target = st.number_input('Input target', value=100)
result = bullet_chart({'A': 80}, {'A': target}, key='editable', editable_targets=True)
st.metric('Effective target', result.targets['A'])
''').run(timeout=30)
        self.assertFalse(at.exception)
        at.session_state['editable']['selection'] = {'selected': [], 'targets': {'A': 50}, 'original_targets': {'A': 100},
                                                     'filter': 'all', 'sort': 'input', 'shared': False}
        at.run()
        self.assertEqual(float(at.metric[0].value), 50)
        at.number_input[0].set_value(120).run()
        self.assertFalse(at.exception)
        self.assertEqual(float(at.metric[0].value), 120)
