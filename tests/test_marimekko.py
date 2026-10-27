import importlib.util
import unittest
from pathlib import Path

from streamlit_net_bars.marimekko import prepare_marimekko


class DataTests(unittest.TestCase):
    def test_nonnegative_data_and_zero_values(self):
        data = prepare_marimekko(["A", "B"], {"One": [0, 1e-12]})
        self.assertEqual(data["series"][0]["values"], [0, 1e-12])

    def test_negative_missing_and_overflow_rejected(self):
        for values in [[-1], [None], [float("inf")], [float("nan")], [True]]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                prepare_marimekko(["A"], {"One": values})
        with self.assertRaises(ValueError):
            prepare_marimekko(["A", "B"], {"One": [1e308, 1e308]})
        with self.assertRaises(ValueError):
            prepare_marimekko(["A", "A"], {"One": [1, 2]})


@unittest.skipUnless(importlib.util.find_spec("streamlit"), "Install Streamlit first")
class MarimekkoAppTests(unittest.TestCase):
    def test_selection_and_normalization_survive_reruns(self):
        from streamlit.testing.v1 import AppTest
        app = str(Path(__file__).resolve().parents[1] / "marimekko_app.py")
        at = AppTest.from_file(app).run(timeout=30)
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(table["Original total"].sum(), 2770)
        at.session_state["markets"]["selection"] = {
            "hidden_series": ["Enterprise"], "hidden_categories": [], "recalculate": True,
        }
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.dataframe[0].value["Visible total"].sum(), 1785)
        self.assertAlmostEqual(at.dataframe[0].value["Column width (%)"].sum(), 100)
        at.session_state["markets"]["selection"]["recalculate"] = False
        at.run()
        self.assertFalse(at.exception)
        self.assertAlmostEqual(at.dataframe[0].value["Column width (%)"].iloc[0], 900 / 2770 * 100)
        at.session_state["markets"]["selection"]["hidden_categories"] = ["Europe"]
        at.run()
        self.assertEqual(at.dataframe[0].value["Visible total"].iloc[1], 0)
