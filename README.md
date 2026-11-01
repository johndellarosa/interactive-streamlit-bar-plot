# Streamlit Interactive Charts

Fourteen interactive chart types for Streamlit, with selections, filtering,
structured Python results, and customizable typography, colors and layout.
Requires Python 3.10+ and Streamlit 1.51 or later (below 2.0).

## Install

```shell
python -m pip install --upgrade interactive-streamlit-bar-plot
```

The PyPI distribution remains `interactive-streamlit-bar-plot`; import charts
from `streamlit_interactive_charts`. Existing `streamlit_net_bars` imports remain
supported and share the same implementations, result types and component state.
For the unreleased source version, clone this repository and run
`python -m pip install -e .`.

## Available charts

| Chart / API | Interactive features | Demo file |
| --- | --- | --- |
| [Net bars](#net-bars) · `net_bar_chart` | Hide series, Undo, original/filtered net, cumulative mode, fixed axes, box zoom, copy PNG | `app.py` |
| [Marimekko](#marimekko-composition-chart) · `marimekko_chart` | Hide categories/series, recalculate shares, Undo | `marimekko_app.py` |
| [Horizon](#horizon-time-series-chart) · `horizon_chart` | Baselines, folded bands, time windows, expand rows | `horizon_app.py` |
| [Paired change](#paired-change-distribution) · `paired_change_chart` | Linked pair/delta selection, group filters, exclude observations | `paired_change_app.py` |
| [UpSet](#upset-membership-chart) · `upset_chart` | Exact intersections, require/exclude sets, select matching records | `upset_app.py` |
| [Raincloud](#raincloud-distributions) · `raincloud_chart` | Density, box and points, smoothing, observation selection | `raincloud_app.py` |
| [Bump](#bump-rank-trajectories) · `bump_chart` | Rank/value modes, trajectory highlighting, competitor visibility | `bump_app.py` |
| [Lasagna](#lasagna-longitudinal-heatmaps) · `lasagna_chart` | Row sorting, raw/centered colors, time windows, cell selection | `lasagna_app.py` |
| [Box plot](#interactive-box-plots) · `box_plot` | Select points/quartile intervals/outliers, exclude, Undo | `box_app.py` |
| [Histogram](#interactive-histograms) · `histogram_chart` | Rebin, count/percent/density modes, select/exclude records, reference distribution | `histogram_app.py` |
| [Waterfall](#interactive-waterfall-contributions) · `waterfall_chart` | Exclude contributions, subtotal checkpoints, scenario comparison, expandable groups | `waterfall_app.py` |
| [Bullet](#bullet-performance-charts) · `bullet_chart` | Metric selection, target editing, status filters, shared scales | `bullet_app.py` |
| [Sequence](#categorical-sequence-plots) · `sequence_chart` | Inspect state runs, select subjects, state/transition filters, time windows | `sequence_app.py` |
| [Ridgeline](#ridgeline-distributions) · `ridgeline_chart` | Select groups, brush value ranges, smoothing, overlap and sorting | `ridgeline_app.py` |

Each chart uses a unique, stable `key`, returns a chart-specific result object,
and accepts `on_change` callbacks. Interaction details and constructor options
are documented below. Shared [appearance keywords](#appearance-keywords-all-charts)
control text sizes, axis titles, cards, legends and tooltips.

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

Automatic numeric axes use round intervals (1, 2, 2.5, or 5 times a power of
ten), expanding bounds outward to retain all plotted values. For example, a
padded bar range of ±358.4 becomes ±400 with 200-unit ticks. Small magnitudes
use the same rule with appropriate decimal/scientific labels. Fixed-axis
behavior still uses the full input; explicit limits and drag-zoom bounds remain
exact, with round ticks inside them. Numeric axes in histograms, paired-change,
box/raincloud plots, UpSet counts and bump value mode follow the same rule.
Count axes use integer ticks. Requested tick counts are targets rather than
exact counts when rounded intervals are needed.

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

Replace `app.py` with any demo file listed above to explore another chart.
The net-bar demo includes three years of monthly data.

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

## Customization

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

The five charts listed above also accept `background_color`, `text_color`, `show_grid`, and
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

The constructors also accept these layout and presentation keywords. Omitting
them preserves the current appearance. These settings do not reset selections,
exclusions or visibility state.

| Keyword | Accepted values |
| --- | --- |
| `card_padding` | Inner padding in pixels, 0–64 |
| `card_radius` | Border radius in pixels, 0–40 |
| `card_border_width` | Border width in pixels, 0–8 |
| `card_border_color` | `#RRGGBB` |
| `background_color`, `text_color` | `#RRGGBB` |
| `title_fontweight` | Numeric weight, 100–900 |
| `title_align`, `legend_align` | `"left"`, `"center"`, `"right"` |
| `grid_width`, `grid_opacity`, `grid_color` | Width 0–8 pixels, opacity 0–1, hex color; where grid lines exist |
| `show_title`, `show_legend` | Booleans, default unchanged/visible |
| `show_controls` | Hide/show toolbar, filters and header action buttons |
| `show_description`, `show_status` | Hide/show instructional text or status/footer text |
| `show_tooltips` | Hide/show custom hover cards; native SVG titles/accessibility labels remain |

For a compact presentation, use `card_padding=12`, `show_description=False`,
`show_status=False`. Hiding controls does not disable direct plot interaction.
For Lasagna, `show_legend=False` hides the color scale and row-visibility panel;
`show_controls=False` also hides the row-visibility panel.

```python
result = histogram_chart(
    {"A": [1, 2, 2, 3, 5], "B": [2, 4, 4, 6]}, key="custom_hist",
    bins=8, bar_gap=4, tick_count=6, show_bin_counts=True,
    selected_color="#CC8844", reference_color="#667788",
    title_fontsize=24, title_fontweight=700, title_align="center",
    legend_align="right", card_padding=20, card_radius=10,
    card_border_color="#CCDDEE", grid_width=1, grid_opacity=0.15,
    show_description=False,
)
```

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
node --test tests/test_axis.mjs tests/test_marimekko.mjs tests/test_horizon.mjs tests/test_paired_change.mjs tests/test_upset.mjs tests/test_raincloud.mjs tests/test_bump.mjs tests/test_lasagna.mjs tests/test_box.mjs tests/test_histogram.mjs tests/test_nice_axes.mjs tests/test_waterfall.mjs tests/test_bullet.mjs tests/test_sequence.mjs tests/test_ridgeline.mjs
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

## Bump rank trajectories

Run `streamlit run bump_app.py` for the separate demo.

```python
from streamlit_interactive_charts import bump_chart

result = bump_chart(
    ["Jan", "Feb", "Mar"],
    {"A": [10, 14, 12], "B": [12, 11, 15]},
    key="leaderboard", higher_is_better=True, mode="rank",
    colors={"A": "#4477AA", "B": "#CC6677"},
    line_width=3, point_size=5, xlabel="Month",
)
```

The input contains **scores**, not precomputed ranks. Rank 1 appears at the top;
equal scores use competition ranking (1, 1, 3). Tied trajectories can overlap.
Highlight a line to inspect it or hide competing lines with legend chips.
Ranks and axes always use the full input, so hiding competitors preserves the
original leaderboard. The toolbar switches between ranks and actual values and
between higher/lower-is-better ranking. Actual-value mode uses a conventional
upward-increasing axis. Hover for the period, rank and underlying score; keyboard
focus reports the last period, and Enter/Space toggles highlights. Multiple
competitors may be highlighted, and all-hidden views offer recovery.

`BumpResult` exposes `selected_series`, `hidden_series`, `mode`,
`higher_is_better`, and visible `trajectories` with original `values` and `ranks`.
Period labels must be unique, score sequences aligned and finite. Period spacing
is equal, in input order. Single periods/competitors and constant scores work.
State persists under a stable key; changes to the Python `mode` or
`higher_is_better` defaults reset that toolbar setting.

Styling includes shared typography, `colors` by competitor, `line_width` (0–8),
`line_opacity` (0–1), `point_size` (radius 1–12), `show_points`,
`show_end_labels`, `show_grid`, `grid_color`, `background_color`, and `text_color`.
Single-period plots retain a marker even with `show_points=False`. Endpoint
labels may overlap when ranks tie; full names remain in the legend/tooltips.

## Lasagna longitudinal heatmaps

Run `streamlit run lasagna_app.py` for the separate demo.

```python
from streamlit_interactive_charts import lasagna_chart

result = lasagna_chart(
    ["Week 1", "Week 2", "Week 3"],
    {"Subject A": [10, None, 14], "Subject B": [15, 12, 11]},
    key="subjects", xlabel="Study week", row_height=28,
    palette=["#3d78a5", "#f7f7f7", "#b75046"],
    missing_color="#e4e7eb", cell_gap=1,
)
```

Subjects form rows and periods form equally spaced columns. `None` explicitly
marks missing data; NaN/infinite values are rejected. Click cells or press
Enter/Space to select observations; missing cells can be inspected but are not
selectable. Hover/focus reports subject, period and value. Row visibility is in
a collapsible panel. Sort by input order, full-row mean, or last observed value;
all-missing rows sort last. The time-window controls hide periods without
recomputing sorting or color limits. Wide heatmaps scroll horizontally.

Raw mode compares absolute values across subjects. Row-centered mode subtracts
each subject's full-input mean and uses symmetric color limits. Choose a
diverging palette for centered deviations. Color limits always use all subjects
and periods; optionally supply both `vmin` and `vmax` to fix them explicitly.
Outside values saturate at the palette endpoints; actual values are retained.
Missing cells use a separate color and are excluded from means.

Customize `palette` (2–9 hex colors), `missing_color`, `row_height` (18–80),
`cell_gap` (0–4), `show_values` and shared typography. Inline values appear only
when cells are at least 35 pixels wide. The demo includes live styling controls.
`scale="raw"` or `"centered"` sets the initial toolbar mode. A stable key retains
interaction state; changing the Python scale resets that toolbar setting.

`LasagnaResult` returns `selected_cells` (subject, period, index, raw value),
`hidden_rows`, `start`, `end`, `scale`, `sort`, and per-subject `summaries` for
the current window. Selection outside the window is retained internally and
reappears on restoring the window; returned selections include visible cells
only. Changing period identities/order clears selection. Subjects use stable
names. All-missing rows, constant values and single-period inputs are supported.

## Interactive box plots

Run `streamlit run box_app.py` for the separate demo.

```python
from streamlit_interactive_charts import box_plot

result = box_plot(
    {"Control": [10, 12, 13, 15, 40], "Treatment": [12, 14, 18, 20]},
    key="outcomes", xlabel="Score", show_mean=True,
    colors={"Control": "#4477AA", "Treatment": "#CC6677"},
)
st.write(result.selected_ids)
st.write(result.excluded_ids)
```

Select individual points (click or Enter/Space) or select all current outliers.
Click one of the four quartile regions along a box/its tails to replace the
selection with observations in that value interval. These are disjoint intervals:
`≤ Q1`, `(Q1, median]`, `(median, Q3]`, and `> Q3`. Ties stay together, so these
selections need not contain equal counts; some intervals can be empty. Quartile
regions remain selectable by keyboard for constant/single-point samples.

**Exclude selected** removes selected observations and recalculates quartiles,
whiskers, means and outliers. **Undo exclusion** restores prior exclusions;
**Restore all** restores all observations/groups and is undoable for exclusions.
Group chips hide whole groups independently of exclusion history. The default
fixed axis retains the full-input scale; disable it to fit retained visible
data. Explicit `xlim` overrides automatic/fixed scaling and clips marks only.
Exclusions represent exploratory filtering, not data deletion or outlier advice.

Quartiles use linear interpolation; whiskers reach observed values inside
`whis × IQR` fences (default 1.5), with a minimum extent of the quartile edges.
Outliers are values strictly outside these fences. Empty and single-point groups
work. Inputs must be finite numeric observations; optional `ids` maps group
names to globally unique string IDs. Without IDs, group/position IDs are used;
supply stable IDs when reordering input. Independent observations are assumed
for display purposes; no statistical tests are performed.

Customize `whis` (0–5), `row_height` (90–240), `colors`, `point_size`,
`point_alpha`, `box_alpha`, `jitter`, `show_points`, `show_mean`, `show_grid`,
`xlim` and the shared text keywords. `BoxPlotResult` returns `selected_ids`,
`selected_points`, `excluded_ids`, `hidden_groups`, `visible_points` and
recalculated per-group `summaries`. Visibility, selection and exclusion history
persist under a stable unique key; `on_change` supports a callback.

## Interactive histograms

Run `streamlit run histogram_app.py` for the separate demo.

```python
from streamlit_interactive_charts import histogram_chart

result = histogram_chart(
    {"A": [1, 2, 2, 3, 5], "B": [2, 4, 4, 6]},
    key="distribution", bins=8, normalization="count", xlabel="Value",
)
st.write(result.selected_ids)
```

Groups stack in shared, equal-width bins based on the **full input range**.
Bins include their left edge and exclude the right edge, except the final bin
which includes the maximum. Constant values receive a padded domain. Empty
groups are supported. Use finite numeric observations and optional globally
unique string `ids` as with raincloud/box plots.

Click a bin or press Enter/Space to toggle selection of its retained records
across visible groups. Multiple bins can be selected. Rebinning preserves
selected record identities; partially selected bins are outlined and described
in tooltips. Group visibility removes hidden-group records from selection.
Exclude selected records, undo exclusions, restore all, or clear selection.
The default dashed outline compares each bin with visible groups **before
exclusions**, using its own normalization; it follows group visibility.

The bin slider ranges from 1–100. Count mode displays counts; percent sums to
100 over all visible groups; density integrates to 1 over all visible groups.
Groups are not normalized independently. With no visible records these values
are zero. Exclusions change counts/normalization but preserve bin edges. Y axes
fit the filtered and reference heights. Input changes to Python `bins` or
`normalization` reset that corresponding toolbar setting.

Customize `height` (280–1000), `colors` by group, `bar_opacity` (0–1),
`show_grid`, `show_reference`, and shared typography. The demo includes live
styling controls. `HistogramResult` returns `selected_ids`, `selected_points`,
`excluded_ids`, `hidden_groups`, `visible_points`, `normalization`, and `bins`
(low/high edges, count, displayed value, record IDs). State persists under a
stable key; supply stable IDs when reordering observations. `on_change` supports
a callback. Exclusions affect exploration only; input data is unchanged.

Additional histogram constructor options: `bar_gap` (0–20 pixels, capped to 80%
of a bin's width), `tick_count` (2–12 target ticks, both axes), `selected_color`,
`reference_color` (hex colors), and `show_bin_counts` (labels appear for bins
at least 24 pixels wide). Defaults retain two-pixel gaps and target five ticks.

## Interactive waterfall contributions

Run `streamlit run waterfall_app.py` for the separate demo.

```python
from streamlit_interactive_charts import waterfall_chart

result = waterfall_chart(
    ["Sales", "Costs", "Savings"], [50, -30, 10],
    start=100, key="bridge", ylabel="Amount",
    positive_color="#56a69a", negative_color="#c77e88",
)
st.write(result.total)
st.write(result.excluded_ids)
```

Values are **relative changes** applied in the supplied order. Start and final
total bars are anchored at zero and cannot be excluded. Click contribution bars
or press Enter/Space to select them. Exclude selections to recompute every
subsequent step; Undo reverses exclusion/restoration changes. Restore individual
excluded steps with their buttons, or restore all. A dashed line optionally
marks the original final total, allowing direct comparison after exclusion.

Fixed axes (default) cover all possible retained subsets so removing a negative
step cannot clip a newly higher balance. Turn Fixed axis off to fit current
steps and the original-total reference. Automatic bounds use round ticks;
explicit `ylim=(low, high)` preserves exact bounds and clips marks visually.
Long charts scroll horizontally. Duplicate display labels are allowed; optional
unique string `ids` provide stable identities (otherwise `Step 1`, etc.). Supply
IDs when reordering inputs. Zero contributions, negative balances, empty input
and all-excluded states are supported. Inputs must be finite.

Customize `start_label`, `total_label`, `height`, `fixed_axis`,
`positive_color`, `negative_color`, `total_color`, `neutral_color`,
`selected_color`, `bar_width` (0.1–1 category fraction), `bar_opacity`,
`tick_count` (2–12 target), `show_values`, `show_connectors`, `show_reference`,
`show_grid`, `ylim`, and shared typography/card settings. The demo includes live
styling controls. `WaterfallResult` exposes `selected_ids`, `excluded_ids`,
retained `steps` (ID, label, contribution value, start/end running totals),
`start`, `total`, `original_total`, and `fixed_axis`. A stable key preserves
interaction state; changing the Python `fixed_axis` default resets that toggle.
`on_change` supports a callback. Input data remains unchanged.

### Waterfall checkpoints, scenarios and expandable groups

```python
result = waterfall_chart(
    ["Product", "Services", "Staffing", "Marketing", "Savings"],
    [85, 45, -65, -30, 40],
    ids=["product", "services", "staff", "marketing", "savings"],
    start=120, key="comparison",
    subtotals={"services": "After revenue", "marketing": "Operating subtotal"},
    groups={"Revenue": ["product", "services"], "Costs": ["staff", "marketing"]},
    collapsed_groups=["Costs"],
    scenario=[100, 55, -60, -24, 50],
    scenario_start=120, baseline_label="Baseline", scenario_label="Proposed",
)
```

`subtotals` maps a step ID to a checkpoint label, inserted **after that original
input position**. Checkpoints are zero-anchored running balances, not additional
contributions; they cannot be selected/excluded. They remain present and
recalculate even when the anchor step is excluded.

`groups` maps a name to existing step IDs. Groups must be non-overlapping,
contiguous runs in the input; member IDs are put in input order. Groups are flat
(no nesting). Put checkpoints at group boundaries: checkpoints inside a group
are rejected so collapse cannot silently remove a checkpoint. `collapsed_groups`
sets initial collapsed names. Buttons expand/collapse each group without changing
totals or exclusions. Collapsed bars show retained-member net contributions;
selecting one selects all its retained IDs. Excluding a collapsed group excludes
those actual records, and individual restore buttons still work. Entirely
excluded groups have no contribution bar, but their checkpoint remains.

`scenario` is an aligned sequence of alternative contributions of the same
length as `values`. Optional `scenario_start` defaults to `start`. Exclusions
apply to the same IDs in both paths. The comparison toolbar switches between
side-by-side bars (baseline left/pale, scenario right/solid) or either path alone.
Tooltips show both contribution/balance values and their balance difference.
Checkpoints and final totals compare both paths. Fixed axes cover every retained
subset in **both** scenarios, including when one path is temporarily hidden.

`result.total`, `original_total`, and `steps` remain the baseline values for
compatibility, regardless of view. Additional fields are `scenario_total`,
`original_scenario_total` (`None` without a scenario), `checkpoints` (anchor ID,
label, baseline/scenario totals), `displayed_steps`, `collapsed_groups`, and
`view`. Display aggregation never changes `steps` or selected record identities.
Group expansion and comparison view persist with the chart key; changing
`collapsed_groups` in Python resets the initial collapsed state. The demo now
shows all three features together.

## Bullet performance charts

Run `streamlit run bullet_app.py` for the separate demo.

```python
from streamlit_interactive_charts import bullet_chart

result = bullet_chart(
    {"Revenue": 82, "Customers": 116},
    {"Revenue": 100, "Customers": 100},
    ranges={"Revenue": [60, 80, 120], "Customers": [70, 100, 140]},
    key="performance", editable_targets=True,
)
st.write(result.selected_metrics)
st.write(result.targets)
```

Bars encode measurements, vertical markers encode targets, and three background
bands encode supplied qualitative ranges (upper bounds, starting at zero).
Measurements and targets must be finite and nonnegative. Range boundaries must
be three positive strictly increasing values. Omitted ranges default to 60%,
80% and 100% of the larger original measurement/target, or 1 for all-zero data.
Values/targets beyond the bands expand the axis. `higher_is_better=False` changes
target-status comparisons; band colors and meanings remain the caller's choice.

Click rows or press Enter/Space to select metrics. Filter target-met/missed
metrics, sort by value or actual-minus-target gap, and toggle shared scales.
Independent row axes are default; shared scales should be used only for metrics
with comparable units. Shared-axis limits include all input metrics regardless
of status filters. With `editable_targets=True`, use the target editor and Apply
target to save a session override. Reset targets restores the inputs. Changed
targets show the original target as a dashed marker; ranges are not recalculated.
Changing an input target discards its old session override. Inputs are not edited.

Customize `row_height` (80–180), `colors` per metric, three `range_colors`,
`target_color`, `show_values`, and the shared appearance keywords. A stable key
retains selection, filters and edited targets. `BulletResult` exposes visible
`selected_metrics`, `visible_metrics` (value, target, ranges, met, gap), all
effective `targets`, `shared_scale`, and `filter`. Filtered-out selections are
retained internally. Target editing is optional; no values are draggable.

## Categorical sequence plots

Run `streamlit run sequence_app.py` for the separate demo.

```python
from streamlit_interactive_charts import sequence_chart

result = sequence_chart(
    ["Jan", "Feb", "Mar", "Apr"],
    {"A": ["Trial", "Active", "Active", "Paused"],
     "B": ["Trial", None, "Active", "Active"]},
    key="journeys", xlabel="Month",
    colors={"Trial": "#d5a357", "Active": "#56a69a", "Paused": "#a092bc"},
)
st.write(result.selected_subjects)
st.write(result.inspected_cell)
```

Each row follows a subject over equally spaced input periods. Adjacent identical
states merge into runs. `None` denotes missing observations; missing values
break transitions, and repeats do not count as transitions. Subjects and periods
need unique stable names; each sequence must match the period count. States are
non-empty strings. All-missing inputs and single-period sequences are supported.

Click a run to inspect its period and toggle the subject selection. Click row
names or use Enter/Space for subject selection. Hover/focus reports state and
run bounds; keyboard run selection inspects its first displayed period. Legend
buttons filter subjects containing a state. Combine state/adjacent-transition
filters, sort by transition count or lexicographic state sequence, and select a
time window. Filters and sorting always use full sequences, independent of the
display window. All-missing subjects sort last in sequence order. Reset filters
restores the full window without clearing subject selection.

Customize `state_order` (each observed state exactly once; defaults to first
appearance), `colors` per state, `missing_color`, `row_height` (18–80),
`cell_gap` (0–4 pixels between runs), `show_labels`, and shared appearance.
Provide explicit colors for many states because the default eight-color palette
cycles. Wide plots scroll horizontally. `SequenceResult` returns visible
`selected_subjects`, ordered `visible_subjects`, `inspected_cell` (subject,
period, index, state), `start`, `end`, `contains`, `transition`, and `summaries`
(full-sequence transitions and window missing counts). Filtered-out selections
are retained internally; inspection returns None outside the visible window.
Both components support `on_change` callbacks.

## Ridgeline distributions

Run `streamlit run ridgeline_app.py` for the separate demo.

```python
from streamlit_interactive_charts import ridgeline_chart

result = ridgeline_chart(
    {"A": [10, 12, 13, 15, 18], "B": [14, 16, 16, 19, 22]},
    key="distributions", xlabel="Value", smoothing=1.0, overlap=1.2,
    colors={"A": "#4b80b6", "B": "#56a69a"},
)
st.write(result.selected_groups)
st.write(result.selected_ids)
```

Each ridge shows an equal-peak Gaussian kernel density, with the same robust
Silverman bandwidth rule as the raincloud chart. Heights compare **shape**, not
sample size or absolute probability density. Counts are labeled separately.
No boundary correction is applied. Singleton/constant groups show a marker
rather than a density; empty groups show a message. Finite observations and
optional globally unique string IDs are validated as for raincloud plots.

Click ridges or row names (or press Enter/Space) to select multiple groups.
Legend chips control visibility. Sort by full-group mean or median; empty groups
sort last. Adjust smoothing or overlap without changing the underlying records.
The shared numeric x axis uses all input groups and keeps round limits when
filtering; optional `xlim` preserves explicit limits and clips marks only.

Choose **Brush values**, then drag horizontally to select an inclusive value
interval. A click or Escape clears that interval. The numeric minimum/maximum
inputs and Apply range provide a keyboard-accessible alternative. A range alone
selects observations in all visible groups. When groups are selected too, records
must satisfy **both** the group selection and range. Selecting groups without a
range selects all their observations. With no group/range selection, no records
are selected. Hiding groups removes them from selection.
Brushing selects records; it does not filter or recompute the density curves.

Customize `row_height` (35–120), `smoothing` (0.3–3), `overlap` (0.5–2.5 times
row spacing), `colors`, `fill_opacity`, `line_width` (0–8), `selected_color`,
`show_median`, `show_grid`, `xlim` and shared typography/card settings. Smoothing
and overlap also have toolbar controls; changing their Python defaults resets
the corresponding saved toolbar value. `RidgelineResult` exposes
`selected_groups`, `selected_ids`, `selected_points`, `hidden_groups`,
`value_range`, `smoothing`, `overlap`, `sort`, and ordered group `summaries`.
Selections persist with a stable key; provide stable IDs when reordering input.
`on_change` supports a callback. The demo includes live styling controls.

## Development

Install release tools and run the Python and JavaScript checks from the repository root:

```shell
python -m pip install -e ".[release]"
python -m unittest discover -s tests -v
node --test tests/*.mjs
```

JavaScript calculation tests require Node.js. Chart assets are bundled locally;
no separate frontend build or CDN connection is required.

## Releases

See [PUBLISHING.md](PUBLISHING.md) for the GitHub Actions Trusted Publishing
setup and release procedure. Licensed under MIT; copyright John Della Rosa.
