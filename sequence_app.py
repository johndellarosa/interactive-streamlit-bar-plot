"""Run with streamlit run sequence_app.py."""
from random import Random
import streamlit as st
from streamlit_interactive_charts import sequence_chart

st.set_page_config(page_title='Sequence · Categorical explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / SEQUENCE')
st.title('Follow each journey.')
st.write('Explore how subjects move between states over time. Filter for a state or transition, then select a subject to inspect.')
periods = [f'Month {i+1}' for i in range(18)]
rng = Random(63)
sequences = {}
for j in range(16):
    current = 'Trial'
    values = []
    for i in range(18):
        if i > 1 and rng.random() < .22:
            current = rng.choice(['Active', 'Paused', 'Churned']) if current != 'Churned' else rng.choice(['Churned', 'Active'])
        values.append(None if rng.random() < .025 else current)
    sequences[f'Customer {j+1:02d}'] = values
st.caption('Illustrative customer states · 16 customers · 18 periods · Missing data interrupts transitions')
with st.expander('Customize the plot'):
    row_height = st.slider('Row height', 18, 80, 27)
    gap = st.slider('Gap between runs', 0.0, 4.0, 1.0, .5)
    show_labels = st.checkbox('Display labels inside runs', False)
result = sequence_chart(periods, sequences, key='journeys', title='Customer state journeys', xlabel='Month',
                        colors={'Trial': '#d5a357', 'Active': '#56a69a', 'Paused': '#a092bc', 'Churned': '#c77e88'},
                        state_order=['Trial', 'Active', 'Paused', 'Churned'],
                        row_height=row_height, cell_gap=gap, show_labels=show_labels)
st.write('Selected subjects:', ', '.join(result.selected_subjects) or 'None')
with st.expander('Inspect selected period'):
    st.write(result.inspected_cell or 'Click a run to inspect a period.')
with st.expander('Inspect visible subjects'):
    st.dataframe(result.summaries, hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import sequence_chart
result = sequence_chart(
    ["Jan", "Feb", "Mar", "Apr"],
    {"A": ["Trial", "Active", "Active", "Paused"],
     "B": ["Trial", None, "Active", "Active"]},
    key="journeys", colors={"Trial": "#d5a357", "Active": "#56a69a", "Paused": "#a092bc"},
)
st.write(result.selected_subjects)
''', language='python')
