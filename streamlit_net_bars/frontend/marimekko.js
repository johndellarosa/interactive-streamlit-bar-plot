// Fractions are independent of pixels; rectangle area equals its share of the
// selected denominator. Original mode intentionally preserves excluded gaps.
export function mekkoLayout(data, selection) {
  const hiddenSeries = new Set(selection.hidden_series || []);
  const hiddenCategories = new Set(selection.hidden_categories || []);
  const recalculate = selection.recalculate !== false;
  const originalTotals = data.x.map((_,i) => data.series.reduce((a,s) => a+s.values[i],0));
  const visibleTotals = data.x.map((category,i) => hiddenCategories.has(category) ? 0 :
    data.series.reduce((a,s) => a+(hiddenSeries.has(s.name) ? 0 : s.values[i]),0));
  const originalTotal = originalTotals.reduce((a,b)=>a+b,0);
  const visibleTotal = visibleTotals.reduce((a,b)=>a+b,0);
  const denominator = recalculate ? visibleTotal : originalTotal;
  let offset = 0;
  const columns = data.x.map((category,i) => {
    const total = recalculate ? visibleTotals[i] : originalTotals[i];
    const width = denominator ? total/denominator : 0;
    const x = offset;
    offset += width;
    let bottom = 0;
    const segments = data.series.map((s,j) => {
      const excluded = hiddenSeries.has(s.name) || hiddenCategories.has(category);
      const height = total ? s.values[i]/total : 0;
      const y = bottom;
      if (!recalculate || !excluded) bottom += height;
      return {name:s.name, index:j, value:s.values[i], bottom:y,
        height:excluded ? 0 : height, excluded};
    });
    return {category,index:i,x,width,total,original:originalTotals[i],
      visible:visibleTotals[i],excluded:hiddenCategories.has(category),segments};
  });
  return {columns,denominator,originalTotal,visibleTotal};
}

