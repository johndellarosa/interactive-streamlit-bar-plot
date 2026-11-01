"""Run with streamlit run ridgeline_app.py."""
from random import Random
import streamlit as st
from streamlit_interactive_charts import ridgeline_chart

st.set_page_config(page_title='Ridgeline · Distribution explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / RIDGELINE')
st.title('Compare the shapes behind the groups.')
st.write('Stack distributions to reveal shifts, spread and multiple peaks. Select groups or brush a value range to inspect matching observations.')
rng = Random(84)
groups = {f'Group {i+1}': [round(rng.gauss(38+i*5+(9 if i==3 and j%2 else 0), 5+i*.6), 2)
                          for j in range(80+i*8)] for i in range(6)}
st.caption('Illustrative independent observations · 6 groups · Equal-peak density shapes')
with st.expander('Customize the plot'):
    fill_opacity = st.slider('Fill opacity', 0.0, 1.0, .7, .05)
    line_width = st.slider('Outline width', 0.0, 8.0, 1.5, .5)
    row_height = st.slider('Row spacing', 35, 120, 52)
    show_median = st.checkbox('Display median markers', True)
    show_grid = st.checkbox('Display grid', True)
result = ridgeline_chart(groups, key='group_ridges', title='Distributions across groups', xlabel='Measurement',
                         fill_opacity=fill_opacity, line_width=line_width, row_height=row_height,
                         show_median=show_median, show_grid=show_grid)
st.write(f'{len(result.selected_groups)} groups selected · {len(result.selected_ids)} observations selected')
with st.expander('Inspect selected observations'):
    st.dataframe(result.selected_points, hide_index=True, width='stretch')
with st.expander('Inspect group summaries'):
    st.dataframe(result.summaries, hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import ridgeline_chart
result = ridgeline_chart(
    {"A": [10, 12, 13, 15, 18], "B": [14, 16, 16, 19, 22]},
    key="distributions", smoothing=1.0, overlap=1.2, xlabel="Value",
)
st.write(result.selected_groups)
st.write(result.selected_ids)
''', language='python')
