export function summarizePairs(rows) {
  const n=rows.length,changes=rows.map(r=>r.change).sort((a,b)=>a-b);
  return {count:n,mean_change:n?rows.reduce((s,r)=>s+r.change/n,0):null,
    median_change:n?(n%2?changes[Math.floor(n/2)]:changes[n/2-1]/2+changes[n/2]/2):null,
    increased:rows.filter(r=>r.change>0).length,decreased:rows.filter(r=>r.change<0).length,
    unchanged:rows.filter(r=>r.change===0).length};
}
export function pairedModel(data,state) {
  const rows=data.rows.filter(r=>!(state.hidden_groups||[]).includes(r.group) && !(state.excluded||[]).includes(r.id) &&
    (!state.direction || state.direction==='all' || state.direction==='increase' && r.change>0 ||
      state.direction==='decrease' && r.change<0 || state.direction==='unchanged' && r.change===0));
  const selected=rows.filter(r=>(state.selected||[]).includes(r.id));
  const values=data.rows.flatMap(r=>[r.before,r.after]),changes=data.rows.map(r=>r.change);
  const domain=(low,high)=>{
    const span=high-low,padding=span?span*.08:(Math.abs(low)*.1 || 1);
    return [low-padding,high+padding];
  };
  const valueDomain=domain(Math.min(...values),Math.max(...values));
  const changeDomain=domain(Math.min(0,...changes),Math.max(0,...changes));
  const count=Math.max(3,Math.min(30,Number(state.bins)||10));
  const step=(changeDomain[1]-changeDomain[0])/count;
  const bins=Array.from({length:count},(_,i)=>({low:changeDomain[0]+i*step,high:changeDomain[0]+(i+1)*step,rows:[]}));
  rows.forEach(row=>bins[Math.max(0,Math.min(count-1,Math.floor((row.change-changeDomain[0])/step)))].rows.push(row));
  return {rows,selected,bins,valueDomain,changeDomain,summary:summarizePairs(rows),selectedSummary:summarizePairs(selected)};
}

