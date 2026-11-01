import unittest
from streamlit_net_bars.appearance import prepare_appearance, appearance_assets


class AppearanceTests(unittest.TestCase):
    def test_layout_validation(self):
        accepted = {'card_padding': 0, 'card_radius': 20, 'card_border_width': 2,
                    'card_border_color': '#123456', 'title_fontweight': 700,
                    'title_align': 'center', 'legend_align': 'right', 'show_controls': False,
                    'show_tooltips': False, 'grid_width': 1.5, 'grid_opacity': .3}
        self.assertEqual(prepare_appearance(accepted), accepted)
        for option in [{'show_legend': 'no'}, {'card_padding': -1}, {'card_radius': True},
                       {'grid_opacity': 2}, {'title_align': 'middle'}, {'legend_align': 'top'},
                       {'title_fontweight': 50}, {'card_border_color': 'red'}]:
            with self.assertRaises(ValueError):
                prepare_appearance(option)

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
        from streamlit_net_bars.raincloud import raincloud_chart
        from streamlit_net_bars.upset import upset_chart
        from streamlit_net_bars.box import box_plot
        from streamlit_net_bars.bump import bump_chart
        from streamlit_net_bars.lasagna import lasagna_chart
        from streamlit_net_bars.histogram import histogram_chart
        from streamlit_net_bars.waterfall import waterfall_chart
        from streamlit_net_bars.bullet import bullet_chart
        from streamlit_net_bars.sequence import sequence_chart
        from streamlit_net_bars.ridgeline import ridgeline_chart
        class Renderer:
            def __call__(self, **kwargs):
                self.data = kwargs['data']
                return SimpleNamespace(**kwargs['default'])
        for module, chart, args in [
            ('streamlit_net_bars', net_bar_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.marimekko', marimekko_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.horizon', horizon_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.paired_change', paired_change_chart, ([1], [2])),
            ('streamlit_net_bars.raincloud', raincloud_chart, ({'One': [1]},)),
            ('streamlit_net_bars.upset', upset_chart, ({'One': ['a']},)),
            ('streamlit_net_bars.box', box_plot, ({'One': [1]},)),
            ('streamlit_net_bars.bump', bump_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.lasagna', lasagna_chart, (['A'], {'One': [1]})),
            ('streamlit_net_bars.histogram', histogram_chart, ({'One': [1]},)),
            ('streamlit_net_bars.waterfall', waterfall_chart, (['A'], [1])),
            ('streamlit_net_bars.bullet', bullet_chart, ({'One': 1}, {'One': 2})),
            ('streamlit_net_bars.sequence', sequence_chart, (['A'], {'One': ['State']})),
            ('streamlit_net_bars.ridgeline', ridgeline_chart, ({'One': [1, 2]},)),
        ]:
            renderer = Renderer()
            with patch('streamlit.components.v2.component', return_value=renderer), patch(module+'._renderer', None):
                chart(*args, key='appearance_test', tick_fontsize=16, label_fontsize=18, xlabel='Time',
                      card_padding=18, show_controls=False)
                self.assertEqual(renderer.data['appearance']['tick_fontsize'], 16)
                self.assertEqual(renderer.data['appearance']['xlabel'], 'Time')
                self.assertEqual(renderer.data['appearance']['card_padding'], 18)
                self.assertFalse(renderer.data['appearance']['show_controls'])
