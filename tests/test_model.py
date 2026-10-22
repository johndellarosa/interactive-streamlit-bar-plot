import unittest
from streamlit_net_bars.model import net_values, prepare_data
from streamlit_net_bars import NetBarResult


class NetTests(unittest.TestCase):
    def setUp(self):
        self.data = prepare_data(["Jan", "Feb"], {"Income": [100, 80], "Costs": [-60, -90]})

    def test_signed_net(self):
        self.assertEqual(net_values(self.data), [40, -10])

    def test_hide_negative_or_positive(self):
        self.assertEqual(net_values(self.data, ["Costs"]), [100, 80])
        self.assertEqual(net_values(self.data, ["Income"]), [-60, -90])

    def test_all_hidden_is_zero(self):
        self.assertEqual(net_values(self.data, ["Income", "Costs"]), [0, 0])

    def test_cumulative_line_uses_signed_visible_net(self):
        result = NetBarResult([], ["Income", "Costs"], net_values(self.data), True)
        self.assertEqual(result.line_values, [40, 30])
        self.assertEqual(result.net, [40, -10])
        result = NetBarResult(["Costs"], ["Income"], net_values(self.data, ["Costs"]), True)
        self.assertEqual(result.line_values, [100, 180])
        result = NetBarResult(["Income"], ["Costs"], net_values(self.data, ["Income"]), True)
        self.assertEqual(result.line_values, [-60, -150])
        result = NetBarResult(["Income", "Costs"], [], [0, 0], True)
        self.assertEqual(result.line_values, [0, 0])

    def test_invalid_inputs(self):
        for x, series in [([], {"a": []}), (["a"], {}), (["a"], {"a": [1, 2]}),
                          (["a"], {"": [1]}), (["a"], {"a": [None]}),
                          (["a"], {"a": [float("nan")]}), (["a"], {"a": [float("inf")]}),
                          (["a"], {"a": [True]})]:
            with self.subTest(x=x, series=series), self.assertRaises(ValueError):
                prepare_data(x, series)


if __name__ == "__main__":
    unittest.main()
