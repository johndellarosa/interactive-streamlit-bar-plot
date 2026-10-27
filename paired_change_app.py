"""Run independently: streamlit run paired_change_app.py"""
from math import sin, cos
import streamlit as st
from streamlit_interactive_charts.paired_change import paired_change_chart

st.set_page_config(page_title="Paired change · Distribution explorer", layout="wide")
st.caption("INTERACTIVE CHARTS / PAIRED CHANGE")
st.title("Every change has a pair.")
st.write("Track individual observations between two measurements, then explore the distribution of their differences.")
ids = [f"Item {i+1:02d}" for i in range(48)]
groups = [["North", "Central", "South"][i % 3] for i in range(48)]
before = [round(52 + 13 * sin(i * .73) + 5 * cos(i * .27), 2) for i in range(48)]
after = [round(value + [7, 1, -4][i % 3] + 6 * sin(i * .51), 2) for i, value in enumerate(before)]
after[9] = before[9]  # Include an unchanged pair in the sample.
st.caption("Illustrative measurements · 48 matched items · 3 groups · Change = after − before")
with st.expander("Customize the plot"):
    point_size = st.slider("Point radius", 1.0, 12.0, 3.3, .1)
    line_opacity = st.slider("Pair line opacity", 0.0, 1.0, .5, .05)
    increase_color = st.color_picker("Increase color", "#3f7da0")
    decrease_color = st.color_picker("Decrease color", "#c18258")
    show_grid = st.checkbox("Display grid", True)
style_options = dict(point_size=point_size, line_opacity=line_opacity, increase_color=increase_color,
                     decrease_color=decrease_color, show_grid=show_grid)
result = paired_change_chart(before, after, ids=ids, groups=groups, key="paired_items",
                             title="Matched observations and their changes", **style_options)
with st.expander("Inspect visible pairs"):
    st.dataframe(result.visible_pairs, hide_index=True, width="stretch")
    st.write("Selected IDs:", ", ".join(result.selected_ids) or "None")
    st.write("Selected-pair summary:", result.selected_summary)
with st.expander("Use in your own app"):
    st.code('''from streamlit_interactive_charts.paired_change import paired_change_chart

result = paired_change_chart(
    before=[10, 15, 20, 12], after=[14, 13, 25, 12],
    ids=["A", "B", "C", "D"], groups=["North", "North", "South", "South"],
    key="measurements",
)
st.write(result.selected_ids)
st.write(result.summary)
''', language="python")
