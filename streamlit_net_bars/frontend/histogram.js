export function histogramModel(data,state) {
  const all=data.groups.flatMap(g=>g.points.map(p=>({...p,group:g.name}))),baseline=all.filter(p=>!(state.hidden||[]).includes(p.group));
  const visible=baseline.filter(p=>!(state.excluded||[]).includes(p.id)),selected=visible.filter(p=>(state.selected||[]).includes(p.id));
  const values=all.map(p=>p.value);let low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1;
  if(low===high){const pad=Math.abs(low)*.1||1;low-=pad;high+=pad;}
  const count=state.bins||20,edges=Array.from({length:count+1},(_,i)=>low+(high-low)*i/count);
  const bins=Array.from({length:count},(_,i)=>({low:edges[i],high:edges[i+1],points:[],baseline:[],value:0,reference:0}));
  const index=value=>{let a=0,b=edges.length;while(a<b){const m=(a+b)>>>1;if(edges[m]<=value)a=m+1;else b=m;}return Math.max(0,Math.min(count-1,a-1));};
  baseline.forEach(p=>bins[index(p.value)].baseline.push(p));visible.forEach(p=>bins[index(p.value)].points.push(p));
  const normalize=(n,total,width)=>state.normalization==='percent'?(total?n/total*100:0):state.normalization==='density'?(total?n/total/width:0):n;
  bins.forEach(b=>{b.value=normalize(b.points.length,visible.length,b.high-b.low);b.reference=normalize(b.baseline.length,baseline.length,b.high-b.low);});
  return {bins,visible,selected,domain:[low,high],normalize};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.histogram');
  let state={...data.selection,hidden:[...data.selection.hidden],selected:[...data.selection.selected],excluded:[...data.selection.excluded],history:data.selection.history.map(h=>[...h])};
  const ns='http://www.w3.org/2000/svg',palette=['#4b80b6','#56a69a','#a092bc','#c08a59','#b46f7d'];
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const fmt=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?'scientific':'standard'}).format(v);
  const color=name=>data.style.colors[name]||palette[data.groups.findIndex(g=>g.name===name)%palette.length];
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=histogramModel(data,state);root.replaceChildren();const card=el('section',{class:'histogram-card'});root.append(card);
    card.append(el('p',{class:'eyebrow'},'Interactive distribution explorer'),el('h3',{},data.title),el('p',{class:'intro'},'Click bins to select their observations. Adjust bin count, compare groups, or exclude selections and undo to explore the distribution.'));
    const legend=el('div',{class:'legend',role:'group','aria-label':'Group visibility'});
    data.groups.forEach(g=>{const hidden=state.hidden.includes(g.name),button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} group ${g.name}`},g.name);button.style.borderLeft=`4px solid ${color(g.name)}`;button.onclick=()=>{state.hidden=hidden?state.hidden.filter(n=>n!==g.name):[...state.hidden,g.name];state.selected=histogramModel(data,state).selected.map(p=>p.id);publish();};legend.append(button);});card.append(legend);
    const controls=el('div',{class:'controls'}),binsLabel=el('label',{},`Bins: ${state.bins}`),range=el('input',{type:'range',min:1,max:100,step:1,value:state.bins,'aria-label':'Number of bins'});
    range.onchange=()=>{state.bins=Number(range.value);publish();};binsLabel.append(range);controls.append(binsLabel);
    const normLabel=el('label',{},'Y scale'),norm=el('select',{'aria-label':'Y scale'});for(const[value,text]of[['count','Count'],['percent','Percent'],['density','Density']])norm.append(el('option',{value},text));norm.value=state.normalization;norm.onchange=()=>{state.normalization=norm.value;publish();};normLabel.append(norm);controls.append(normLabel);
    const button=(text,action,disabled)=>{const b=el('button',{type:'button'},text);b.disabled=!!disabled;b.onclick=action;controls.append(b);};
    button('Clear selection',()=>{state.selected=[];publish();},!model.selected.length);
    button('Exclude selected',()=>{state.history.push([...state.excluded]);state.excluded=[...new Set([...state.excluded,...model.selected.map(p=>p.id)])];state.selected=[];publish();},!model.selected.length);
    button('Undo exclusion',()=>{state.excluded=state.history.pop();state.selected=[];publish();},!state.history.length);
    button('Restore all',()=>{if(state.excluded.length)state.history.push([...state.excluded]);state.excluded=[];state.hidden=[];state.selected=[];publish();},!state.excluded.length&&!state.hidden.length);card.append(controls);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.visible.length} observations visible · ${model.selected.length} selected · ${state.excluded.length} excluded`));
    if(!model.visible.length)card.append(el('p',{class:'empty',role:'status'},'No observations remain visible. Restore all to recover excluded/hidden data; empty input groups have no observations.'));
    const plot=el('div',{class:'plot'});card.append(plot);
    const width=Math.max(300,plot.clientWidth),height=data.height,left=85+(data.appearance?.ylabel?25:0),right=25,top=24,bottom=55+(data.appearance?.xlabel?25:0),plotW=width-left-right,plotH=height-top-bottom;
    const peak=Math.max(...model.bins.map(b=>Math.max(b.value,data.show_reference?b.reference:0)))||1;
    const tickCount=data.tick_count||5,yAxis=niceAxis(0,peak*1.1,tickCount,true,state.normalization==='count'?1:0),extent=yAxis.domain[1];
    const y=v=>height-bottom-v/extent*plotH,step=plotW/model.bins.length;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});plot.append(svg);addAxisTitles(svg,data,width,height);
    for(const value of yAxis.ticks){const yy=y(value);if(data.style.show_grid)svg.append(shape('line',{x1:left,x2:width-right,y1:yy,y2:yy,class:'grid'}));svg.append(shape('text',{x:left-10,y:yy+4,'text-anchor':'end',class:'axis-label'},fmt(value)+(state.normalization==='percent'?'%':'')));}
    for(const value of niceAxis(...model.domain,tickCount,false).ticks){svg.append(shape('text',{x:left+plotW*(value-model.domain[0])/(model.domain[1]-model.domain[0]),y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},fmt(value)));}
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    model.bins.forEach((bin,i)=>{
      const gap=Math.min(data.bar_gap??2,step*.8),x=left+i*step,ids=bin.points.map(p=>p.id),selectedCount=ids.filter(id=>state.selected.includes(id)).length;
      const group=shape('g',{class:`hist-bin${selectedCount?' selected':''}`,role:'button',tabindex:0,'aria-pressed':selectedCount===ids.length&&ids.length>0?'true':selectedCount?'mixed':'false',
        'aria-label':`Select bin ${i+1}: ${fmt(bin.low)} to ${fmt(bin.high)}, ${ids.length} observations`});
      group.append(shape('rect',{x,y:top,width:step,height:plotH,class:'hit-area'}));
      let total=0;data.groups.forEach(g=>{const points=bin.points.filter(p=>p.group===g.name),value=model.normalize(points.length,model.visible.length,bin.high-bin.low);if(!points.length)return;
        group.append(shape('rect',{x:x+gap/2,y:y(total+value),width:Math.max(.5,step-gap),height:y(total)-y(total+value),fill:color(g.name),opacity:data.bar_opacity,class:'hist-bar'}));total+=value;
      });
      if(data.show_reference&&bin.reference)group.append(shape('rect',{x:x+1,y:y(bin.reference),width:Math.max(.5,step-2),height:height-bottom-y(bin.reference),class:'reference',style:`stroke:${data.reference_color||'currentColor'}`}));
      if(selectedCount)group.append(shape('rect',{x:x+.5,y:y(bin.value),width:Math.max(.5,step-1),height:Math.max(2,height-bottom-y(bin.value)),class:'selection-outline',style:`stroke:${data.selected_color||'#d89432'}`}));
      if(data.show_bin_counts&&ids.length&&step>=24)group.append(shape('text',{x:x+step/2,y:y(bin.value)-6,'text-anchor':'middle',class:'bin-count'},String(ids.length)));
      const toggle=()=>{const set=new Set(state.selected);if(ids.length&&ids.every(id=>set.has(id)))ids.forEach(id=>set.delete(id));else ids.forEach(id=>set.add(id));state.selected=[...set];publish();};group.onclick=toggle;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
      const show=()=>{tooltip.replaceChildren(el('strong',{},`${fmt(bin.low)} ≤ value ${i===model.bins.length-1?'≤':'<'} ${fmt(bin.high)}`),el('p',{},`${ids.length} observations · ${selectedCount} selected`));data.groups.forEach(g=>{const n=bin.points.filter(p=>p.group===g.name).length;if(n)tooltip.append(el('p',{},`${g.name}: ${n}`));});tooltip.hidden=false;};group.onpointerenter=show;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=show;group.onblur=()=>tooltip.hidden=true;svg.append(group);
    });
    card.append(el('p',{class:'footnote'},`Shared bins use the full input range · Left-inclusive bins; last includes maximum · ${state.normalization==='density'?'Density integrates to 1 across all visible groups':state.normalization==='percent'?'Percent sums to 100 across all visible groups':'Stacked heights show observation counts'}${data.show_reference?' · Dashed outline: visible groups before exclusions, normalized separately':''} · Rebinning preserves selected record IDs`));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
