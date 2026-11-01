"""Validated, shared appearance keywords for all chart components."""
from math import isfinite
import re

BOOLEAN_OPTIONS = {'show_title', 'show_legend', 'show_controls', 'show_description', 'show_status', 'show_tooltips'}
NUMERIC_OPTIONS = {'card_padding': (0, 64), 'card_radius': (0, 40), 'card_border_width': (0, 8),
                   'grid_width': (0, 8), 'grid_opacity': (0, 1), 'title_fontweight': (100, 900)}
COLOR_OPTIONS = {'background_color', 'text_color', 'card_border_color', 'grid_color'}


SIZE_SELECTORS = {
    'font_size': ':root,button,select,.intro,.hint,.selection',
    'title_fontsize': 'h3',
    'tick_fontsize': 'svg text.axis-label,svg .bin-count,svg text.tick-label',
    'label_fontsize': 'svg .axis-title,svg .column-name,svg .row-name',
    'legend_fontsize': '.legend,.legend button,.net-key,.groups button,.categories button',
    'tooltip_fontsize': '.tooltip',
    'annotation_fontsize': 'svg .segment-label,svg .panel-title,svg .state-label,svg .cell-value',
}


def prepare_appearance(options):
    """Accept pixel sizes (6–48), font family, and axis-title text.

    Unknown options raise TypeError so misspelled keywords never silently fail.
    """
    unknown = options.keys() - (SIZE_SELECTORS.keys() | {'font_family', 'xlabel', 'ylabel', 'title_align', 'legend_align'} | BOOLEAN_OPTIONS | NUMERIC_OPTIONS.keys() | COLOR_OPTIONS)
    if unknown:
        raise TypeError(f"Unknown appearance keyword(s): {', '.join(sorted(unknown))}")
    result = {}
    for name, value in options.items():
        if name in SIZE_SELECTORS:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not 6 <= value <= 48:
                raise ValueError(f'{name} must be a finite number between 6 and 48 pixels.')
        elif name in BOOLEAN_OPTIONS:
            if not isinstance(value, bool):
                raise ValueError(f'{name} must be a boolean.')
        elif name in NUMERIC_OPTIONS:
            low, high = NUMERIC_OPTIONS[name]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not low <= value <= high:
                raise ValueError(f'{name} must be a finite number between {low} and {high}.')
        elif name in COLOR_OPTIONS:
            if not isinstance(value, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
                raise ValueError(f'{name} must be a #RRGGBB color.')
        elif name in ('title_align', 'legend_align'):
            if value not in ('left', 'center', 'right'):
                raise ValueError(f'{name} must be left, center, or right.')
        elif not isinstance(value, str):
            raise ValueError(f'{name} must be a string.')
        result[name] = value
    return result


def appearance_assets(js, css):
    """Apply instance-local styles without changing the renderer's identity."""
    import json
    from pathlib import Path
    axis_helpers = (Path(__file__).parent/'frontend'/'axes.js').read_text(encoding='utf-8').replace('export function ', 'function ')
    helper = '''
function applyAppearance(root, data) {
  const options=data.appearance || {};
  root.parentNode.querySelector('[data-chart-appearance]')?.remove();
  const selectors=SELECTORS;
  const style=document.createElement('style');
  style.setAttribute('data-chart-appearance','');
  root.append(style);
  for(const [key,selector] of Object.entries(selectors)) {
    if(options[key]!==undefined) style.sheet.insertRule(`${selector}{font-size:${options[key]}px !important}`);
  }
  const plot=data.plot_style || {};
  const rule=(selector,property,value)=>{if(value!==undefined)style.sheet.insertRule(`${selector}{${property}:${value} !important}`);};
  const cards='.card,.mekko-card,.horizon-card,.paired-card,.upset-card,.raincloud-card,.box-card,.histogram-card,.bump-card,.lasagna-card,.waterfall-card,.bullet-card,.sequence-card,.ridgeline-card';
  const px=value=>value===undefined?undefined:`${value}px`;
  rule(cards,'padding',px(options.card_padding));
  rule(cards,'border-radius',px(options.card_radius));
  rule(cards,'border-width',px(options.card_border_width));
  rule(cards,'border-color',options.card_border_color);
  rule(cards,'background',options.background_color);
  rule(cards,'color',options.text_color);
  rule('h3','font-weight',options.title_fontweight);
  rule('h3','text-align',options.title_align);
  rule('.heading>div:first-child','flex',options.title_align?'1':undefined);
  rule('.legend,.groups,.categories','justify-content',({left:'flex-start',center:'center',right:'flex-end'})[options.legend_align]);
  rule('h3','display',options.show_title===false?'none':undefined);
  rule('.legend,.groups,.categories,.color-legend,.horizon .filters,.lasagna details','display',options.show_legend===false?'none':undefined);
  rule('.controls,.zoom-controls,.mode-row,.filters,.window-controls,.selection button,.actions,.heading button,.lasagna details','display',options.show_controls===false?'none':undefined);
  rule('.intro,.hint','display',options.show_description===false?'none':undefined);
  rule('.selection,.status,.footnote,.comparison-summary','display',options.show_status===false?'none':undefined);
  rule('.tooltip','display',options.show_tooltips===false?'none':undefined);
  rule('.grid','stroke-width',px(options.grid_width));
  rule('.grid','opacity',options.grid_opacity);
  rule('.grid','stroke',options.grid_color);
  rule('.grid','display',plot.show_grid===false?'none':undefined);
  rule('.bump-card','background',plot.background_color);
  rule('.bump','color',plot.text_color);
  rule('.bump-line','stroke-width',plot.line_width);
  rule('.trajectory:not(.selected):not(:hover):not(:focus) .bump-line','opacity',plot.line_opacity);
  rule('.grid','stroke',plot.grid_color);
  rule('.card,.mekko-card,.horizon-card,.paired-card,.upset-card','background',plot.background_color);
  rule('.net-bars,.mekko,.horizon,.paired-change,.upset','color',plot.text_color);
  rule('.bar','opacity',plot.bar_opacity);
  rule('.intersection-bar','opacity',plot.bar_opacity);
  rule('.net-line,.original-line,.detail-line,.pair-line','stroke-width',plot.line_width);
  rule('.net-line','stroke',plot.net_color);
  rule('.net-key:not(.original-key)','color',plot.net_color);
  rule('.original-key','color',plot.reference_color);
  rule('.net-dot','fill',plot.net_color);
  rule('.original-line','stroke',plot.reference_color);
  rule('.original-dot','stroke',plot.reference_color);
  rule('.net-dot,.original-dot','display',plot.show_points===false?'none':undefined);
  rule('.segment','opacity',plot.segment_opacity);
  rule('.segment','stroke-width',plot.segment_border_width);
  rule('.segment','stroke',plot.segment_border_color);
  rule('.segment-label','display',plot.show_segment_labels===false?'none':undefined);
  rule('.band','opacity',plot.band_opacity);
  rule('.pair:not(.selected):not(.is-hovered) .pair-line','opacity',plot.line_opacity);
  rule('.hist-bar','fill',plot.histogram_color);
  rule('.intersection:not(.selected) .intersection-bar,.intersection:not(.selected) .dot.active','fill',plot.bar_color);
  rule('.set-bar','fill',plot.set_bar_color);
  rule('.intersection.selected .intersection-bar,.intersection.selected .dot.active','fill',plot.selected_color);
  rule('.intersection.selected .connector','stroke',plot.selected_color);
  rule('.intersection:not(.selected) .connector','stroke',plot.bar_color);
  root.style.fontFamily=options.font_family || '';
  root.style.fontSize=options.font_size ? `${options.font_size}px` : '';
}
function addAxisTitles(svg,data,width,height) {
  const options=data.appearance || {},ns='http://www.w3.org/2000/svg';
  const label=(text,attrs)=>{
    const node=document.createElementNS(ns,'text');node.textContent=text;
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    node.setAttribute('class','axis-title');node.setAttribute('fill','currentColor');
    node.setAttribute('text-anchor','middle');svg.append(node);
  };
  if(options.xlabel)label(options.xlabel,{x:width/2,y:height-5});
  if(options.ylabel)label(options.ylabel,{transform:`translate(16 ${height/2}) rotate(-90)`});
}
'''.replace('SELECTORS', json.dumps(SIZE_SELECTORS))
    # Each renderer owns a shadow root. Add styles once per component invocation;
    # keep them outside the drawing root, which is replaced on interaction.
    helper = helper.replace('root.append(style);', 'root.parentNode.append(style);')
    import re
    js = re.sub(r"(const root\s*=\s*parentElement.querySelector\([^;]+;)",
                r'\1\n  applyAppearance(root,data);', js, count=1)
    return axis_helpers + helper + js, css
