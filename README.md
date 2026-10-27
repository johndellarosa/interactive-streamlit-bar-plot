# Streamlit Interactive Charts

A collection of interactive Streamlit charts: net bars, Marimekko composition,
horizon time series, paired-change distributions, UpSet membership plots, and raincloud distributions.

Install using the existing PyPI distribution name:

```shell
pip install interactive-streamlit-bar-plot
```

Import using the new package name:

```python
from streamlit_interactive_charts import (
    net_bar_chart, marimekko_chart, horizon_chart,
    paired_change_chart, upset_chart,
)
```

The PyPI distribution and GitHub repository retain their existing names.
Existing `streamlit_net_bars` imports remain supported and share the same
implementations, result types, and component state with the new imports.
The new import name will be available after installing a release containing
this change; source users can install it now with `pip install -e .`.

## Net bars

A reusable Streamlit component with diverging stacked bars and an overlaid net line.
Click any bar segment to hide that entire series across all x positions. Toggle
legend buttons to restore individual series, or select **Show all**.
Use **Undo** to reverse visibility changes one at a time, including legend
toggles and Show all. Undo is disabled until a change is made. History is kept
per chart across Streamlit reruns for the current session.

Positive values stack above the centered zero line; negative values stack below.
The line is the signed sum of the **visible** series at each position. All hidden
means a zero line. **Fixed axis** is enabled by default: the symmetric y scale
stays unchanged when hiding, restoring, or undoing series visibility. Turn it
off to fit the visible contributions and both net lines. Axis mode survives
Streamlit reruns independently of visibility history. Changing the input data
or switching cumulative mode recalculates the scale. In cumulative mode, the
fixed scale reserves room for any subset of the original series so hiding
negative contributions cannot clip the filtered line.
Axis limits follow the magnitude of nonzero data, including values such as
`1e-6`. Tick precision adjusts to the visible range and zoom level; very small
or large numbers use scientific notation. Tooltips also preserve small values.
Only an all-zero view uses a fallback range of -1 to 1.

Use **Interaction** to choose **Zoom X axis**, **Zoom Y axis**, or **Zoom both
axes**, then drag a region of the plot to zoom into it. **Reset zoom** restores the full view; a
double-click in a drag-zoom mode also resets it. Choose **Click bars** to resume
hiding series directly, or use the legend while in zoom mode.

Zoom survives visibility changes, Undo, and Streamlit reruns. The fixed-axis
setting controls the unzoomed scale; an explicit y zoom takes precedence.
Changing cumulative or fixed-axis mode resets y zoom but preserves x zoom.
Changing the input data resets the zoom. Cumulative totals always include the
preceding periods, even when x zoom hides them. Copied PNGs use the current
zoomed view, without the drag-selection overlay.

A dashed **Original net** line shows the signed sum of all input series, while
the solid line shows the net of the currently visible series. The reference
stays unchanged when hiding or restoring series and remains visible even when
all bars are hidden. With every series visible, the two lines overlap. Both
use running totals in cumulative mode, and the axis includes both lines.
The reference is recalculated when the input data changes. Copy image and
Download PNG include both lines and their legend keys.

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

Once published on PyPI, install with `python -m pip install interactive-streamlit-bar-plot`.

## Use the component

```python
import streamlit as st
from streamlit_interactive_charts import net_bar_chart

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

### Plot-specific styling

Each demo now includes a **Customize the plot** panel. Beyond the shared text
settings, these Python keywords apply to the indicated chart:

| Chart | Additional keywords |
| --- | --- |
| Net bars | `colors`, `bar_width`, `bar_opacity`, `net_color`, `reference_color`, `line_width`, `point_size`, `show_points` |
| Marimekko | `colors`, `segment_opacity`, `segment_border_width`, `segment_border_color`, `show_segment_labels` |
| Horizon | `positive_colors`, `negative_colors`, `band_opacity`, `line_width` (expanded line) |
| Paired change | `colors` (group mode), `increase_color`, `decrease_color`, `unchanged_color`, `line_width`, `line_opacity`, `point_size`, `histogram_color` |
| UpSet | `bar_color`, `set_bar_color`, `selected_color`, `dot_size`, `bar_opacity` |

These five charts also accept `background_color`, `text_color`, `show_grid`, and
`grid_color` (grid options affect charts with grid lines). Colors use `#RRGGBB`;
`colors` maps series/group names to colors, with defaults for omitted names.
Horizon color ramps contain exactly five colors in light-to-dark order; the
legend and bands use the same ramp. Opacity values range from 0 to 1. Line and
border widths range from 0 to 8 pixels; point/dot radii from 1 to 12 pixels.
Net-bar `bar_width` is a fraction of category spacing (0.05–1); omit it to keep
the existing automatic width/cap. Selection and hover can emphasize styled
marks. Styling changes preserve chart interaction state.

