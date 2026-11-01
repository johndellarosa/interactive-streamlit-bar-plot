"""Run with streamlit run box_app.py."""
from random import Random
import streamlit as st
from streamlit_interactive_charts import box_plot

st.set_page_config(page_title='Box plot · Interactive explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / BOX PLOT')
st.title('Explore what changes the summary.')
st.write('Select observations or quartile regions. Exclude them to recompute the distributions, and undo to compare.')
rng = Random(73)
groups = {
    'Control': [round(rng.gauss(45, 6), 2) for _ in range(45)]+[12, 81],
    'Treatment A': [round(rng.gauss(54, 7), 2) for _ in range(52)]+[92],
    'Treatment B': [round(rng.gauss(49, 5), 2) for _ in range(48)]+[20, 88],
}
st.caption('Illustrative independent observations · 150 measurements · Includes extreme values')
with st.expander('Customize the plot'):
    whis = st.slider('Whisker multiplier (IQR)', 0.0, 5.0, 1.5, .25)
    point_size = st.slider('Point radius', 1.0, 12.0, 3.2, .2)
    show_points = st.checkbox('Display observations', True)
    show_mean = st.checkbox('Display mean diamond', False)
    show_grid = st.checkbox('Display grid', True)
result = box_plot(groups, key='box_observations', title='Outcome distributions', xlabel='Score',
                  whis=whis, point_size=point_size, show_points=show_points,
                  show_mean=show_mean, show_grid=show_grid)
st.write(f'{len(result.selected_ids)} selected · {len(result.excluded_ids)} excluded')
with st.expander('Inspect selected observations'):
    st.dataframe(result.selected_points, hide_index=True, width='stretch')
with st.expander('Inspect recomputed summaries'):
    st.dataframe([{'Group': r['group'], **(r['summary'] or {'count': 0})} for r in result.summaries],
                 hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import box_plot
result = box_plot(
    {"Control": [10, 12, 13, 15, 40], "Treatment": [12, 14, 18, 20]},
    key="outcomes", xlabel="Score", show_mean=True,
)
st.write(result.selected_ids)
st.write(result.excluded_ids)
''', language='python')
