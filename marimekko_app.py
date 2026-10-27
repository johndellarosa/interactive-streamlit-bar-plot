"""Run independently with: streamlit run marimekko_app.py"""
import streamlit as st
from streamlit_interactive_charts.marimekko import marimekko_chart

st.set_page_config(page_title="Marimekko · Composition explorer", layout="wide")
st.caption("INTERACTIVE CHARTS / MARIMEKKO")
st.title("The size and the share.")
st.write("Explore how category size and segment composition fit together. Filter the data to compare scenarios.")

categories = ["North America", "Europe", "Asia Pacific", "Latin America", "Other"]
series = {
    "Enterprise": [420, 270, 180, 75, 40],
    "Small business": [230, 190, 210, 85, 35],
    "Consumer": [150, 140, 260, 95, 45],
    "Public sector": [100, 120, 50, 45, 30],
}
st.caption("Illustrative market data · column width = market size · segment height = composition")
with st.expander("Customize the plot"):
    segment_opacity = st.slider("Segment opacity", 0.0, 1.0, 1.0, .05)
    segment_border_width = st.slider("Segment border width", 0.0, 8.0, 2.0, .5)
    show_segment_labels = st.checkbox("Display segment labels", True)
    show_grid = st.checkbox("Display grid", True)
style_options = dict(segment_opacity=segment_opacity, segment_border_width=segment_border_width,
                     show_segment_labels=show_segment_labels, show_grid=show_grid)
result = marimekko_chart(categories, series, key="markets", title="Market composition by region", **style_options)
with st.expander("Inspect category totals"):
    st.dataframe(result.category_totals, hide_index=True, width="stretch")
    st.write("Hidden segments:", ", ".join(result.hidden_series) or "None")
    st.write("Hidden categories:", ", ".join(result.hidden_categories) or "None")
with st.expander("Use in your own app"):
    st.code('''from streamlit_interactive_charts.marimekko import marimekko_chart

result = marimekko_chart(
    categories=["North", "South", "West"],
    series={"Product A": [120, 80, 50], "Product B": [60, 100, 90]},
    key="market_mix",
)
st.write(result.visible_total)
''', language="python")
