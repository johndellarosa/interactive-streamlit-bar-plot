"""Backend integration checks; browser interactions are verified separately."""
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

APP = str(Path(__file__).resolve().parents[1] / "app.py")


@unittest.skipUnless(importlib.util.find_spec("streamlit"), "Install project dependencies first")
class AppTests(unittest.TestCase):
    def test_frontend_asset_changes_refresh_cached_renderer(self):
        import streamlit_net_bars as chart
        import streamlit as st
        renderer = lambda **kwargs: SimpleNamespace(hidden=[], cumulative=False)
        with patch.object(chart, "_renderer", None), patch.object(chart, "_renderer_assets", None), \
             patch.object(st.components.v2, "component", return_value=renderer) as register, \
             patch.object(Path, "read_text", side_effect=["css", "old js", "css", "new js", "css", "new js"]):
            chart.net_bar_chart(["Jan"], {"A": [1]}, key="asset_test")
            first_name = register.call_args.args[0]
            chart.net_bar_chart(["Jan"], {"A": [1]}, key="asset_test")
            self.assertNotEqual(first_name, register.call_args.args[0])
            chart.net_bar_chart(["Jan"], {"A": [1]}, key="asset_test")
            self.assertEqual(register.call_count, 2)

    def test_cumulative_mode_updates_display_without_double_counting_total(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(APP).run(timeout=30)
        total = at.metric[0].value
        at.session_state["contributions"]["cumulative"] = True
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(table["Displayed line (cumulative)"].tolist(), table["Net"].cumsum().tolist())
        self.assertEqual(at.metric[0].value, total)
        at.session_state["contributions"]["hidden"] = ["Operating costs"]
        at.run()
        table = at.dataframe[0].value
        self.assertEqual(table["Displayed line (cumulative)"].iloc[1], 227)
        at.session_state["contributions"]["cumulative"] = False
        at.run()
        self.assertFalse(at.exception)
        table = at.dataframe[0].value
        self.assertEqual(table["Displayed line"].tolist(), table["Net"].tolist())

    def test_demo_mounts_and_visibility_changes_net(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(APP).run(timeout=30)
        self.assertFalse(at.exception)
        self.assertEqual(at.metric[1].value, "4 / 4")
        original_net = float(at.metric[0].value.replace(",", ""))
        at.session_state["contributions"]["hidden"] = ["Operating costs"]
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.metric[1].value, "3 / 4")
        self.assertGreater(float(at.metric[0].value.replace(",", "")), original_net)

    def test_all_hidden_and_restored(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(APP).run(timeout=30)
        at.session_state["contributions"]["hidden"] = [
            "Product sales", "Services", "Operating costs", "Marketing"
        ]
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.metric[0].value, "0")
        self.assertEqual(at.metric[1].value, "0 / 4")
        at.session_state["contributions"]["hidden"] = []
        at.run()
        self.assertFalse(at.exception)
        self.assertEqual(at.metric[1].value, "4 / 4")
