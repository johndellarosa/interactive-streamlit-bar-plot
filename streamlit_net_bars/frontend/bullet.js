export function bulletModel(data,state) {
  const all=data.rows.map(r=>{const target=state.targets?.[r.name]??r.target;return {...r,original_target:r.target,target,
    met:data.higher?r.value>=target:r.value<=target,gap:r.value-target,maximum:Math.max(r.value,target,r.target,...r.ranges)||1};});
  const rows=all.filter(r=>state.filter==='met'?r.met:state.filter==='missed'?!r.met:true);
  if(state.sort==='value'||state.sort==='gap')rows.sort((a,b)=>b[state.sort]-a[state.sort]);
  return {all,rows,peak:(Math.max(...all.map(r=>r.maximum))||1),selected:rows.filter(r=>(state.selected||[]).includes(r.name))};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.bullet');
  let state={...data.selection,selected:[...data.selection.selected],targets:{...data.selection.targets}};
  let editMetric=data.rows[0].name;
  const ns='http://www.w3.org/2000/svg',palette=['#4b80b6','#56a69a','#a092bc','#c08a59'];
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const fmt=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?'scientific':'standard'}).format(v);
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=bulletModel(data,state);root.replaceChildren();const card=el('section',{class:'bullet-card'});root.append(card);
    card.append(el('p',{class:'eyebrow'},'Performance explorer'),el('h3',{},data.title),el('p',{class:'intro'},'Bars show measurements, markers show targets, and background bands show qualitative ranges. Click a row to select a metric.'));
    const legend=el('div',{class:'legend'});data.range_colors.forEach((color,i)=>{const key=el('span'),swatch=el('i');swatch.style.background=color;key.append(swatch,document.createTextNode(`Band ${i+1}`));legend.append(key);});legend.append(el('span',{},'│ Target'));card.append(legend);
    const controls=el('div',{class:'controls'}),select=(label,key,options)=>{const wrap=el('label',{},label),input=el('select',{'aria-label':label});for(const[value,text]of options)input.append(el('option',{value},text));input.value=state[key];input.onchange=()=>{state[key]=input.value;publish();};wrap.append(input);controls.append(wrap);};
    select('Show metrics','filter',[['all','All metrics'],['met','Target met'],['missed','Target missed']]);select('Sort metrics','sort',[['input','Input order'],['value','Highest value'],['gap','Largest actual − target']]);
    const shared=el('button',{type:'button','aria-pressed':String(state.shared)},'Shared scale');shared.onclick=()=>{state.shared=!state.shared;publish();};controls.append(shared);
    const clear=el('button',{type:'button'},'Clear selection');clear.disabled=!state.selected.length;clear.onclick=()=>{state.selected=[];publish();};controls.append(clear);card.append(controls);
    if(data.editable_targets){const editor=el('div',{class:'controls'}),label=el('label',{},'Edit target for'),which=el('select',{'aria-label':'Edit target for'});data.rows.forEach(r=>which.append(el('option',{value:r.name},r.name)));which.value=editMetric;
      const input=el('input',{type:'number',min:0,max:1e300,step:'any','aria-label':'Target value',value:model.all.find(r=>r.name===editMetric).target});
      which.onchange=()=>{editMetric=which.value;input.value=model.all.find(r=>r.name===editMetric).target;};label.append(which);editor.append(label,input);
      const apply=el('button',{type:'button'},'Apply target');apply.onclick=()=>{const value=input.valueAsNumber;if(!Number.isFinite(value)||value<0||value>1e300){input.setCustomValidity('Enter a finite target between 0 and 1e300.');input.reportValidity();return;}state.targets={...state.targets,[editMetric]:value};publish();};editor.append(apply);
      const reset=el('button',{type:'button'},'Reset targets');reset.disabled=!Object.keys(state.targets).length;reset.onclick=()=>{state.targets={};publish();};editor.append(reset);card.append(editor);
    }
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.length} / ${data.rows.length} metrics visible · ${model.selected.length} selected · ${data.higher?'Higher':'Lower'} is better · ${state.shared?'Shared axis':'Independent row axes'}`));
    if(!model.rows.length){card.append(el('p',{class:'empty',role:'status'},'No metrics match. Choose All metrics to restore the view.'));return;}
    const plot=el('div',{class:'plot'});card.append(plot);
    const left=Math.min(230,Math.max(120,...data.rows.map(r=>r.name.length*(data.appearance?.label_fontsize||12)*.6+20)))+(data.appearance?.ylabel?25:0),right=25,width=Math.max(plot.clientWidth,550),top=20,bottom=25+(data.appearance?.xlabel?25:0),height=top+model.rows.length*data.row_height+bottom;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});plot.append(svg);addAxisTitles(svg,data,width,height);
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    model.rows.forEach((row,j)=>{
      const axis=niceAxis(0,(state.shared?model.peak:row.maximum)*1.05),x=v=>left+v/axis.domain[1]*(width-left-right),base=top+j*data.row_height+28,color=data.colors[row.name]||palette[data.rows.findIndex(r=>r.name===row.name)%palette.length],selected=state.selected.includes(row.name);
      const group=shape('g',{class:`bullet-row${selected?' selected':''}`,role:'button',tabindex:0,'aria-pressed':String(selected),'aria-label':`Select ${row.name}: actual ${fmt(row.value)}, target ${fmt(row.target)}, ${row.met?'target met':'target missed'}`});
      group.append(shape('rect',{x:0,y:base-25,width,height:data.row_height-5,class:'hit-area'}));
      const name=shape('text',{x:left-12,y:base+4,'text-anchor':'end',class:'row-name'},row.name);name.append(shape('title',{},row.name));group.append(name);
      let previous=0;row.ranges.forEach((edge,i)=>{group.append(shape('rect',{x:x(previous),y:base-16,width:x(edge)-x(previous),height:32,fill:data.range_colors[i],class:'range-band'}));previous=edge;});
      group.append(shape('rect',{x:x(0),y:base-6,width:Math.max(row.value===0?2:0,x(row.value)-x(0)),height:12,fill:color,class:'measure'}));
      if(row.target!==row.original_target)group.append(shape('line',{x1:x(row.original_target),x2:x(row.original_target),y1:base-18,y2:base+18,class:'original-target'}));
      group.append(shape('line',{x1:x(row.target),x2:x(row.target),y1:base-20,y2:base+20,stroke:data.target_color,class:'target'}));
      for(const value of axis.ticks)group.append(shape('text',{x:x(value),y:base+38,'text-anchor':'middle',class:'axis-label'},fmt(value)));
      if(data.show_values)group.append(shape('text',{x:left,y:base+60,class:'axis-label'},`Actual ${fmt(row.value)} · Target ${fmt(row.target)} · Gap ${row.gap>0?'+':''}${fmt(row.gap)} · ${row.met?'Met':'Missed'}`));
      const toggle=()=>{state.selected=selected?state.selected.filter(n=>n!==row.name):[...state.selected,row.name];publish();};group.onclick=toggle;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
      const show=()=>{tooltip.replaceChildren(el('strong',{},row.name),el('p',{},`Actual ${fmt(row.value)} · Target ${fmt(row.target)} · ${row.met?'Met':'Missed'}`),el('p',{},`Bands: 0–${row.ranges.map(fmt).join('–')}${row.target!==row.original_target?' · Target edited in this session':''}`));tooltip.hidden=false;const bounds=card.getBoundingClientRect(),rect=group.getBoundingClientRect();tooltip.style.top=`${Math.max(8,rect.y-bounds.y+15)}px`;};group.onpointerenter=show;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=show;group.onblur=()=>tooltip.hidden=true;svg.append(group);
    });
    card.append(el('p',{class:'footnote'},'Range boundaries remain fixed when targets are edited · Original target: dashed marker when changed · Independent scales compare performance within a metric; use shared axes only for comparable units'));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
