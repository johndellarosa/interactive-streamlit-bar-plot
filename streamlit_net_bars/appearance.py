"""Validated, shared appearance keywords for all chart components."""
from math import isfinite


SIZE_SELECTORS = {
    'font_size': ':root,button,select,.intro,.hint,.selection',
    'title_fontsize': 'h3',
    'tick_fontsize': 'svg text.axis-label,svg .bin-count,svg text.tick-label',
    'label_fontsize': 'svg .axis-title,svg .column-name,svg .row-name',
    'legend_fontsize': '.legend,.legend button,.net-key,.groups button,.categories button',
    'tooltip_fontsize': '.tooltip',
    'annotation_fontsize': 'svg .segment-label,svg .panel-title',
}


def prepare_appearance(options):
    """Accept pixel sizes (6–48), font family, and axis-title text.

    Unknown options raise TypeError so misspelled keywords never silently fail.
    """
    unknown = options.keys() - (SIZE_SELECTORS.keys() | {'font_family', 'xlabel', 'ylabel'})
    if unknown:
        raise TypeError(f"Unknown appearance keyword(s): {', '.join(sorted(unknown))}")
    result = {}
    for name, value in options.items():
        if name in SIZE_SELECTORS:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not 6 <= value <= 48:
                raise ValueError(f'{name} must be a finite number between 6 and 48 pixels.')
        elif not isinstance(value, str):
            raise ValueError(f'{name} must be a string.')
        result[name] = value
    return result


def appearance_assets(js, css):
    """Apply instance-local styles without changing the renderer's identity."""
    import json
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
  rule('.grid','display',plot.show_grid===false?'none':undefined);
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
    return helper + js, css
