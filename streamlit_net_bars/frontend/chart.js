// A fixed domain includes every possible visible-series net, so hiding a
// negative contribution cannot push a cumulative line outside the plot.
export function axisExtent(series, hidden, cumulative, fixedAxis) {
  const visible = series.filter(s => !hidden.has(s.name));
  const scaleSeries = fixedAxis ? series : visible;
  const prefixes = series.map(() => 0);
  let originalRunning = 0, filteredRunning = 0, extent = 1;
  for (let i = 0; i < series[0].values.length; i++) {
    const positive = scaleSeries.reduce((sum, s) => sum + Math.max(0, s.values[i]), 0);
    const negative = scaleSeries.reduce((sum, s) => sum + Math.min(0, s.values[i]), 0);
    const original = series.reduce((sum, s) => sum + s.values[i], 0);
    const filtered = visible.reduce((sum, s) => sum + s.values[i], 0);
    originalRunning += original;
    filteredRunning += filtered;
    extent = Math.max(extent, positive, -negative,
      Math.abs(cumulative ? originalRunning : original),
      Math.abs(cumulative ? filteredRunning : filtered));
    if (fixedAxis && cumulative) {
      series.forEach((s, j) => { prefixes[j] += s.values[i]; });
      extent = Math.max(extent,
        prefixes.reduce((sum, value) => sum + Math.max(0, value), 0),
        -prefixes.reduce((sum, value) => sum + Math.min(0, value), 0));
    }
  }
  return extent * 1.12;
}