export default function(component) {
  const {parentElement,data,setStateValue} = component;
  const root = parentElement.querySelector('.mekko');
  const style=data.plot_style || {};
  const names = new Set(data.series.map(s=>s.name)), categories = new Set(data.x);
  const clean = state => ({
    hidden_series:(state.hidden_series || []).filter(n=>names.has(n)),
    hidden_categories:(state.hidden_categories || []).filter(n=>categories.has(n)),
    recalculate:state.recalculate !== false,
  });
  let state = clean(data.selection);
  const history = (data.selection.history || []).map(clean);
  const palette = ['#3f719e','#367f76','#786796','#a26f3e','#a25f70','#617d93','#7c8052','#9b638c'];
  const ns = 'http://www.w3.org/2000/svg';
  const html = (tag,attributes={},text) => {
    const el = document.createElement(tag);
    Object.entries(attributes).forEach(([k,v])=>el.setAttribute(k,v));
    if (text !== undefined) el.textContent=text;
    return el;
  };
  const svgEl = (tag,attributes={},text) => {
    const el = document.createElementNS(ns,tag);
    Object.entries(attributes).forEach(([k,v])=>el.setAttribute(k,v));
    if (text !== undefined) el.textContent=text;
    return el;
  };
  const number = value => new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,
    notation:value !== 0 && (Math.abs(value)<1e-4 || Math.abs(value)>=1e7) ? 'scientific' : 'standard'}).format(value);
  const percent = value => new Intl.NumberFormat(undefined,{style:'percent',maximumFractionDigits:1}).format(value);
  function publish() {
    draw();
    setStateValue('selection',{...state,history:history.map(s=>({...s}))});
  }
  function change(next) {
    history.push({...state,hidden_series:[...state.hidden_series],hidden_categories:[...state.hidden_categories]});
    state=next;
    publish();
  }
  function toggle(field,name) {
    const excluded = new Set(state[field]);
    excluded.has(name) ? excluded.delete(name) : excluded.add(name);
    change({...state,[field]:[...excluded]});
    const target = [...root.querySelectorAll(`[data-filter="${field}"]`)].find(b=>b.dataset.name===name);
    target?.focus();
  }
  function draw() {
    root.replaceChildren();
    const card = html('section',{class:'mekko-card'});
    root.append(card);
    const heading = html('div',{class:'heading'});
    const title = html('div');
    title.append(html('p',{class:'eyebrow'},'Composition explorer'),html('h3',{},data.title));
    const actions = html('div',{class:'actions'});
    const undo = html('button',{type:'button'},'Undo');
    undo.disabled = !history.length;
    undo.onclick = () => {if(history.length){state=history.pop();publish();}};
    const reset = html('button',{type:'button'},'Show all');
    reset.disabled = !state.hidden_series.length && !state.hidden_categories.length;
    reset.onclick = () => change({...state,hidden_series:[],hidden_categories:[]});
    actions.append(undo,reset); heading.append(title,actions); card.append(heading);
    card.append(html('p',{class:'intro'},'Width shows category size. Height shows segment share. Click a segment to hide its series; use the chips to restore it.'));
    const legend = html('div',{class:'filters',role:'group','aria-label':'Segment visibility'});
    data.series.forEach((s,j)=>{
      const excluded=state.hidden_series.includes(s.name);
      const button=html('button',{type:'button','aria-pressed':String(!excluded),
        'aria-label':`${excluded?'Show':'Hide'} segment ${s.name}`,'data-filter':'hidden_series','data-name':s.name});
      const swatch=html('span',{class:'swatch'}); swatch.style.background=(style.colors?.[data.series[j].name] || palette[j%palette.length]);
      button.append(swatch,document.createTextNode(s.name));
      button.onclick=()=>toggle('hidden_series',s.name); legend.append(button);
    });
    card.append(legend);
    const categoryFilters=html('div',{class:'filters categories',role:'group','aria-label':'Category visibility'});
    categoryFilters.append(html('span',{class:'filter-label'},'Categories'));
    data.x.forEach(category=>{
      const excluded=state.hidden_categories.includes(category);
      const button=html('button',{type:'button','aria-pressed':String(!excluded),
        'aria-label':`${excluded?'Show':'Hide'} category ${category}`,'data-filter':'hidden_categories','data-name':category},category);
      button.onclick=()=>toggle('hidden_categories',category);categoryFilters.append(button);
    });
    card.append(categoryFilters);
    const modeRow=html('div',{class:'mode-row'});
    const modeLabel=html('label',{},'When filtering ');
    const mode=html('select',{'aria-label':'Share calculation'});
    mode.append(html('option',{value:'recalculate'},'Recalculate shares'),html('option',{value:'original'},'Keep original totals'));
    mode.value=state.recalculate?'recalculate':'original';
    mode.onchange=()=>change({...state,recalculate:mode.value==='recalculate'});
    modeLabel.append(mode);
    modeRow.append(modeLabel,html('span',{class:'mode-help'},state.recalculate?
      'Visible data fills the chart; widths and percentages are recalculated.':
      'Original widths and segment positions are preserved; exclusions leave empty areas.'));
    card.append(modeRow);
    const layout=mekkoLayout(data,state);
    const summary=html('div',{class:'summary'});
    for(const [label,value] of [['Visible total',number(layout.visibleTotal)],['Original total',number(layout.originalTotal)],
      ['Retained share',percent(layout.originalTotal?layout.visibleTotal/layout.originalTotal:0)]]) {
      const item=html('div');item.append(html('span',{},label),html('strong',{},value));summary.append(item);
    }
    card.append(summary);
    const container=html('div',{class:'plot'});card.append(container);
    const width=Math.max(240,container.clientWidth), height=data.height;
    const left=48+(data.appearance?.ylabel?28:0),right=12,top=58,bottom=54+(data.appearance?.xlabel?24:0),plotW=width-left-right,plotH=height-top-bottom;
    const chart=svgEl('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'group','aria-label':data.title});
    container.append(chart);
    addAxisTitles(chart,data,width,height);

    chart.append(svgEl('rect',{x:left,y:top,width:plotW,height:plotH,class:'plot-background'}));
    for(let tick=0;tick<=4;tick++) {
      const y=top+plotH*(1-tick/4);
      chart.append(svgEl('line',{x1:left,x2:width-right,y1:y,y2:y,class:'grid'}));
      chart.append(svgEl('text',{x:left-9,y:y+4,'text-anchor':'end',class:'axis-label'},`${tick*25}%`));
    }
    const tooltip=html('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const showTooltip=(rect,column,segment,event)=>{
      tooltip.replaceChildren(html('strong',{},`${column.category} · ${segment.name}`));
      const rows=[['Value',number(segment.value)],['Share of column',percent(segment.height)],
        ['Share of total',percent(layout.denominator?segment.value/layout.denominator:0)]];
      rows.forEach(([label,value])=>{const row=html('div',{class:'tooltip-row'});row.append(html('span',{},label),html('b',{},value));tooltip.append(row);});
      tooltip.append(html('small',{},'Click to hide this segment series'));
      tooltip.hidden=false;
      const bounds=card.getBoundingClientRect(),rectBounds=rect.getBoundingClientRect();
      tooltip.style.left=`${Math.max(8,Math.min(card.clientWidth-tooltip.offsetWidth-8,(event?.clientX ?? rectBounds.x)-bounds.x+12))}px`;
      tooltip.style.top=`${Math.max(8,Math.min(card.clientHeight-tooltip.offsetHeight-8,(event?.clientY ?? rectBounds.y)-bounds.y+12))}px`;
    };
    layout.columns.forEach(column=>{
      if(column.width<=0)return;
      const x=left+column.x*plotW,w=column.width*plotW;
      if(w>42) {
        const maxChars=Math.max(3,Math.floor(w/7));
        const label=column.category.length>maxChars?column.category.slice(0,maxChars-1)+'…':column.category;
        const header=svgEl('text',{x:x+w/2,y:22,'text-anchor':'middle',class:'column-name'},label);
        header.append(svgEl('title',{},`${column.category}: ${number(column.total)}`));chart.append(header);
        chart.append(svgEl('text',{x:x+w/2,y:39,'text-anchor':'middle',class:'axis-label'},number(column.total)));
        chart.append(svgEl('text',{x:x+w/2,y:height-20-(data.appearance?.xlabel?24:0),'text-anchor':'middle',class:'axis-label'},percent(column.width)));
      }
      column.segments.forEach(segment=>{
        if(segment.height<=0)return;
        const y=top+plotH*(1-segment.bottom-segment.height),h=segment.height*plotH;
        const rect=svgEl('rect',{x,y,width:w,height:h,fill:(style.colors?.[data.series[segment.index].name] || palette[segment.index%palette.length]),class:'segment',
          role:'button',tabindex:0,'aria-label':`${column.category}, ${segment.name}: ${number(segment.value)}, ${percent(segment.height)} of column. Hide ${segment.name}.`});
        rect.append(svgEl('title',{},`${column.category} · ${segment.name}: ${number(segment.value)} (${percent(segment.height)})`));
        rect.onclick=()=>toggle('hidden_series',segment.name);
        rect.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle('hidden_series',segment.name);}};
        rect.onpointermove=event=>showTooltip(rect,column,segment,event);
        rect.onpointerleave=()=>{tooltip.hidden=true;};
        rect.onfocus=()=>showTooltip(rect,column,segment);
        rect.onblur=()=>{tooltip.hidden=true;};
        chart.append(rect);
        if(w>68 && h>30) {
          chart.append(svgEl('text',{x:x+w/2,y:y+h/2+4,'text-anchor':'middle',class:'segment-label'},percent(segment.height)));
        }
      });
    });
    if(!layout.visibleTotal) {
      card.append(html('p',{class:'empty',role:'status'},layout.originalTotal?
        'No visible values. Restore a segment or category using the chips or Show all.':
        'All values are zero. Add positive values to create proportional areas.'));
    }
    card.append(html('p',{class:'footnote','aria-live':'polite'},
      `${data.series.length-state.hidden_series.length} of ${data.series.length} segments · ${data.x.length-state.hidden_categories.length} of ${data.x.length} categories · `+
      (state.recalculate?'Area = share of visible total':'Area = share of original total')));
  }
  draw();
  let previousWidth=root.clientWidth,frame;
  const observer=new ResizeObserver(()=>{
    if(Math.abs(root.clientWidth-previousWidth)<1)return;
    previousWidth=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);
  });
  observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
