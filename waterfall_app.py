"""Run with streamlit run waterfall_app.py."""
import streamlit as st
from streamlit_interactive_charts import waterfall_chart

st.set_page_config(page_title='Waterfall · Contribution explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / WATERFALL')
st.title('See what builds the total.')
st.write('Select contributions to explore how removing them changes the running balance.')
labels = ['Product growth', 'Services', 'Staffing', 'Marketing', 'Efficiency', 'Other costs']
values = [85, 45, -65, -30, 40, -25]
scenario_values = [100, 55, -60, -24, 50, -20]
groups = {'Revenue': ['Step 1', 'Step 2'], 'Operating costs': ['Step 3', 'Step 4'],
          'Adjustments': ['Step 5', 'Step 6']}
subtotals = {'Step 2': 'After revenue', 'Step 4': 'Operating subtotal'}
st.caption('Illustrative contributions · Starting balance 120 · Signed changes in supplied order')
with st.expander('Customize the plot'):
    positive_color = st.color_picker('Increase color', '#56a69a')
    negative_color = st.color_picker('Decrease color', '#c77e88')
    total_color = st.color_picker('Total color', '#4b80b6')
    bar_width = st.slider('Bar width', .1, 1.0, .65, .05)
    show_values = st.checkbox('Display value labels', True)
    show_connectors = st.checkbox('Display connectors', True)
    show_reference = st.checkbox('Display original total reference', True)
result = waterfall_chart(labels, values, start=120, key='bridge', title='From starting balance to final result',
                         ylabel='Contribution', positive_color=positive_color, negative_color=negative_color,
                         total_color=total_color, bar_width=bar_width, show_values=show_values,
                         show_connectors=show_connectors, show_reference=show_reference,
                         scenario=scenario_values, baseline_label='Baseline', scenario_label='Proposed',
                         groups=groups, collapsed_groups=['Operating costs'], subtotals=subtotals)
first, second, third = st.columns(3)
first.metric('Current total', f'{result.total:,.2f}')
second.metric('Original total', f'{result.original_total:,.2f}')
third.metric('Difference', f'{result.total-result.original_total:+,.2f}')
scenario_col, delta_col = st.columns(2)
scenario_col.metric('Proposed total', f'{result.scenario_total:,.2f}')
delta_col.metric('Proposed − baseline', f'{result.scenario_total-result.total:+,.2f}')
with st.expander('Inspect retained contributions'):
    st.dataframe(result.steps, hide_index=True, width='stretch')
    st.write('Selected IDs:', result.selected_ids)
    st.write('Excluded IDs:', result.excluded_ids)
with st.expander('Inspect checkpoints and displayed groups'):
    st.dataframe(result.checkpoints, hide_index=True, width='stretch')
    st.dataframe(result.displayed_steps, hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import waterfall_chart
result = waterfall_chart(
    ["Sales", "Costs", "Savings"], [50, -30, 10],
    start=100, key="bridge", ylabel="Amount", ids=["sales", "costs", "savings"],
    subtotals={"costs": "Operating subtotal"},
    groups={"Operations": ["sales", "costs"]}, collapsed_groups=["Operations"],
    scenario=[60, -25, 15], scenario_label="Proposed",
)
st.write(result.total)
st.write(result.excluded_ids)
''', language='python')
