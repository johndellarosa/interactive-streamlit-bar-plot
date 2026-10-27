"""Run with: streamlit run app.py"""
import streamlit as st
from streamlit_interactive_charts import net_bar_chart

st.set_page_config(page_title="Net Bars · Interactive contributions", page_icon="📊", layout="wide")
st.caption("STREAMLIT COMPONENT / INTERACTIVE CHARTS")
st.title("See what moves the net.")
st.write("Explore positive and negative contributions. Hide a series to see how the balance changes.")

months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
years = [2024, 2025, 2026]
periods = [f"{month} {year}" for year in years for month in months]
seasonal_values = {
    "Product sales": [95, 110, 105, 130, 145, 160, 155, 175, 190, 180, 210, 230],
    "Services": [40, 42, 50, 48, 55, 62, 60, 68, 70, 75, 80, 90],
    "Operating costs": [-70, -75, -78, -80, -88, -90, -92, -100, -105, -110, -115, -120],
    "Marketing": [-25, -35, -30, -45, -40, -50, -48, -45, -55, -50, -65, -70],
}
# Deterministic sample data: retain monthly seasonality while revenue grows
# 12% and expenses 8% per year. Values stay stable across Streamlit reruns.
series = {
    name: [round(value * (1 + (0.12 if value >= 0 else 0.08) * year_index))
           for year_index in range(len(years)) for value in values]
    for name, values in seasonal_values.items()
}
st.caption("Illustrative data · Jan 2024–Dec 2026 · 36 monthly periods")
with st.expander("Customize the plot"):
    bar_width = st.slider("Bar width (fraction of category spacing)", .05, 1.0, .38, .01)
    custom_width = st.checkbox("Override automatic bar width", False)
    net_color = st.color_picker("Net line color", "#243247")
    line_width = st.slider("Line width", 0.0, 8.0, 2.2, .2)
    show_grid = st.checkbox("Display grid", True)
    show_points = st.checkbox("Display line markers", True)
style_options = dict(net_color=net_color, line_width=line_width, show_grid=show_grid, show_points=show_points)
if custom_width:
    style_options['bar_width'] = bar_width
result = net_bar_chart(periods, series, key="contributions", title="Monthly contributions", height=420, **style_options)
col1, col2, col3 = st.columns(3)
col1.metric("Total visible net", f"{sum(result.net):,.0f}")
col2.metric("Visible series", f"{len(result.visible)} / {len(series)}")
col3.metric("Hidden series", len(result.hidden))
with st.expander("Inspect the current net values"):
    st.dataframe({"Month": periods, "Net": result.net,
                  "Displayed line (cumulative)" if result.cumulative else "Displayed line": result.line_values},
                 hide_index=True, width="stretch")
    st.write("Hidden:", ", ".join(result.hidden) or "None")
with st.expander("Use in your own app"):
    st.code('''from streamlit_interactive_charts import net_bar_chart

result = net_bar_chart(
    x=["Jan", "Feb", "Mar"],
    series={"Revenue": [100, 120, 140], "Costs": [-60, -70, -80]},
    key="my_chart",
)
st.write(result.net)  # [40, 50, 60] when both series are visible
''', language="python")
