from pathlib import Path
import unittest


class RidgelineTests(unittest.TestCase):
    def test_demo_group_and_range_selection(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(Path(__file__).resolve().parents[1]/'ridgeline_app.py')).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(len(at.dataframe[1].value), 6)
        at.session_state['group_ridges']['selection'] = {'hidden': ['Group 6'], 'selected': ['Group 1'],
            'range': [35, 45], 'sort': 'mean', 'mode': 'groups', 'smoothing': 2, 'overlap': 1.5}
        at.run()
        self.assertFalse(at.exception)
        selected = at.dataframe[0].value
        self.assertGreater(len(selected), 0)
        self.assertTrue((selected['group']=='Group 1').all())
        self.assertTrue(selected['value'].between(35, 45).all())
        self.assertEqual(len(at.dataframe[1].value), 5)

    def test_invalid_options_rejected(self):
        from streamlit_interactive_charts import ridgeline_chart
        for options in [{'overlap': 5}, {'smoothing': 0}, {'fill_opacity': True},
                        {'line_width': -1}, {'row_height': 10}, {'selected_color': 'red'}]:
            with self.assertRaises(ValueError):
                ridgeline_chart({'A': [1, 2]}, key='invalid', **options)
