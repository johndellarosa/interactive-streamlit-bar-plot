import unittest
from streamlit_net_bars.appearance import prepare_appearance, appearance_assets


class AppearanceTests(unittest.TestCase):
    def test_validation(self):
        self.assertEqual(prepare_appearance({'tick_fontsize': 14, 'xlabel': 'Month'}),
                         {'tick_fontsize': 14, 'xlabel': 'Month'})
        for value in [True, 0, 100, float('nan'), 'large']:
            with self.assertRaises(ValueError):
                prepare_appearance({'tick_fontsize': value})
        with self.assertRaises(TypeError):
            prepare_appearance({'tick_fontize': 14})

    def test_every_component_passes_appearance_to_frontend(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        from streamlit_net_bars import net_bar_chart
        from streamlit_net_bars.marimekko import marimekko_chart
        from streamlit_net_bars.horizon import horizon_chart
        from streamlit_net_bars.paired_change import paired_change_chart
        class Renderer:
            def __call__(self, **kwargs):
                self.data = kwargs['data']
                return SimpleNamespace(**kwargs['default'])
        for module, chart, args in [
            ('streamlit_net_bars', net_bar_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.marimekko', marimekko_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.horizon', horizon_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.paired_change', paired_change_chart, ([1], [2])),
        ]:
            renderer = Renderer()
            with patch('streamlit.components.v2.component', return_value=renderer), patch(module+'._renderer', None):
                chart(*args, key='appearance_test', tick_fontsize=16, label_fontsize=18, xlabel='Time', background_color='#ffffff')
                self.assertEqual(renderer.data['appearance']['tick_fontsize'], 16)
                self.assertEqual(renderer.data['appearance']['xlabel'], 'Time')
                self.assertEqual(renderer.data['plot_style']['background_color'], '#ffffff')
