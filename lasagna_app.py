"""Run with streamlit run lasagna_app.py."""
from math import sin
from random import Random
import streamlit as st
from streamlit_interactive_charts import lasagna_chart

st.set_page_config(page_title='Lasagna · Longitudinal explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / LASAGNA')
st.title('See every subject over time.')
st.write('Compare longitudinal patterns, sort subjects, and inspect individual measurements.')
rng = Random(23)
periods = [f'Week {i+1}' for i in range(24)]
series = {f'Subject {j+1:02d}': [None if rng.random()<.07 else
          round(45+j*.9+10*sin(i*.32+j*.55)+(i-12)*(.5 if j%3==0 else -.25)+rng.gauss(0,2), 2)
          for i in range(24)] for j in range(18)}
st.caption('Illustrative longitudinal measurements · 18 subjects · 24 weeks · Gray cells indicate missing data')
with st.expander('Customize the plot'):
    row_height = st.slider('Row height', 18, 80, 25)
    cell_gap = st.slider('Cell gap', 0.0, 4.0, 1.0, .5)
    show_values = st.checkbox('Display cell values', False)
    palette_name = st.selectbox('Palette', ['Blue sequential', 'Blue–white–red'])
    missing_color = st.color_picker('Missing-data color', '#e4e7eb')
palette = ['#edf4fa', '#719fc3', '#244d70'] if palette_name == 'Blue sequential' else ['#3d78a5', '#f7f7f7', '#b75046']
result = lasagna_chart(periods, series, key='subjects', title='Weekly measurements by subject',
                       xlabel='Study week', row_height=row_height, cell_gap=cell_gap,
                       palette=palette, missing_color=missing_color, show_values=show_values)
st.write(f'{len(result.selected_cells)} observations selected in this window')
with st.expander('Inspect selected observations'):
    st.dataframe(result.selected_cells, hide_index=True, width='stretch')
with st.expander('Inspect subject summaries'):
    st.dataframe(result.summaries, hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import lasagna_chart
result = lasagna_chart(
    ["Week 1", "Week 2", "Week 3"],
    {"Subject A": [10, None, 14], "Subject B": [15, 12, 11]},
    key="subjects", xlabel="Study week",
)
st.write(result.selected_cells)
''', language='python')
