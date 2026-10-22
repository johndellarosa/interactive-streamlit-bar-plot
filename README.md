# Streamlit Net Bars

A reusable Streamlit component with diverging stacked bars and an overlaid net line.
Click any bar segment to hide that entire series across all x positions. Toggle
legend buttons to restore individual series, or select **Show all**.
Use **Undo** to reverse visibility changes one at a time, including legend
toggles and Show all. Undo is disabled until a change is made. History is kept
per chart across Streamlit reruns for the current session.

Positive values stack above the centered zero line; negative values stack below.
The line is the signed sum of the **visible** series at each position. All hidden
means a zero line. The symmetric y scale adjusts to the visible contributions.

Toggle **Cumulative net** to show the running signed sum of the visible net
values, starting at the first x position. For net values `[40, 50, -20]`, the
cumulative line is `[40, 90, 70]`. Positions use the supplied order, so sort time
data before passing it in. Bars keep their per-position contributions, and the
shared axis expands to fit the line. Toggle off to return to per-position net.
Mode survives reruns; hiding, restoring, and Undo work in either mode. Undo
continues to reverse visibility changes, independently of the selected mode.

**Copy image** copies a PNG of the current chart, title, visible-series legend,
and net mode at double resolution. It includes the full plot even when the chart
scrolls horizontally. Paste into an app that accepts images. Copying requires a
browser that supports image clipboard writes and a secure context (HTTPS or
localhost). A **Download PNG** link is offered after copying, and also as a
fallback if clipboard access is unavailable or denied. Copying does not change
visibility, mode, or Undo history.

## Run the demo

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -e .
.venv\Scripts\python -m streamlit run app.py
```

## Use the component

```python
import streamlit as st
from streamlit_net_bars import net_bar_chart

result = net_bar_chart(
    x=["Jan", "Feb", "Mar"],
    series={"Revenue": [100, 120, 140], "Costs": [-60, -70, -80]},
    key="cashflow",  # unique, stable key per chart
    title="Monthly cashflow",
    height=420,  # plot height in pixels; header and legend add height
)
st.write(result.net)      # [40, 50, 60] with all series visible
st.write(result.hidden)   # names of hidden series
st.write(result.visible)  # names of visible series
st.write(result.cumulative)  # whether cumulative mode is selected
st.write(result.line_values)  # displayed line, including cumulative mode
```

Pass a mapping of names to equally sized numeric sequences. DataFrame columns
work with `series={name: df[name].tolist() for name in columns}`. Values must be
finite; fill or drop missing values before calling. Labels are displayed in the
provided order; duplicate labels remain distinct positions. Series names are
their identities, so use stable names when updating data. Visibility survives
Streamlit reruns; new series start visible and removed series are ignored.

Use `on_change=callback` for a Streamlit callback when visibility or line mode changes. The
returned net values are recalculated in Python from the current visibility and
input data. Multiple chart instances are independent when given different keys.

## Development

The frontend is plain JavaScript and SVG, with no Node build or CDN dependency.
Assets ship inside the Python package. The component uses Streamlit Components
v2 (Streamlit 1.51 or newer). Bars support Enter/Space and provide native hover
tooltips. The legend also supports hiding zero-only series. Long charts scroll
horizontally; long x labels are abbreviated in the plot and shown fully in tooltips.

```powershell
python -m unittest discover -s tests -v
Get-Content streamlit_net_bars/frontend/chart.js -Raw | node --input-type=module --check
```

The demo uses illustrative monthly contributions, not real financial data.