export default function(component) {
  const {parentElement, data, setStateValue} = component;
  const root = parentElement.querySelector('.net-bars');
  const colors = ['#3b82b5', '#55b6a4', '#9c86cf', '#ed9b55', '#dc7081', '#a39567', '#6a97d6', '#b76bad'];
  let hidden = new Set(data.hidden);
  let cumulative = Boolean(data.cumulative);
  let fixedAxis = data.fixed_axis !== false;
  const signature = JSON.stringify([data.x, data.series]);
  let viewport = data.viewport?.signature === signature ? {...data.viewport} : {x: null, y: null, mode: 'inspect'};
  const saveView = () => {
    viewport.signature = signature;
    draw();
    setStateValue('viewport', {...viewport});
  };
  const clipId = `net-bars-clip-${crypto.randomUUID()}`;
  const history = (data.history || []).map(snapshot => [...snapshot]);
  function publish() {
    draw();
    setStateValue('history', history.map(snapshot => [...snapshot]));
    setStateValue('hidden', [...hidden]);
  }
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs = {}, text) => {
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const shape = (tag, attrs = {}, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [k,v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const fmt = value => new Intl.NumberFormat(undefined, {maximumFractionDigits: 2, notation: Math.abs(value) >= 10000 ? 'compact' : 'standard'}).format(value);
  function toggle(name) {
    history.push([...hidden]);
    if (hidden.has(name)) hidden.delete(name); else hidden.add(name);
    publish();
  }
  function draw() {
    root.replaceChildren();
    const card = make('div', {class: 'card'});
    const heading = make('div', {class: 'heading'});
    heading.append(make('h3', {}, data.title));
    const actions = make('div', {class: 'actions'});
    const copy = make('button', {type: 'button', title: 'Copy the current chart as a PNG image'}, 'Copy image');
    const copyFeedback = make('p', {class: 'copy-feedback', 'aria-live': 'polite'});
    function offerDownload(blob) {
      const download = make('a', {href: '#'}, 'Download PNG');
      download.onclick = event => {
        event.preventDefault();
        const url = URL.createObjectURL(blob);
        const link = make('a', {href: url, download: 'net-bars.png'});
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      copyFeedback.append(document.createTextNode(' '), download);
    }
    copy.onclick = async () => {
      copy.disabled = true;
      copyFeedback.replaceChildren(document.createTextNode('Copying image…'));
      let png;
      try {
        // Start writing during the click gesture. The image promise lets browsers
        // retain user activation while SVG rasterization finishes asynchronously.
        png = chartPng(svg, lineLabel);
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
          throw new Error('Image clipboard unavailable');
        }
        await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
        copyFeedback.textContent = 'Image copied. Paste it into your document or message.';
        offerDownload(await png);
      } catch (error) {
        try {
          const blob = await png;
          if (!blob) throw error;
          copyFeedback.textContent = 'Could not copy the image. You can download it instead: ';
          offerDownload(blob);
        } catch {
          copyFeedback.textContent = 'Could not create the image. Please try again.';
        }
      } finally {
        copy.disabled = false;
      }
    };
    const mode = make('button', {type: 'button', 'aria-pressed': String(cumulative),
      class: 'mode-toggle', title: 'Show a running total in x-axis order'}, 'Cumulative net');
    mode.onclick = () => {
      cumulative = !cumulative;
      viewport.y = null;
      draw();
      setStateValue('viewport', {...viewport, signature});
      setStateValue('cumulative', cumulative);
      root.querySelector('.mode-toggle')?.focus();
    };
    const axis = make('button', {type: 'button', 'aria-pressed': String(fixedAxis),
      class: 'axis-toggle', title: 'Keep the original scale when hiding series'}, 'Fixed axis');
    axis.onclick = () => {
      fixedAxis = !fixedAxis;
      viewport.y = null;
      draw();
      setStateValue('viewport', {...viewport, signature});
      setStateValue('fixed_axis', fixedAxis);
      root.querySelector('.axis-toggle')?.focus();
    };
    const undo = make('button', {type: 'button', title: 'Undo the last visibility change'}, 'Undo');
    undo.disabled = history.length === 0;
    undo.onclick = () => {
      if (!history.length) return;
      hidden = new Set(history.pop());
      publish();
    };
    const reset = make('button', {type: 'button'}, 'Show all');
    reset.disabled = hidden.size === 0;
    reset.onclick = () => {
      if (!hidden.size) return;
      history.push([...hidden]);
      hidden.clear();
      publish();
    };
    actions.append(copy, mode, axis, undo, reset);
    heading.append(actions);
    card.append(heading, make('p', {class: 'hint'}, 'Click a bar to hide its series. Use the legend to bring it back. ' +
      (cumulative ? 'Lines show running totals from the first position. ' : '') +
      'Solid = visible series; dashed = original net of all series.'));
    const legend = make('div', {class: 'legend', role: 'group', 'aria-label': 'Series visibility'});
    data.series.forEach((s, j) => {
      const button = make('button', {type: 'button', 'aria-pressed': String(!hidden.has(s.name)), 'aria-label': `${hidden.has(s.name) ? 'Show' : 'Hide'} ${s.name}`});
      const swatch = make('span', {class: 'swatch'});
      swatch.style.background = colors[j % colors.length];
      button.append(swatch, document.createTextNode(s.name));
      button.onclick = () => toggle(s.name);
      legend.append(button);
    });
    const lineLabel = cumulative ? 'Cumulative net' : 'Net';
    const originalLabel = cumulative ? 'Original cumulative net' : 'Original net';
    legend.append(make('span', {class: 'net-key'}, lineLabel));
    legend.append(make('span', {class: 'net-key original-key'}, originalLabel));
    card.append(legend);
    const zoomControls = make('div', {class: 'zoom-controls'});
    const interactionLabel = make('label', {}, 'Interaction ');
    const interaction = make('select', {'aria-label': 'Chart interaction'});
    for (const [value, label] of [['inspect','Click bars'],['both','Zoom both axes'],['x','Zoom X axis'],['y','Zoom Y axis']]) {
      interaction.append(make('option', {value}, label));
    }
    interaction.value = viewport.mode || 'inspect';
    interaction.onchange = () => {viewport.mode = interaction.value; saveView();};
    interactionLabel.append(interaction);
    zoomControls.append(interactionLabel);
    const fullX = [-.5, data.x.length-.5];
    const xDomain = viewport.x || fullX;
    const extent = axisExtent(data.series, hidden, cumulative, fixedAxis);
    const yDomain = viewport.y || [-extent, extent];
    const resetZoom = make('button', {type:'button'}, 'Reset zoom');
    resetZoom.disabled = !viewport.x && !viewport.y;
    resetZoom.onclick = () => {viewport.x = null; viewport.y = null; saveView();};
    zoomControls.append(resetZoom);
    zoomControls.append(make('span', {class:'zoom-hint'}, viewport.mode && viewport.mode !== 'inspect' ?
      'Drag a region to zoom. Double-click the plot to reset.' : 'Choose a zoom interaction to drag a region.'));
    card.append(zoomControls);
    const width = Math.max(600, Math.ceil(xDomain[1]-xDomain[0]) * 65);
    const height = data.height;
    const left = 70, right = 28, top = 28, bottom = 54;
    const plotW = width - left - right, plotH = height - top - bottom;
    const visible = data.series.filter(s => !hidden.has(s.name));
    const net = data.x.map((_,i) => visible.reduce((sum,s) => sum + s.values[i], 0));
    // The reference always uses every series in the current input, independent
    // of visibility. Convert both lines using the same selected mode.
    const originalNet = data.x.map((_,i) => data.series.reduce((sum,s) => sum + s.values[i], 0));
    let running = 0;
    const line = cumulative ? net.map(value => (running += value)) : net;
    let originalRunning = 0;
    const originalLine = cumulative ? originalNet.map(value => (originalRunning += value)) : originalNet;
    // Keep a symmetric scale so the zero line remains in the center.
    const y = v => top + plotH * (yDomain[1] - v) / (yDomain[1]-yDomain[0]);
    const step = plotW / (xDomain[1]-xDomain[0]);
    const x = i => left + step * (i-xDomain[0]);
    const svg = shape('svg', {viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': data.title});
    svg.style.minWidth = `${width}px`;
    svg.append(shape('title', {}, 'Interactive contributions and net. Bar segments are buttons; press Enter or Space to hide a series.'));
    const defs = shape('defs');
    const clip = shape('clipPath', {id:clipId});
    clip.append(shape('rect', {x:left, y:top, width:plotW, height:plotH}));
    defs.append(clip);
    svg.append(defs);
    const marks = shape('g', {'clip-path':`url(#${clipId})`});
    for (let tick = 0; tick <= 4; tick++) {
      const value = yDomain[0]+(yDomain[1]-yDomain[0])*tick/4;
      svg.append(shape('line', {x1: left, x2: width-right, y1: y(value), y2: y(value), class: tick === 0 ? 'zero' : 'grid'}));
      svg.append(shape('text', {x: left-10, y: y(value)+4, 'text-anchor': 'end'}, fmt(value)));
    }
    const positive = data.x.map(() => 0), negative = data.x.map(() => 0);
    data.series.forEach((s,j) => {
      if (hidden.has(s.name)) return;
      s.values.forEach((value,i) => {
        const stack = value >= 0 ? positive : negative;
        const from = stack[i];
        stack[i] += value;
        if (value === 0) return;
        const label = `${s.name}, ${data.x[i]}: ${fmt(value)}. Click to hide ${s.name}.`;
        const rect = shape('rect', {x: x(i)-step*.31, y: y(Math.max(from,stack[i])), width: step*.62, height: Math.abs(y(from)-y(stack[i])), fill: colors[j % colors.length], class: 'bar', tabindex: 0, role: 'button', 'aria-label': label});
        rect.append(shape('title', {}, label));
        rect.onclick = () => { toggle(s.name); focusLegend(s.name); };
        rect.onkeydown = e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); toggle(s.name); focusLegend(s.name);}};
        marks.append(rect);
      });
    });
    marks.append(shape('polyline', {points: originalLine.map((v,i) => `${x(i)},${y(v)}`).join(' '), class: 'original-line'}));
    originalLine.forEach((v,i) => {
      const dot = shape('circle', {cx: x(i), cy: y(v), r: 3, class: 'original-dot', tabindex: 0,
        'aria-label': `${data.x[i]} ${originalLabel.toLowerCase()}: ${fmt(v)}`});
      dot.append(shape('title', {}, `${data.x[i]} · ${originalLabel}: ${fmt(v)}`));
      marks.append(dot);
    });
    marks.append(shape('polyline', {points: line.map((v,i) => `${x(i)},${y(v)}`).join(' '), class: 'net-line'}));
    line.forEach((v,i) => {
      const dot = shape('circle', {cx: x(i), cy: y(v), r: 4, class: 'net-dot', tabindex: 0, 'aria-label': `${data.x[i]} ${lineLabel.toLowerCase()}: ${fmt(v)}`});
      dot.append(shape('title', {}, `${data.x[i]} · ${lineLabel}: ${fmt(v)}`));
      marks.append(dot);
      if (x(i) >= left && x(i) <= width-right) {
        svg.append(shape('text', {x: x(i), y: height-20, 'text-anchor': 'middle'}, data.x[i].length > 12 ? data.x[i].slice(0,11)+'…' : data.x[i]));
      }
    });
    svg.append(marks);
    if (viewport.mode && viewport.mode !== 'inspect') {
      const surface = shape('rect', {x:left, y:top, width:plotW, height:plotH, class:'zoom-surface',
        fill:'transparent', 'aria-label':'Drag to zoom the plot'});
      const selection = shape('rect', {class:'zoom-selection', visibility:'hidden'});
      let start = null;
      const position = event => {
        const point = svg.createSVGPoint();
        point.x = event.clientX; point.y = event.clientY;
        const local = point.matrixTransform(svg.getScreenCTM().inverse());
        return [Math.max(left, Math.min(width-right, local.x)), Math.max(top, Math.min(top+plotH,local.y))];
      };
      surface.onpointerdown = event => {
        if (event.button !== 0) return;
        event.preventDefault();
        start = position(event);
        surface.setPointerCapture(event.pointerId);
      };
      surface.onpointermove = event => {
        if (!start) return;
        const end = position(event);
        selection.setAttribute('visibility','visible');
        const sx = viewport.mode === 'y' ? left : Math.min(start[0],end[0]);
        const sy = viewport.mode === 'x' ? top : Math.min(start[1],end[1]);
        selection.setAttribute('x',sx); selection.setAttribute('y',sy);
        selection.setAttribute('width',viewport.mode === 'y' ? plotW : Math.abs(end[0]-start[0]));
        selection.setAttribute('height',viewport.mode === 'x' ? plotH : Math.abs(end[1]-start[1]));
      };
      surface.onpointercancel = () => {start=null; selection.setAttribute('visibility','hidden');};
      surface.onpointerup = event => {
        if (!start) return;
        const end = position(event), origin = start;
        start = null;
        selection.setAttribute('visibility','hidden');
        const zoomX = viewport.mode !== 'y', zoomY = viewport.mode !== 'x';
        if ((zoomX && Math.abs(end[0]-origin[0]) < 8) || (zoomY && Math.abs(end[1]-origin[1]) < 8)) return;
        if (zoomX) {
          const a = xDomain[0]+(Math.min(origin[0],end[0])-left)/plotW*(xDomain[1]-xDomain[0]);
          const b = xDomain[0]+(Math.max(origin[0],end[0])-left)/plotW*(xDomain[1]-xDomain[0]);
          const span = Math.min(data.x.length,Math.max(1,b-a));
          const low = Math.max(fullX[0],Math.min(fullX[1]-span,(a+b-span)/2));
          viewport.x = [low,low+span];
        }
        if (zoomY) viewport.y = [
          yDomain[1]-(Math.max(origin[1],end[1])-top)/plotH*(yDomain[1]-yDomain[0]),
          yDomain[1]-(Math.min(origin[1],end[1])-top)/plotH*(yDomain[1]-yDomain[0])];
        saveView();
      };
      surface.ondblclick = () => {viewport.x=null; viewport.y=null; saveView();};
      svg.append(surface,selection);
    }
    const scroll = make('div', {class: 'plot-scroll'});
    scroll.append(svg);
    card.append(scroll, make('p', {class: 'status', role: 'status', 'aria-live': 'polite'}, visible.length ? `${visible.length} of ${data.series.length} series visible · ` +
      (cumulative ? 'Cumulative net = running sum of visible net values in x-axis order' : 'Net = sum of visible values at each position') : 'All series hidden · Visible net is zero. The dashed line still shows the original net.'));
    card.append(copyFeedback);
    root.append(card);
  }
  async function chartPng(svg, lineLabel) {
    const plot = svg.cloneNode(true);
    // SVG images cannot inherit the shadow root's CSS. Freeze resolved styles,
    // including theme colors, so the PNG matches the chart and works offline.
    const sourceNodes = [svg, ...svg.querySelectorAll('*')];
    const cloneNodes = [plot, ...plot.querySelectorAll('*')];
    const properties = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin',
      'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'color'];
    sourceNodes.forEach((node, i) => {
      const computed = getComputedStyle(node);
      cloneNodes[i].removeAttribute('style');
      for (const property of properties) {
        cloneNodes[i].style.setProperty(property, computed.getPropertyValue(property));
      }
      cloneNodes[i].removeAttribute('tabindex');
    });
    plot.querySelectorAll('.zoom-surface, .zoom-selection').forEach(node => node.remove());
    const width = svg.viewBox.baseVal.width;
    const height = svg.viewBox.baseVal.height;
    const exportWidth = width + 40;
    const textColor = getComputedStyle(root).color;
    const background = getComputedStyle(root.querySelector('.card')).backgroundColor;
    const imageSvg = shape('svg', {xmlns: ns, width: exportWidth});
    imageSvg.append(shape('rect', {width: '100%', height: '100%', fill: background}));
    const text = (x, y, label, size = 13) => shape('text', {
      x, y, fill: textColor, 'font-family': 'Arial, sans-serif', 'font-size': size,
    }, label);
    imageSvg.append(text(24, 32, data.title, 20));
    let legendX = 24, legendY = 62;
    const measurement = document.createElement('canvas').getContext('2d');
    measurement.font = '13px Arial';
    const entries = data.series.map((s,i) => ({label: s.name, color: colors[i % colors.length], hidden: hidden.has(s.name)}))
      .filter(s => !s.hidden);
    entries.push({label: lineLabel, color: textColor, line: true});
    entries.push({label: cumulative ? 'Original cumulative net' : 'Original net',
      color: getComputedStyle(svg.querySelector('.original-line')).stroke, line: true, dashed: true});
    entries.forEach(entry => {
      const entryWidth = measurement.measureText(entry.label).width + 52;
      if (legendX + entryWidth > exportWidth - 24 && legendX > 24) {
        legendX = 24;
        legendY += 24;
      }
      if (entry.line) {
        imageSvg.append(shape('line', {x1: legendX, x2: legendX+24, y1: legendY-4, y2: legendY-4,
          stroke: entry.color, 'stroke-width': 2.5, 'stroke-dasharray': entry.dashed ? '6 4' : 'none'}));
      } else {
        imageSvg.append(shape('rect', {x: legendX, y: legendY-9, width: 10, height: 10, rx: 2, fill: entry.color}));
      }
      imageSvg.append(text(legendX+(entry.line ? 31 : 17), legendY, entry.label));
      legendX += entryWidth;
    });
    const plotTop = legendY + 20;
    plot.setAttribute('x', '20');
    plot.setAttribute('y', String(plotTop));
    plot.setAttribute('width', String(width));
    plot.setAttribute('height', String(height));
    imageSvg.append(plot);
    const exportHeight = plotTop + height + 30;
    imageSvg.setAttribute('height', String(exportHeight));
    imageSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
    imageSvg.append(text(24, exportHeight-14, `${data.series.length-hidden.size} of ${data.series.length} series visible · ${lineLabel}`));
    const blob = new Blob([new XMLSerializer().serializeToString(imageSvg)], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('SVG image could not be loaded'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = exportWidth * 2;
      canvas.height = exportHeight * 2;
      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.drawImage(image, 0, 0, exportWidth, exportHeight);
      return await new Promise((resolve, reject) => canvas.toBlob(
        value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function focusLegend(name) {
    const buttons = root.querySelectorAll('.legend button');
    const index = data.series.findIndex(s => s.name === name);
    buttons[index]?.focus();
  }
  draw();
}
