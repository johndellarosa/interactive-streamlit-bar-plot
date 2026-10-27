"""Run with streamlit run raincloud_app.py."""
from random import Random
import streamlit as st
from streamlit_interactive_charts import raincloud_chart

st.set_page_config(page_title='Raincloud · Distribution explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / RAINCLOUD')
st.title('See the shape behind the summary.')
st.write('Compare distributions while keeping individual observations in view.')
rng = Random(41)
groups = {
    'Baseline': [round(rng.gauss(45, 8), 2) for _ in range(65)],
    'Program A': [round(rng.gauss(54, 6), 2) for _ in range(80)],
    'Program B': [round(rng.gauss(43 if i%2 else 62, 4), 2) for i in range(75)],
}
st.caption('Illustrative independent observations · 3 groups · 220 measurements')
with st.expander('Customize the plot'):
    first, second, third = st.columns(3)
    with first:
        point_size = st.slider('Point size', 1.0, 12.0, 3.2, .2)
        point_alpha = st.slider('Point opacity', 0.0, 1.0, .7, .05)
        jitter = st.slider('Point jitter', 0, 24, 15)
        show_points = st.checkbox('Display observations', True)
    with second:
        cloud_alpha = st.slider('Cloud opacity', 0.0, 1.0, .45, .05)
        box_alpha = st.slider('Box opacity', 0.0, 1.0, .7, .05)
        show_density = st.checkbox('Display density', True)
        show_box = st.checkbox('Display box plot', True)
    with third:
        colors = {name: st.color_picker(f'{name} color', color) for name, color in
                  zip(groups, ['#4b80b6', '#56a69a', '#a092bc'])}
        show_grid = st.checkbox('Display grid', True)
    use_limits = st.checkbox('Use custom axis limits')
    limits = st.slider('Visible score range', 0.0, 100.0, (20.0, 80.0)) if use_limits else None
    if limits is not None and limits[0] == limits[1]:
        st.info('Select a range with different endpoints. Using automatic limits for now.')
        limits = None
result = raincloud_chart(groups, key='outcomes', title='Outcome distributions', xlabel='Outcome score',
                         colors=colors, point_size=point_size, point_alpha=point_alpha,
                         cloud_alpha=cloud_alpha, box_alpha=box_alpha, jitter=jitter,
                         show_density=show_density, show_box=show_box, show_points=show_points,
                         show_grid=show_grid, xlim=limits)
st.write(f'{len(result.selected_ids)} observations selected')
with st.expander('Inspect selected observations'):
    st.dataframe(result.selected_points, hide_index=True, width='stretch')
with st.expander('Inspect visible observations'):
    st.dataframe(result.visible_points, hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import raincloud_chart
result = raincloud_chart(
    {"Control": [10, 12, 13, 15], "Treatment": [12, 14, 14, 18, 20]},
    key="outcomes", xlabel="Score", tick_fontsize=13,
)
st.write(result.selected_ids)
''', language='python')
