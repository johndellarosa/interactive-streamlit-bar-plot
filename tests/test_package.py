import importlib
import unittest


class PackageTests(unittest.TestCase):
    def test_new_and_legacy_imports_share_implementations(self):
        import streamlit_interactive_charts as charts
        for module, function in [('net_bars', 'net_bar_chart'), ('marimekko', 'marimekko_chart'),
                                 ('horizon', 'horizon_chart'), ('paired_change', 'paired_change_chart'),
                                 ('upset', 'upset_chart'), ('raincloud', 'raincloud_chart')]:
            legacy = importlib.import_module('streamlit_net_bars' + ('' if module == 'net_bars' else '.'+module))
            modern = importlib.import_module('streamlit_interactive_charts.'+module)
            self.assertIs(getattr(charts, function), getattr(legacy, function))
            self.assertIs(getattr(modern, function), getattr(legacy, function))

    def test_pypi_distribution_name_stays_unchanged(self):
        from pathlib import Path
        self.assertIn('name = "interactive-streamlit-bar-plot"',
                      (Path(__file__).resolve().parents[1]/'pyproject.toml').read_text())
