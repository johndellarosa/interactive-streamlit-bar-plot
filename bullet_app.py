"""Run with streamlit run bullet_app.py."""
import streamlit as st
from streamlit_interactive_charts import bullet_chart

st.set_page_config(page_title='Bullet · Performance explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / BULLET')
st.title('Put performance in context.')
st.write('Compare actual measurements with targets and qualitative ranges. Select metrics or edit a target to explore the gap.')
values = {'Revenue': 82, 'New customers': 116, 'Renewal rate': 91, 'Satisfaction': 87}
targets = {'Revenue': 100, 'New customers': 100, 'Renewal rate': 90, 'Satisfaction': 92}
ranges = {'Revenue': [60, 80, 120], 'New customers': [70, 100, 140],
          'Renewal rate': [75, 85, 100], 'Satisfaction': [70, 85, 100]}
st.caption('Illustrative metrics · Different units use independent row scales by default')
with st.expander('Customize the plot'):
    higher = st.checkbox('Higher values meet the target', True)
    editable = st.checkbox('Allow target editing', True)
    row_height = st.slider('Row height', 80, 180, 105)
    show_values = st.checkbox('Display measurement labels', True)
result = bullet_chart(values, targets, ranges=ranges, key='performance', title='Actual versus target',
                      higher_is_better=higher, editable_targets=editable, row_height=row_height, show_values=show_values)
st.write('Selected:', ', '.join(result.selected_metrics) or 'None')
with st.expander('Inspect visible metrics'):
    st.dataframe(result.visible_metrics, hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import bullet_chart
result = bullet_chart(
    {"Revenue": 82, "Customers": 116}, {"Revenue": 100, "Customers": 100},
    ranges={"Revenue": [60, 80, 120], "Customers": [70, 100, 140]},
    key="performance", editable_targets=True,
)
st.write(result.selected_metrics)
st.write(result.targets)
''', language='python')
