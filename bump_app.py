"""Run with streamlit run bump_app.py."""
import streamlit as st
from streamlit_interactive_charts import bump_chart

st.set_page_config(page_title='Bump · Ranking explorer', layout='wide')
st.caption('INTERACTIVE CHARTS / BUMP')
st.title('Follow the leaders.')
st.write('See who rises, who falls, and when the order changes.')
periods = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
scores = {
    'Atlas': [82, 85, 81, 78, 88, 94, 92, 89],
    'Birch': [76, 80, 89, 93, 91, 87, 90, 95],
    'Cedar': [90, 88, 86, 85, 83, 85, 88, 92],
    'Delta': [69, 76, 81, 89, 92, 90, 94, 91],
    'Ember': [85, 83, 82, 84, 86, 89, 87, 90],
}
st.caption('Illustrative scores · 5 competitors · 8 periods · March includes a tie')
with st.expander('Customize the plot'):
    line_width = st.slider('Line width', 0.0, 8.0, 2.5, .5)
    point_size = st.slider('Marker radius', 1.0, 12.0, 4.0, .5)
    show_points = st.checkbox('Display markers', True)
    show_end_labels = st.checkbox('Display endpoint names', True)
    show_grid = st.checkbox('Display grid', True)
result = bump_chart(periods, scores, key='competitors', title='Monthly leaderboard',
                    xlabel='Month', line_width=line_width, point_size=point_size,
                    show_points=show_points, show_end_labels=show_end_labels, show_grid=show_grid)
st.write('Highlighted:', ', '.join(result.selected_series) or 'None')
with st.expander('Inspect visible trajectories'):
    st.dataframe([{'Competitor': row['name'], 'Period': period, 'Score': row['values'][i], 'Rank': row['ranks'][i]}
                  for row in result.trajectories for i, period in enumerate(periods)], hide_index=True, width='stretch')
with st.expander('Use in your own app'):
    st.code('''from streamlit_interactive_charts import bump_chart
result = bump_chart(
    ["Jan", "Feb", "Mar"],
    {"A": [10, 14, 12], "B": [12, 11, 15]},
    key="leaderboard", higher_is_better=True,
    colors={"A": "#4477AA", "B": "#CC6677"},
)
st.write(result.selected_series)
''', language='python')
