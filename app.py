"""Run with: streamlit run app.py"""
import streamlit as st
from streamlit_net_bars import net_bar_chart

st.set_page_config(page_title="Net Bars · Interactive contributions", page_icon="📊", layout="wide")
st.caption("STREAMLIT COMPONENT / INTERACTIVE CHARTS")
st.title("See what moves the net.")
st.write("Explore positive and negative contributions. Hide a series to see how the balance changes.")

periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
series = {
    "Product sales": [95, 110, 105, 130, 145, 160, 155, 175, 190, 180, 210, 230],
    "Services": [40, 42, 50, 48, 55, 62, 60, 68, 70, 75, 80, 90],
    "Operating costs": [-70, -75, -78, -80, -88, -90, -92, -100, -105, -110, -115, -120],
    "Marketing": [-25, -35, -30, -45, -40, -50, -48, -45, -55, -50, -65, -70],
}
result = net_bar_chart(periods, series, key="contributions", title="Monthly contributions", height=420)
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
    st.code('''from streamlit_net_bars import net_bar_chart

result = net_bar_chart(
    x=["Jan", "Feb", "Mar"],
    series={"Revenue": [100, 120, 140], "Costs": [-60, -70, -80]},
    key="my_chart",
)
st.write(result.net)  # [40, 50, 60] when both series are visible
''', language="python")
