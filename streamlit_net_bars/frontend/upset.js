export function upsetModel(data,state) {
  const rows=data.intersections.filter(r=>(state.required||[]).every(n=>r.sets.includes(n)) &&
    !(state.excluded||[]).some(n=>r.sets.includes(n)) && r.count>=(state.min_count||1));
  rows.sort(state.sort==='degree'?(a,b)=>b.degree-a.degree||b.count-a.count||a.key.localeCompare(b.key):
    (a,b)=>b.count-a.count||b.degree-a.degree||a.key.localeCompare(b.key));
  const shown=rows.slice(0,data.max_intersections||30),selected=rows.filter(r=>(state.selected||[]).includes(r.key));
  return {rows,shown,selected,selectedIds:selected.flatMap(r=>r.ids),matched:rows.reduce((n,r)=>n+r.count,0)};
}

export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.upset');
  const style=data.plot_style || {};
  let state={...data.selection,required:[...data.selection.required],excluded:[...data.selection.excluded],selected:[...data.selection.selected]};
  const ns='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;};
  const svgEl=(tag,attrs={},text)=>{const node=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;};
  const describe=r=>r.sets.length?r.sets.join(' ∩ '):'None of the sets';
  const publish=()=>{draw();setStateValue('selection',{...state});};
  const toggle=key=>{state.selected=state.selected.includes(key)?state.selected.filter(k=>k!==key):[...state.selected,key];publish();};
  function draw() {
    const model=upsetModel(data,state);root.replaceChildren();
    const card=el('section',{class:'upset-card'});root.append(card);
    const heading=el('div',{class:'heading'}),title=el('div');title.append(el('p',{class:'eyebrow'},'Membership explorer'),el('h3',{},data.title));
    const reset=el('button',{type:'button'},'Reset filters');reset.disabled=!state.required.length&&!state.excluded.length&&state.min_count===1;
    reset.onclick=()=>{state.required=[];state.excluded=[];state.min_count=1;state.selected=[];publish();};heading.append(title,reset);card.append(heading);
    card.append(el('p',{class:'intro'},'Each column represents an exact combination: filled dots mean included, pale dots mean absent. Click columns to select their records.'));
    const filters=el('div',{class:'filters',role:'group','aria-label':'Set membership filters'});
    data.names.forEach(name=>{
      const label=el('label',{},name),select=el('select',{'aria-label':`Filter ${name}`});
      for(const[value,text]of[['any','Any'],['required','Require'],['excluded','Exclude']])select.append(el('option',{value},text));
      select.value=state.required.includes(name)?'required':state.excluded.includes(name)?'excluded':'any';
      select.onchange=()=>{state.required=state.required.filter(n=>n!==name);state.excluded=state.excluded.filter(n=>n!==name);if(select.value!=='any')state[select.value].push(name);state.selected=[];publish();};label.append(select);filters.append(label);
    });card.append(filters);
    const controls=el('div',{class:'controls'}),sort=el('select',{'aria-label':'Sort intersections'});
    sort.append(el('option',{value:'size'},'Largest first'),el('option',{value:'degree'},'Most sets first'));sort.value=state.sort;
    sort.onchange=()=>{state.sort=sort.value;publish();};const sortLabel=el('label',{},'Sort intersections');sortLabel.append(sort);controls.append(sortLabel);
    const minimum=el('input',{type:'number',min:1,step:1,value:state.min_count,'aria-label':'Minimum intersection size'});
    minimum.onchange=()=>{state.min_count=Math.max(1,Math.floor(Number(minimum.value)||1));state.selected=[];publish();};
    const minLabel=el('label',{},'Minimum size');minLabel.append(minimum);controls.append(minLabel);card.append(controls);
    const summary=el('div',{class:'selection','aria-live':'polite'},`${model.matched} / ${data.total} records match · ${model.rows.length} intersections · ${model.selectedIds.length} records selected`);
    const clear=el('button',{type:'button'},'Clear selection');clear.disabled=!model.selected.length;clear.onclick=()=>{state.selected=[];publish();};summary.append(clear);card.append(summary);
    if(!model.shown.length){card.append(el('p',{role:'status',class:'empty'},'No intersections match. Reset filters to restore the view.'));return;}
    const scroller=el('div',{class:'plot',tabindex:0,'aria-label':'UpSet chart. Scroll horizontally to see more intersections.'});card.append(scroller);
    const tickSize=data.appearance?.tick_fontsize||11,labelSize=data.appearance?.label_fontsize||12;
    const labelWidth=Math.min(240,Math.max(95,...data.names.map(n=>n.length*labelSize*.58+12)));
    const left=labelWidth+145+(data.appearance?.ylabel?25:0),step=Math.max(42,tickSize*2.4),right=26;
    const width=Math.max(scroller.clientWidth,left+model.shown.length*step+right),plotW=width-left-right;
    const spacing=plotW/model.shown.length,top=34,barBottom=data.height,matrixTop=barBottom+48,rowHeight=Math.max(32,labelSize+14);
    const height=matrixTop+data.names.length*rowHeight+42+(data.appearance?.xlabel?24:0);
    const chart=svgEl('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});scroller.append(chart);
    addAxisTitles(chart,data,width,height);
    const peak=Math.max(...data.intersections.map(r=>r.count),1),barH=barBottom-top;
    chart.append(svgEl('text',{x:left,y:18,class:'panel-title'},'Exact intersection size'));
    chart.append(svgEl('text',{x:left-18,y:barBottom+22,'text-anchor':'end',class:'panel-title'},'Set size (all records)'));
    for(let i=0;i<=4;i++){
      const value=peak*i/4,y=barBottom-value/peak*barH;
      chart.append(svgEl('line',{x1:left,x2:width-right,y1:y,y2:y,class:'grid'}));
      chart.append(svgEl('text',{x:left-9,y:y+4,'text-anchor':'end',class:'axis-label'},new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(value)));
    }
    const setPeak=Math.max(...data.sizes,1);
    data.names.forEach((name,index)=>{
      const y=matrixTop+index*rowHeight;
      chart.append(svgEl('rect',{x:0,y:y-rowHeight/2,width,height:rowHeight,class:index%2?'stripe':'stripe-clear'}));
      const nameNode=svgEl('text',{x:labelWidth-8,y:y+4,'text-anchor':'end',class:'row-name'},name);chart.append(nameNode);
      const barWidth=96*data.sizes[index]/setPeak;
      chart.append(svgEl('rect',{x:left-28-barWidth,y:y-6,width:barWidth,height:12,rx:2,class:'set-bar'}));
      chart.append(svgEl('text',{x:left-33-barWidth,y:y+4,'text-anchor':'end',class:'axis-label'},String(data.sizes[index])));
    });
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    model.shown.forEach((row,index)=>{
      const x=left+(index+.5)*spacing,isSelected=model.selected.some(r=>r.key===row.key);
      const group=svgEl('g',{role:'button',tabindex:0,'aria-pressed':String(isSelected),class:`intersection${isSelected?' selected':''}${model.selected.length&&!isSelected?' dimmed':''}`,
        'aria-label':`Select exact intersection ${describe(row)}: ${row.count} records; absent from ${data.names.filter(n=>!row.sets.includes(n)).join(', ')||'no sets'}`});
      const activate=()=>toggle(row.key);group.onclick=activate;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};
      group.append(svgEl('rect',{x:x-spacing*.42,y:top,width:spacing*.84,height:height-top-24,class:'hit-area'}));
      const h=row.count/peak*barH;
      group.append(svgEl('rect',{x:x-spacing*.29,y:barBottom-h,width:spacing*.58,height:h,rx:3,class:'intersection-bar'}));
      group.append(svgEl('text',{x,y:barBottom-h-7,'text-anchor':'middle',class:'bin-count'},String(row.count)));
      const active=data.names.map((n,i)=>row.sets.includes(n)?i:-1).filter(i=>i>=0);
      if(active.length>1)group.append(svgEl('line',{x1:x,x2:x,y1:matrixTop+active[0]*rowHeight,y2:matrixTop+active.at(-1)*rowHeight,class:'connector'}));
      data.names.forEach((name,i)=>group.append(svgEl('circle',{cx:x,cy:matrixTop+i*rowHeight,r:style.dot_size??5,class:row.sets.includes(name)?'dot active':'dot'})));
      if(!row.degree)group.append(svgEl('text',{x,y:height-20,'text-anchor':'middle',class:'axis-label'},'None'));
      const show=()=>{tooltip.replaceChildren(el('strong',{},describe(row)),el('p',{},`${row.count} records · Exact membership`),el('p',{},`Absent: ${data.names.filter(n=>!row.sets.includes(n)).join(', ')||'none'}`));tooltip.hidden=false;};
      group.onpointerenter=show;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=show;group.onblur=()=>tooltip.hidden=true;chart.append(group);
    });
    card.append(el('p',{class:'footnote'},`Showing ${model.shown.length} of ${model.rows.length} matching intersections. Set sizes use the full input; intersection counts are exclusive.${model.rows.length>model.shown.length?' Increase max_intersections to display more.':''}`));
  }
  draw();let previous=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-previous)<1)return;previous=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
