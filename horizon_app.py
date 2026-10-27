"""Run independently: streamlit run horizon_app.py"""
from datetime import date, timedelta
from math import sin, cos

import streamlit as st
from streamlit_interactive_charts.horizon import horizon_chart

st.set_page_config(page_title="Horizon · Time-series explorer", layout="wide")
st.caption("INTERACTIVE CHARTS / HORIZON")
st.title("More signals. Less space.")
st.write("Compare many time series at once. Color encodes the direction and magnitude of change; expand a row to see its ordinary line plot.")

x = [(date(2026, 1, 1) + timedelta(days=i)).isoformat() for i in range(90)]
names = ["North · Flagship", "North · Outlet", "South · Flagship", "South · Outlet",
         "East · Flagship", "East · Outlet", "West · Flagship", "West · Outlet"]
series = {
    name: [round(12 * sin(i / 7 + j * .6) + 6 * cos(i / 3.7 + j) + (j - 3.5) * 2
                 + (15 if j == 2 and 38 <= i <= 52 else 0)
                 - (18 if j == 5 and 60 <= i <= 75 else 0), 2) for i in range(90)]
    for j, name in enumerate(names)
}
st.caption("Illustrative daily deviation from target (%) · Jan–Mar 2026 · 8 stores · 90 days")
with st.expander("Customize the plot"):
    band_opacity = st.slider("Band opacity", 0.0, 1.0, 1.0, .05)
    line_width = st.slider("Expanded line width", 0.0, 8.0, 1.8, .2)
    positive_palette = st.selectbox("Positive palette", ["Blue", "Green"])
style_options = dict(band_opacity=band_opacity, line_width=line_width)
if positive_palette == "Green":
    style_options['positive_colors'] = ['#e5f5e0', '#c7e9c0', '#a1d99b', '#41ab5d', '#006d2c']
result = horizon_chart(x, series, key="store_horizons", title="Daily performance against target", **style_options)
with st.expander("Inspect baselines and deviations"):
    st.dataframe(result.summaries, hide_index=True, width="stretch")
    st.write("Window:", x[result.start], "to", x[result.end])
with st.expander("Use in your own app"):
    st.code('''from streamlit_interactive_charts.horizon import horizon_chart

result = horizon_chart(
    x=["Jan", "Feb", "Mar", "Apr"],
    series={"North": [12, -4, 8, 18], "South": [-6, 10, -2, 7]},
    key="regional_signals",
    baseline="zero",
    bands=3,
)
''', language="python")