```python
net_bar_chart(
    months, data, key="cashflow",
    colors={"Revenue": "#4477AA", "Costs": "#CC6677"},
    bar_width=0.6, bar_opacity=0.85,
    net_color="#222222", reference_color="#999999",
    line_width=3, point_size=4, show_grid=False,
)
```

### Appearance keywords (all charts)

Each chart accepts these optional keyword arguments, using Matplotlib-style
names. Sizes are CSS pixels (numbers from 6 to 48). Omitted options preserve the
existing appearance; settings apply independently to each chart instance.

```python
result = net_bar_chart(
    x=["Jan", "Feb", "Mar"],
    series={"Revenue": [100, 120, 140], "Costs": [-60, -70, -80]},
    key="styled_cashflow",
    xlabel="Month", ylabel="Contribution ($)",
    title_fontsize=24, tick_fontsize=14, label_fontsize=16,
    legend_fontsize=14, tooltip_fontsize=14,
    font_family="Georgia, serif",
)
```

| Keyword | Controls |
| --- | --- |
| `font_size` | General interface text, buttons and descriptions |
| `font_family` | CSS font family, using fonts available in the browser |
| `title_fontsize` | Chart heading |
| `tick_fontsize` | Axis tick labels and histogram counts |
| `label_fontsize` | Axis titles, Marimekko column names, horizon row names |
| `legend_fontsize` | Legend text and visibility chips |
| `tooltip_fontsize` | Hover tooltip text |
| `annotation_fontsize` | Segment labels and paired-panel headings |
| `xlabel`, `ylabel` | Optional shared horizontal and vertical axis titles |

The same keywords work with `marimekko_chart`, `horizon_chart`, `paired_change_chart`, and `upset_chart`. Paired-change axis titles span the combined panels;
`before_label` and `after_label` still name the two measurements. Choose a larger
chart height when using large fonts. Unsupported keywords raise `TypeError`.

The frontend is plain JavaScript and SVG, with no Node build or CDN dependency.
Assets ship inside the Python package. The component uses Streamlit Components
v2 (Streamlit 1.51 or newer). Bars support Enter/Space and provide native hover
tooltips. The legend also supports hiding zero-only series. Long charts
automatically fit the available width, with narrower bars. Dense x labels are
spaced out to avoid overlapping; all categories remain plotted and full labels
are available in tooltips. The chart adjusts when its container is resized.

```powershell
python -m unittest discover -s tests -v
node --test tests/test_axis.mjs tests/test_marimekko.mjs tests/test_horizon.mjs tests/test_paired_change.mjs tests/test_upset.mjs tests/test_raincloud.mjs
Get-Content streamlit_net_bars/frontend/chart.js -Raw | node --input-type=module --check
```

The demo uses illustrative monthly contributions, not real financial data.

## Marimekko composition chart

A separate component and demo are available without changing the net-bar chart:

```powershell
.venv\Scripts\python -m streamlit run marimekko_app.py
```

```python
from streamlit_interactive_charts.marimekko import marimekko_chart

result = marimekko_chart(
    categories=["North", "South"],
    series={"Product A": [30, 10], "Product B": [10, 50]},
    key="market_mix",
)
```

Column width encodes category size; segment height encodes its within-category
share. Rectangle area encodes its share of the total. Click a segment or legend
chip to hide a series across categories. Category chips hide whole columns.
Hover or focus a rectangle for its value and shares; Enter/Space hides it.
Undo reverses selections and normalization changes; Show all restores visibility.

