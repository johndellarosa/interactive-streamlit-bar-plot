"""Run with streamlit run upset_app.py."""
import streamlit as st
from streamlit_interactive_charts.upset import upset_chart

st.set_page_config(page_title='UpSet · Membership explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / UPSET')
st.title('Find the overlap.')
st.write('Explore exact combinations of product adoption. Select an intersection to inspect its customers.')
customers = [f'Customer {i:03d}' for i in range(1, 121)]
sets = {
    'Analytics': [c for i, c in enumerate(customers) if i % 7 < 5],
    'Automation': [c for i, c in enumerate(customers) if i % 5 < 3],
    'Reporting': [c for i, c in enumerate(customers) if i % 4 < 2],
    'Integrations': [c for i, c in enumerate(customers) if i % 3 == 0],
}
st.caption('Illustrative data · 120 customers · 4 products · Includes customers using none')
with st.expander("Customize the plot"):
    bar_color = st.color_picker("Intersection color", "#477eaa")
    selected_color = st.color_picker("Selected intersection color", "#d09045")
    dot_size = st.slider("Membership dot radius", 1.0, 12.0, 5.0, .5)
    show_grid = st.checkbox("Display grid", True)
style_options = dict(bar_color=bar_color, selected_color=selected_color, dot_size=dot_size, show_grid=show_grid)
result = upset_chart(sets, universe=customers, key='adoption', title='Which products are used together?', **style_options)
st.write(f'{len(result.selected_ids)} customers selected')
with st.expander('Inspect selected customers'):
    st.dataframe([{'Customer': i, **{name: i in members for name, members in sets.items()}}
                  for i in result.selected_ids], hide_index=True, width='stretch')
with st.expander('Inspect matching intersections'):
    st.dataframe([{'Combination': ', '.join(r['sets']) or 'None', 'Records': r['count']}
                  for r in result.visible_intersections], hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts.upset import upset_chart
result = upset_chart(
    {"A": ["one", "two"], "B": ["two", "three"]},
    key="memberships", title="Set overlap", tick_fontsize=13,
)
st.write(result.selected_ids)
''', language='python')
