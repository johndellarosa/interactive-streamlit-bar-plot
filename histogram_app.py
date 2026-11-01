"""Run with streamlit run histogram_app.py."""
from random import Random
import streamlit as st
from streamlit_interactive_charts import histogram_chart

st.set_page_config(page_title='Histogram · Distribution explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / HISTOGRAM')
st.title('Explore the distribution, one bin at a time.')
st.write('Select bins, change the resolution, and compare the retained observations against the original distribution.')
rng = Random(91)
groups = {'Control': [round(rng.gauss(45, 8), 2) for _ in range(150)],
          'Treatment': [round(rng.gauss(56, 10), 2) for _ in range(180)]}
st.caption('Illustrative independent observations · 330 measurements · 2 groups')
with st.expander('Customize the plot'):
    bar_opacity = st.slider('Bar opacity', 0.0, 1.0, .8, .05)
    show_reference = st.checkbox('Display original outline', True)
    show_grid = st.checkbox('Display grid', True)
    bar_gap = st.slider('Bar gap', 0.0, 20.0, 2.0, .5)
    tick_count = st.slider('Axis tick count', 2, 12, 5)
    show_bin_counts = st.checkbox('Display bin counts', False)
    colors = {name: st.color_picker(f'{name} color', color) for name, color in zip(groups, ['#4b80b6', '#56a69a'])}
result = histogram_chart(groups, key='hist_observations', title='Measurement distribution', xlabel='Score',
                         colors=colors, bar_opacity=bar_opacity, show_reference=show_reference, show_grid=show_grid,
                         bar_gap=bar_gap, tick_count=tick_count, show_bin_counts=show_bin_counts)
st.write(f'{len(result.selected_ids)} selected · {len(result.excluded_ids)} excluded')
with st.expander('Inspect selected observations'):
    st.dataframe(result.selected_points, hide_index=True, width='stretch')
with st.expander('Inspect bins'):
    st.dataframe([{k: v for k, v in b.items() if k != 'ids'} for b in result.bins], hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import histogram_chart
result = histogram_chart(
    {"A": [1, 2, 2, 3, 5], "B": [2, 4, 4, 6]},
    key="distribution", bins=8, normalization="count",
)
st.write(result.selected_ids)
''', language='python')