**Recalculate shares** (default) normalizes the remaining data to fill the chart.
**Keep original totals** preserves original column widths and segment positions,
leaving excluded areas empty. Zero-only columns have no area. All-zero or
all-hidden views show a recovery message. Values must be finite and nonnegative;
category labels must be unique. The input order is preserved.

The result provides `hidden_series`, `hidden_categories`, `recalculate`,
`original_total`, `visible_total`, and `category_totals`. Use a stable unique key
for each chart. Visibility, mode and Undo history persist across reruns; removed
series and categories are ignored. The existing net-bar API is unchanged.

## Horizon time-series chart

Run the separate horizon demo with:

```powershell
.venv\Scripts\python -m streamlit run horizon_app.py
```

```python
from streamlit_interactive_charts.horizon import horizon_chart

result = horizon_chart(
    x=["Jan", "Feb", "Mar", "Apr"],
    series={"North": [12, -4, 8, 18], "South": [-6, 10, -2, 7]},
    key="signals", baseline="zero", bands=3, row_height=44,
)
```

Each row folds deviations from its baseline into 2–5 overlaid magnitude bands.
Blue means positive deviation; orange means negative; darker shades represent
larger magnitudes. The displayed band width explains each color level. Click
a row to expand a conventional zero-centered line view; click again to collapse.
Hover for a synchronized crosshair and exact values/deviations across all rows.
Focus the plot and use Left/Right arrows to inspect points; Escape clears it.

Controls offer zero, per-series mean, or first-value baselines; a shared scale
or independent per-row scales; row sorting; time-window selection; series
visibility; and Show all. Baselines and band widths use the full original data
so window selection and hiding rows do not silently change color meaning.
Independent scales aid pattern comparison but do not compare absolute magnitude
between rows. Series names identify rows; x labels are equally spaced in the
provided order. Inputs must be finite, with no missing values.

`HorizonResult` contains `hidden_series`, `baseline`, `scale`, `bands`, `start`,
`end`, `expanded`, and `summaries` (baseline, last value/deviation and band width).
Controls and visibility persist under a stable unique key. All-zero data and
single-point series are supported; all-hidden views offer recovery controls.

## Paired-change distribution

Run the separate demo with `streamlit run paired_change_app.py`.

```python
from streamlit_interactive_charts.paired_change import paired_change_chart

result = paired_change_chart(
    before=[10, 15, 20, 12], after=[14, 13, 25, 12],
    ids=["A", "B", "C", "D"], groups=["North", "North", "South", "South"],
    key="measurements",
)
```

Connected before/after observations appear alongside a histogram and individual
points for their differences (`after - before`). Select pairs or histogram bins
to highlight the corresponding observations in both panels. Filter by group or
direction, color by group or direction, change bin counts, exclude selected
pairs, or restore all. Narrow screens stack the panels vertically.

Mean and median change describe the visible pairs; the dashed distribution line
marks their mean. Axis ranges use all input pairs so filtering keeps the scale
stable. Inputs must have matching lengths, unique IDs and finite numeric values;
missing observations are rejected. These are descriptive summaries.

`PairedChangeResult` exposes `selected_ids`, `excluded_ids`, `hidden_groups`,
`visible_pairs`, `summary`, and `selected_summary`. Selection and filters persist
across reruns under a stable key; optional `on_change` receives state changes.

## UpSet membership chart

Run `streamlit run upset_app.py` for the separate demo.

```python
from streamlit_interactive_charts.upset import upset_chart

result = upset_chart(
    {"Analytics": ["Alice", "Bob"], "Reporting": ["Bob", "Carol"]},
    universe=["Alice", "Bob", "Carol", "Dave"],  # optional: includes non-members
    key="overlap", title="Product adoption", max_intersections=30,
    tick_fontsize=13, label_fontsize=14,
)
st.write(result.selected_ids)
```

Each column counts an **exact**, exclusive membership combination. Filled dots
identify included sets; pale dots identify absent sets. For example, an A+B
column excludes records also in C. Set-size bars always show full-input counts.
String record IDs identify members; duplicates within each set count once.
An optional universe must contain every member and can add a “none” intersection.
Empty sets and empty universes are supported.

