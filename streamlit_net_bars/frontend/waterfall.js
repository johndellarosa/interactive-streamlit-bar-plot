export function waterfallModel(data,state) {
  const excluded=state.excluded||[],collapsed=state.collapsed||[],scenarioStart=data.scenario_start??data.start;
  let total=data.start,scenarioTotal=scenarioStart;const rows=[],positions=[];
  for(const row of data.rows){
    const retained=!excluded.includes(row.id),end=total+(retained?row.value:0),scenarioEnd=scenarioTotal+(retained?(row.scenario_value??row.value):0);
    positions.push({start:total,end,scenario_start:scenarioTotal,scenario_end:scenarioEnd});
    if(retained)rows.push({...row,start:total,end});total=end;scenarioTotal=scenarioEnd;
  }
  const original=data.rows.reduce((s,r)=>s+r.value,data.start);
  const originalScenario=data.rows.reduce((s,r)=>s+(r.scenario_value??r.value),scenarioStart);
  const selected=rows.filter(r=>(state.selected||[]).includes(r.id));
  const groups=data.groups||[],subtotals=data.subtotals||{},display=[],checkpoints=[];
  for(let i=0;i<data.rows.length;i++){
    const row=data.rows[i],group=groups.find(g=>g.ids[0]===row.id&&collapsed.includes(g.name));
    if(group){
      const last=i+group.ids.length-1,retained=data.rows.slice(i,last+1).filter(r=>!excluded.includes(r.id));
      if(retained.length)display.push({kind:'group',label:group.name,ids:retained.map(r=>r.id),start:positions[i].start,end:positions[last].end,
        value:retained.reduce((s,r)=>s+r.value,0),scenario_start:positions[i].scenario_start,scenario_end:positions[last].scenario_end,
        scenario_value:retained.reduce((s,r)=>s+(r.scenario_value??r.value),0)});
      i=last;
    }else if(!excluded.includes(row.id))display.push({...row,...positions[i],kind:'step',ids:[row.id],scenario_value:row.scenario_value??row.value});
    const anchor=data.rows[i].id;
    if(Object.hasOwn(subtotals,anchor)){
      const checkpoint={after_id:anchor,label:subtotals[anchor],total:positions[i].end,scenario_total:positions[i].scenario_end};checkpoints.push(checkpoint);
      display.push({kind:'subtotal',label:checkpoint.label,ids:[],start:0,end:checkpoint.total,value:checkpoint.total,
        scenario_start:0,scenario_end:checkpoint.scenario_total,scenario_value:checkpoint.scenario_total});
    }
  }
  const bars=[{label:data.start_label,start:0,end:data.start,value:data.start,scenario_start:0,scenario_end:scenarioStart,scenario_value:scenarioStart,kind:'total',ids:[]},
    ...display,{label:data.total_label,start:0,end:total,value:total,scenario_start:0,scenario_end:scenarioTotal,scenario_value:scenarioTotal,kind:'total',ids:[]}];
  const view=data.has_scenario?(state.view||'comparison'):'baseline';
  let low=0,high=0;
  if(state.fixed!==false){
    const bounds=[[data.start,data.rows.map(r=>r.value)],...(data.has_scenario?[[scenarioStart,data.rows.map(r=>r.scenario_value??r.value)]]:[])];
    low=Math.min(0,...bounds.map(([start,v])=>start+v.reduce((s,n)=>s+Math.min(0,n),0)));
    high=Math.max(0,...bounds.map(([start,v])=>start+v.reduce((s,n)=>s+Math.max(0,n),0)));
  }else{
    const v=[0,...(view!=='scenario'?bars.flatMap(r=>[r.start,r.end]):[]),...(view!=='baseline'?bars.flatMap(r=>[r.scenario_start,r.scenario_end]):[])];
    if(data.show_reference){if(view!=='scenario')v.push(original);if(view!=='baseline')v.push(originalScenario);}
    low=Math.min(...v);high=Math.max(...v);
  }
  const span=high-low,pad=span*.08||Math.abs(low)*.1||1;
  return {rows,total,original,selected,scenarioTotal,originalScenario,display,checkpoints,bars,view,
    domain:data.ylim||[low<0?low-pad:0,high>0?high+pad:span===0?1:0]};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.waterfall');
  let state={...data.selection,selected:[...data.selection.selected],excluded:[...data.selection.excluded],history:data.selection.history.map(h=>[...h]),collapsed:[...(data.selection.collapsed||[])]};
  const ns='http://www.w3.org/2000/svg',clipId='wf-'+crypto.randomUUID();
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const fmt=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:6,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?'scientific':'standard'}).format(v);
  const signed=v=>(v>0?'+':'')+fmt(v);
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=waterfallModel(data,state),axis=niceAxis(...model.domain,data.tick_count,!data.ylim),domain=axis.domain;
    root.replaceChildren();const card=el('section',{class:'waterfall-card'});root.append(card);
    card.append(el('p',{class:'eyebrow'},'Contribution explorer'),el('h3',{},data.title),el('p',{class:'intro'},'Select contribution bars, then exclude them to recompute the running total. Excluded steps can be restored individually or with Undo.'));
    const legend=el('div',{class:'legend'});
    for(const[text,color]of[['Increase',data.positive_color],['Decrease',data.negative_color],['Start / subtotal / total',data.total_color]]){const key=el('span'),swatch=el('i');swatch.style.background=color;key.append(swatch,document.createTextNode(text));legend.append(key);}card.append(legend);
    if(data.has_scenario){const key=el('span',{},`${data.baseline_label}: left / pale · ${data.scenario_label}: right / solid`);legend.append(key);}
    const controls=el('div',{class:'controls'}),button=(text,action,disabled=false)=>{const b=el('button',{type:'button'},text);b.disabled=disabled;b.onclick=action;controls.append(b);return b;};
    button('Clear selection',()=>{state.selected=[];publish();},!model.selected.length);
    button('Exclude selected',()=>{state.history.push([...state.excluded]);state.excluded=[...new Set([...state.excluded,...model.selected.map(r=>r.id)])];state.selected=[];publish();},!model.selected.length);
    button('Undo',()=>{state.excluded=state.history.pop();state.selected=[];publish();},!state.history.length);
    button('Restore all',()=>{state.history.push([...state.excluded]);state.excluded=[];state.selected=[];publish();},!state.excluded.length);
    const fixed=button('Fixed axis',()=>{state.fixed=!state.fixed;publish();},!!data.ylim);fixed.setAttribute('aria-pressed',String(state.fixed));card.append(controls);
    if(data.has_scenario){const label=el('label',{},'Comparison view'),view=el('select',{'aria-label':'Comparison view'});for(const[value,text]of[['comparison','Side by side'],['baseline',data.baseline_label],['scenario',data.scenario_label]])view.append(el('option',{value},text));view.value=model.view;view.onchange=()=>{state.view=view.value;publish();};label.append(view);controls.append(label);}
    if(data.groups?.length){const groupControls=el('div',{class:'controls group-controls'});for(const group of data.groups){const collapsed=state.collapsed.includes(group.name),b=el('button',{type:'button','aria-expanded':String(!collapsed),'aria-label':`${collapsed?'Expand':'Collapse'} group ${group.name}`},`${collapsed?'▸':'▾'} ${group.name}`);b.onclick=()=>{state.collapsed=collapsed?state.collapsed.filter(n=>n!==group.name):[...state.collapsed,group.name];publish();};groupControls.append(b);}card.append(groupControls);}
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.length} / ${data.rows.length} contributions · ${model.selected.length} selected · Total ${fmt(model.total)} · Original ${fmt(model.original)}`));
    if(data.has_scenario)card.append(el('p',{class:'comparison-summary','aria-live':'polite'},`${data.baseline_label}: ${fmt(model.total)} · ${data.scenario_label}: ${fmt(model.scenarioTotal)} · Difference: ${signed(model.scenarioTotal-model.total)}`));
    if(state.excluded.length){const excluded=el('div',{class:'groups','aria-label':'Excluded contributions'});excluded.append(el('span',{},'Restore:'));data.rows.filter(r=>state.excluded.includes(r.id)).forEach(row=>{const b=el('button',{type:'button','aria-label':`Restore ${row.label} (${row.id})`},row.label);b.onclick=()=>{state.history.push([...state.excluded]);state.excluded=state.excluded.filter(i=>i!==row.id);publish();};excluded.append(b);});card.append(excluded);}
    const plot=el('div',{class:'plot'});card.append(plot);
    const count=model.bars.length,left=85+(data.appearance?.ylabel?25:0),right=25,width=Math.max(plot.clientWidth,left+right+count*(model.view==='comparison'?100:65)),height=data.height,top=36,bottom=65+(data.appearance?.xlabel?25:0),plotW=width-left-right,plotH=height-top-bottom,step=plotW/count;
    const y=v=>top+(domain[1]-v)/(domain[1]-domain[0])*plotH,x=i=>left+(i+.5)*step;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});plot.append(svg);addAxisTitles(svg,data,width,height);
    axis.ticks.forEach(v=>{if(data.show_grid)svg.append(shape('line',{x1:left,x2:width-right,y1:y(v),y2:y(v),class:'grid'}));svg.append(shape('text',{x:left-9,y:y(v)+4,'text-anchor':'end',class:'axis-label'},fmt(v)));});
    if(domain[0]<=0&&domain[1]>=0)svg.append(shape('line',{x1:left,x2:width-right,y1:y(0),y2:y(0),class:'zero'}));
    const defs=shape('defs'),clip=shape('clipPath',{id:clipId});clip.append(shape('rect',{x:left,y:top-20,width:plotW,height:plotH+20}));defs.append(clip);svg.append(defs);
    const marks=shape('g',{'clip-path':`url(#${clipId})`});svg.append(marks);
    if(data.show_reference){for(const[value,label]of[...(model.view!=='scenario'?[[model.original,data.baseline_label||'Original']]:[]),...(model.view!=='baseline'?[[model.originalScenario,data.scenario_label]]:[])]){const reference=shape('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'reference'});reference.append(shape('title',{},`${label} original total: ${fmt(value)}`));marks.append(reference);}}
    const bars=model.bars;
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    bars.forEach((bar,i)=>{
      const actionable=bar.ids.length>0,selected=actionable&&bar.ids.every(id=>state.selected.includes(id)),partial=bar.ids.some(id=>state.selected.includes(id));
      const group=shape('g',{class:`waterfall-bar${partial?' selected':''}`,tabindex:0,role:actionable?'button':'img',
        'aria-label':bar.kind==='group'?`Select group ${bar.label}: ${bar.ids.length} contributions`:actionable?`Select ${bar.label} (${bar.id}): ${signed(bar.value)}, running total ${fmt(bar.end)}`:`${bar.label}: ${fmt(bar.end)}${data.has_scenario?`, scenario ${fmt(bar.scenario_end)}`:''}`});
      if(data.has_scenario){const prefix=actionable?`Select ${bar.label}${bar.kind==='group'?' group':''}: `:`${bar.label}: `;group.setAttribute('aria-label',prefix+(model.view!=='scenario'?`${data.baseline_label} ${actionable?signed(bar.value)+', ':''}balance ${fmt(bar.end)}`:'')+(model.view==='comparison'?' · ':'')+(model.view!=='baseline'?`${data.scenario_label} ${actionable?signed(bar.scenario_value)+', ':''}balance ${fmt(bar.scenario_end)}`:''));}
      if(actionable){group.setAttribute('aria-pressed',selected?'true':partial?'mixed':'false');const toggle=()=>{const set=new Set(state.selected);bar.ids.forEach(id=>selected?set.delete(id):set.add(id));state.selected=[...set];publish();};group.onclick=toggle;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};}
      const paths=model.view==='comparison'?['baseline','scenario']:[model.view];
      paths.forEach((path,p)=>{
        const scenario=path==='scenario',start=scenario?bar.scenario_start:bar.start,end=scenario?bar.scenario_end:bar.end,value=scenario?bar.scenario_value:bar.value;
        const center=x(i)+(paths.length===2?(p-.5)*step*data.bar_width/2:0),bw=step*data.bar_width/paths.length;
        const color=bar.kind==='total'||bar.kind==='subtotal'?data.total_color:value>0?data.positive_color:value<0?data.negative_color:data.neutral_color;
        if(data.show_connectors&&i<count-1){marks.append(shape('line',{x1:center+bw/2,x2:x(i+1)+(center-x(i))-bw/2,y1:y(end),y2:y(end),class:'connector'}));}
        group.append(shape('rect',{x:center-bw/2+.5,y:y(Math.max(start,end))-(start===end?1:0),width:Math.max(1,bw-1),height:Math.max(2,Math.abs(y(start)-y(end))),fill:color,opacity:data.bar_opacity*((paths.length===2 && !scenario) ? .45 : 1),rx:2,
          style:partial?`stroke:${data.selected_color};stroke-width:3`:bar.kind==='subtotal'?'stroke:currentColor;stroke-width:1.5':''}));
        if(data.show_values)marks.append(shape('text',{x:center,y:y(Math.max(start,end))-7,'text-anchor':'middle',class:'bin-count'},actionable?signed(value):fmt(end)));
      });
      const show=()=>{tooltip.replaceChildren(el('strong',{},bar.label),el('p',{},`${data.baseline_label||'Baseline'}: ${actionable?signed(bar.value)+' · ':''}${fmt(bar.start)} → ${fmt(bar.end)}`));if(data.has_scenario)tooltip.append(el('p',{},`${data.scenario_label}: ${actionable?signed(bar.scenario_value)+' · ':''}${fmt(bar.scenario_start)} → ${fmt(bar.scenario_end)}`),el('p',{},`Balance difference: ${signed(bar.scenario_end-bar.end)}`));if(bar.kind==='group')tooltip.append(el('p',{},`${bar.ids.length} retained contributions; use Expand group to inspect them.`));tooltip.hidden=false;};group.onpointerenter=show;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=show;group.onblur=()=>tooltip.hidden=true;marks.append(group);
      const text=(bar.kind==='group'?'▸ ':'')+bar.label,label=shape('text',{x:x(i),y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},text.length>16?text.slice(0,15)+'…':text);label.append(shape('title',{},text));svg.append(label);
    });
    card.append(el('p',{class:'footnote'},`Relative contributions in supplied order · Checkpoints show balances without adding contributions · ${data.show_reference?`Dashed references: original ${data.baseline_label||'baseline'} ${fmt(model.original)}${data.has_scenario?`, ${data.scenario_label} ${fmt(model.originalScenario)}`:''} · `:''}${data.ylim?'Explicit axis limits clip marks':state.fixed?'Fixed axis covers every retained subset in both scenarios':'Axis fits displayed running totals'} · Input data is never modified`));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