export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.paired-change');
  const style=data.plot_style || {};
  let state={...data.selection,selected:[...(data.selection.selected||[])],excluded:[...(data.selection.excluded||[])],hidden_groups:[...(data.selection.hidden_groups||[])]};
  const ns='http://www.w3.org/2000/svg';
  const html=(tag,attrs={},text)=>{const el=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;return el;};
  const shape=(tag,attrs={},text)=>{const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;return el;};
  const format=value=>value===null?'—':new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,
    notation:value!==0 && (Math.abs(value)<1e-4||Math.abs(value)>=1e7)?'scientific':'standard'}).format(Object.is(value,-0)?0:value);
  const signed=value=>value===null?'—':`${value>0?'+':''}${format(value)}`;
  const palette=['#4b80b6','#56a69a','#a092bc','#c08a59','#b46f7d'];
  const hash=id=>{let n=5381;for(const c of id)n=((n*33)^c.charCodeAt(0))>>>0;return n/4294967295;};
  const publish=()=>{draw();setStateValue('selection',{...state,selected:[...state.selected],excluded:[...state.excluded],hidden_groups:[...state.hidden_groups]});};
  const toggle=id=>{const ids=new Set(state.selected);ids.has(id)?ids.delete(id):ids.add(id);state.selected=[...ids];publish();};
  function draw() {
    root.replaceChildren();const card=html('section',{class:'paired-card'});root.append(card);
    const heading=html('div',{class:'heading'}),title=html('div');
    title.append(html('p',{class:'eyebrow'},'Within-pair comparison'),html('h3',{},data.title));
    const restore=html('button',{type:'button'},'Restore all');
    restore.disabled=!state.excluded.length && !state.hidden_groups.length && state.direction==='all';
    restore.onclick=()=>{state.excluded=[];state.hidden_groups=[];state.direction='all';state.selected=[];publish();};
    heading.append(title,restore);card.append(heading);
    card.append(html('p',{class:'intro'},'Follow each pair from before to after. Click a pair or a distribution bin to highlight the same observations in both panels.'));
    const groups=html('div',{class:'groups',role:'group','aria-label':'Group visibility'});
    data.groups.forEach((group,i)=>{
      const hidden=state.hidden_groups.includes(group),button=html('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} group ${group}`});
      if(state.color==='group'){const swatch=html('span',{class:'swatch'});swatch.style.background=(style.colors?.[group] || palette[i%palette.length]);button.append(swatch);}
      button.append(document.createTextNode(group));button.onclick=()=>{const excluded=new Set(state.hidden_groups);hidden?excluded.delete(group):excluded.add(group);state.hidden_groups=[...excluded];state.selected=[];publish();};groups.append(button);
    });card.append(groups);
    const controls=html('div',{class:'controls'});
    const select=(label,key,options)=>{
      const wrapper=html('label',{},label),input=html('select',{'aria-label':label});options.forEach(([value,text])=>input.append(html('option',{value},text)));
      input.value=String(state[key]);input.onchange=()=>{state[key]=key==='bins'?Number(input.value):input.value;if(key==='direction')state.selected=[];publish();};wrapper.append(input);controls.append(wrapper);
    };
    select('Show changes','direction',[['all','All changes'],['increase','Increases'],['decrease','Decreases'],['unchanged','Unchanged']]);
    select('Color by','color',[['change','Direction of change'],['group','Group']]);
    select('Distribution bins','bins',[[5,'5 bins'],[10,'10 bins'],[15,'15 bins'],[20,'20 bins']]);
    card.append(controls);
    const model=pairedModel(data,state),selectedIds=new Set(model.selected.map(r=>r.id));
    const stats=html('div',{class:'stats'});
    for(const [label,value] of [['Visible pairs',String(model.summary.count)],['Mean change',signed(model.summary.mean_change)],['Median change',signed(model.summary.median_change)],['Increased / decreased',`${model.summary.increased} / ${model.summary.decreased}`]]) {
      const item=html('div');item.append(html('span',{},label),html('strong',{},value));stats.append(item);
    }card.append(stats);
    const selection=html('div',{class:'selection'});
    selection.append(html('span',{'aria-live':'polite'},model.selected.length?`${model.selected.length} selected · Mean change ${signed(model.selectedSummary.mean_change)}`:'No pairs selected'));
    const clear=html('button',{type:'button'},'Clear selection');clear.disabled=!model.selected.length;clear.onclick=()=>{state.selected=[];publish();};
    const exclude=html('button',{type:'button'},'Exclude selected');exclude.disabled=!model.selected.length;
    exclude.onclick=()=>{state.excluded=[...new Set([...state.excluded,...selectedIds])];state.selected=[];publish();};selection.append(clear,exclude);card.append(selection);
    const legend=html('div',{class:'legend'});
    if(state.color==='change')for(const [name,color] of [['Increase',(style.increase_color || '#3f7da0')],['Decrease',(style.decrease_color || '#c18258')],['Unchanged',(style.unchanged_color || '#8995a6')]]) {
      const key=html('span'),swatch=html('i');swatch.style.background=color;key.append(swatch,document.createTextNode(name));legend.append(key);
    }
    legend.append(html('span',{class:'legend-note'},'Change = after − before · Histogram bars show pair counts'));card.append(legend);
    if(!model.rows.length){card.append(html('p',{role:'status',class:'empty'},'No pairs match the current filters. Use Restore all to bring them back.'));return;}
    const plot=html('div',{class:'plot'});card.append(plot);
    const width=Math.max(250,plot.clientWidth),sideBySide=width>=760,gap=42,panelW=sideBySide?(width-gap)/2:width;
    const panelHeight=data.height,totalHeight=sideBySide?panelHeight:panelHeight*2+30;
    const chart=shape('svg',{width,height:totalHeight,viewBox:`0 0 ${width} ${totalHeight}`,role:'group','aria-label':data.title});plot.append(chart);

    addAxisTitles(chart,data,width,totalHeight);
    const tooltip=html('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const color=row=>state.color==='group'?(style.colors?.[row.group] || palette[data.groups.indexOf(row.group)%palette.length]):row.change>0?(style.increase_color || '#3f7da0'):row.change<0?(style.decrease_color || '#c18258'):(style.unchanged_color || '#8995a6');
    const showTooltip=(node,row,event)=>{
      root.querySelectorAll('[data-pair]').forEach(el=>el.classList.toggle('is-hovered',el.dataset.pair===row.id));
      tooltip.replaceChildren(html('strong',{},`${row.id} · ${row.group}`));
      for(const [label,value] of [[data.before_label,format(row.before)],[data.after_label,format(row.after)],['Change',signed(row.change)]]) {
        const entry=html('div',{class:'tooltip-row'});entry.append(html('span',{},label),html('b',{},value));tooltip.append(entry);
      }
      tooltip.hidden=false;const bounds=card.getBoundingClientRect(),target=node.getBoundingClientRect();
      tooltip.style.left=`${Math.max(8,Math.min(card.clientWidth-tooltip.offsetWidth-8,(event?.clientX??target.x)-bounds.x+12))}px`;
      tooltip.style.top=`${Math.max(8,Math.min(card.clientHeight-tooltip.offsetHeight-8,(event?.clientY??target.y)-bounds.y+12))}px`;
    };
    const clearHover=()=>{tooltip.hidden=true;root.querySelectorAll('.is-hovered').forEach(el=>el.classList.remove('is-hovered'));};
    const bindPair=(group,row,label)=>{
      group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('data-pair',row.id);
      group.setAttribute('aria-label',`${label} ${row.id}: ${data.before_label} ${format(row.before)}, ${data.after_label} ${format(row.after)}, change ${signed(row.change)}`);
      group.setAttribute('aria-pressed',String(selectedIds.has(row.id)));
      group.setAttribute('class',`pair${selectedIds.has(row.id)?' selected':''}${selectedIds.size&&!selectedIds.has(row.id)?' dimmed':''}`);
      group.onclick=()=>toggle(row.id);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(row.id);}};
      group.onpointermove=e=>showTooltip(group,row,e);group.onpointerleave=clearHover;group.onfocus=()=>showTooltip(group,row);group.onblur=clearHover;
    };
    const first={x:0,y:0},second={x:sideBySide?panelW+gap:0,y:sideBySide?0:panelHeight+30};
    const geometry=(origin,domain,title)=>{
      const left=origin.x+65+(data.appearance?.ylabel?24:0),right=origin.x+panelW-18,top=origin.y+36,bottom=origin.y+panelHeight-44-(data.appearance?.xlabel?24:0);
      const y=v=>bottom-(v-domain[0])/(domain[1]-domain[0])*(bottom-top);
      chart.append(shape('text',{x:origin.x+8,y:origin.y+16,class:'panel-title'},title));
      for(let i=0;i<=4;i++){
        let value=domain[0]+(domain[1]-domain[0])*i/4;if(Math.abs(value)<(domain[1]-domain[0])*1e-12)value=0;
        chart.append(shape('line',{x1:left,x2:right,y1:y(value),y2:y(value),class:'grid'}));
        chart.append(shape('text',{x:left-9,y:y(value)+4,'text-anchor':'end',class:'axis-label'},format(value)));
      }
      if(domain[0]<=0 && domain[1]>=0)chart.append(shape('line',{x1:left,x2:right,y1:y(0),y2:y(0),class:'zero'}));
      return {left,right,top,bottom,y,w:right-left};
    };
    const paired=geometry(first,model.valueDomain,'Paired observations');
    const delta=geometry(second,model.changeDomain,`Change distribution · ${data.after_label} − ${data.before_label}`);
    const beforeX=paired.left+paired.w*.22,afterX=paired.left+paired.w*.78;
    for(const [x,label] of [[beforeX,data.before_label],[afterX,data.after_label]]){
      chart.append(shape('line',{x1:x,x2:x,y1:paired.top,y2:paired.bottom,class:'guide'}));
      chart.append(shape('text',{x,y:paired.bottom+26,'text-anchor':'middle',class:'axis-title'},label));
    }
    const histStart=delta.left+delta.w*.3,histWidth=delta.w*.65,maxCount=Math.max(1,...model.bins.map(b=>b.rows.length));
    model.bins.forEach((bin,index)=>{
      if(!bin.rows.length)return;
      const low=delta.y(bin.low),high=delta.y(bin.high),selected=bin.rows.every(r=>selectedIds.has(r.id));
      const group=shape('g',{role:'button',tabindex:0,'aria-label':`Select distribution bin ${index+1}: ${bin.rows.length} pairs, changes ${format(bin.low)} to ${format(bin.high)}`,
        'aria-pressed':String(selected),class:'hist-bin'});
      group.append(shape('rect',{x:histStart,y:high+.8,width:histWidth*bin.rows.length/maxCount,height:Math.max(0,low-high-1.6),rx:2,class:selected?'hist-selected':'hist-bar'}));
      group.append(shape('text',{x:histStart+histWidth*bin.rows.length/maxCount+5,y:(high+low)/2+4,class:'bin-count'},String(bin.rows.length)));
      const choose=()=>{state.selected=selected?[]:bin.rows.map(r=>r.id);publish();};
      group.onclick=choose;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};chart.append(group);
    });
    chart.append(shape('text',{x:histStart,y:delta.bottom+26,class:'axis-label'},'Pair count →'));
    model.rows.forEach(row=>{
      const jitter=(hash(row.id)-.5)*Math.min(28,paired.w*.12),group=shape('g');
      bindPair(group,row,'Select pair');
      group.append(shape('line',{x1:beforeX+jitter,x2:afterX+jitter,y1:paired.y(row.before),y2:paired.y(row.after),stroke:color(row),class:'pair-line'}));
      for(const [x,value] of [[beforeX+jitter,row.before],[afterX+jitter,row.after]])group.append(shape('circle',{cx:x,cy:paired.y(value),r:style.point_size??3.3,fill:color(row),class:'pair-dot'}));
      chart.append(group);
      const point=shape('g');bindPair(point,row,'Select change');point.append(shape('circle',{
        cx:delta.left+delta.w*(.05+hash(row.id)*.17),cy:delta.y(row.change),r:style.point_size??3.3,fill:color(row),class:'pair-dot'}));chart.append(point);
    });
    const mean=shape('line',{x1:delta.left,x2:delta.right,y1:delta.y(model.summary.mean_change),y2:delta.y(model.summary.mean_change),class:'mean-line'});
    mean.append(shape('title',{},`Mean change: ${signed(model.summary.mean_change)}`));chart.append(mean);
    chart.append(shape('text',{x:delta.right,y:delta.top-8,'text-anchor':'end',class:'axis-label'},`Dashed line: mean ${signed(model.summary.mean_change)}`));
    card.append(html('p',{class:'footnote'},`${model.rows.length} of ${data.rows.length} pairs visible · ${state.excluded.length} excluded · Full-input axis ranges stay fixed when filtering · Descriptive statistics only`));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