Click columns (or press Enter/Space) to select multiple intersections. Require
or exclude sets, set a minimum count, sort by size or degree, clear selection,
or reset filters. Filtering clears selection; sorting preserves it. Wide charts
scroll horizontally. `max_intersections` (1–200, default 30) limits displayed
columns; the summary and `visible_intersections` include all matching combinations.
Selected intersections outside the display cap remain selected until cleared.

`UpSetResult` returns `selected_ids`, `selected_intersections`,
`visible_intersections`, `required_sets`, `excluded_sets`, `set_sizes`, and
`total_records`. Set order follows the mapping; changing set names/order clears
selection. Filters persist with a stable unique key. The component accepts the
shared appearance keywords and `on_change` callback. `height` (180–700) controls
the upper bar panel; membership rows add height below it.

## Raincloud distributions

Run `streamlit run raincloud_app.py` for the separate demo.

```python
from streamlit_interactive_charts import raincloud_chart

result = raincloud_chart(
    {"Control": [10, 12, 13, 15], "Treatment": [12, 14, 14, 18, 20]},
    key="outcomes", xlabel="Score", smoothing=1.0, row_height=145,
    tick_fontsize=13, label_fontsize=14,
)
st.write(result.selected_ids)
```

Each horizontal row combines a half-density, a box plot and deterministically
jittered observations. Click points or press Enter/Space for multiple selection.
Toggle groups, clear selection, hide/show points, or adjust density smoothing.
Hiding a group clears its selected points and preserves the full-input scale.

Clouds use Gaussian kernel density estimation with a robust Silverman bandwidth
multiplied by `smoothing` (0.3–3). Equal peak heights compare shape, not sample
size; group counts are displayed separately. Curves are smoothed estimates and
can extend beyond observations; no boundary correction is applied. Boxes use
linearly interpolated quartiles, a median line and observed whisker endpoints
within 1.5 IQR. Single-point and constant groups omit the density; empty groups
show a message. All-zero and small-magnitude inputs are supported.

Provide finite numeric observations; groups may differ in size. Optional
`ids={group: ["record-id", ...]}` supplies globally unique string IDs; otherwise
IDs are generated from group names and positions (supply IDs when reordering
data). These are independent observations; IDs do not imply matched pairs.
`RaincloudResult` exposes `selected_ids`, `selected_points`, `hidden_groups`,
`visible_points`, and `smoothing`. A stable key preserves interaction state.
Shared appearance keywords and `on_change` work as with the other charts.

### Raincloud customization

The demo includes a **Customize the plot** panel with live controls. The Python
API also accepts these keywords:

```python
result = raincloud_chart(
    {"Control": [10, 12, 13, 15], "Treatment": [12, 14, 18, 20]},
    key="custom_outcomes",
    colors={"Control": "#336699", "Treatment": "#CC8855"},
    group_order=["Treatment", "Control"],
    point_size=5, point_alpha=0.6, jitter=20,
    cloud_alpha=0.35, box_alpha=0.8,
    show_density=True, show_box=True, show_points=True, show_grid=False,
    xlim=(0, 25), tick_count=6,
    xlabel="Score", title_fontsize=24, tick_fontsize=14,
)
```

| Keyword | Range / behavior |
| --- | --- |
| `colors` | Optional group-to-`#RRGGBB` mapping; unspecified groups retain defaults |
| `group_order` | Every group exactly once; controls row order |
| `point_size` | Point radius, 1–12 pixels |
| `point_alpha`, `cloud_alpha`, `box_alpha` | Opacity, 0–1; selected/focused points remain emphasized |
| `jitter` | Deterministic vertical spread, 0–24 pixels |
| `show_density`, `show_box`, `show_grid` | Toggle the corresponding layers |
| `show_points` | Initial point visibility; changing this argument resets the toolbar toggle |
| `xlim` | Optional increasing `(minimum, maximum)`; outside observations are clipped visually |
| `tick_count` | Number of evenly spaced axis labels, 2–12 |

Custom limits affect the display, not data filtering or summary calculations.
Selection counts can therefore include observations outside the visible range.
Styles can change across Streamlit reruns without resetting group visibility or
selection. `smoothing` initializes the toolbar setting; the toolbar choice then
persists under the chart key.

## Releases

See [PUBLISHING.md](PUBLISHING.md) for the GitHub Actions Trusted Publishing
setup and release procedure. Licensed under MIT; copyright John Della Rosa.
