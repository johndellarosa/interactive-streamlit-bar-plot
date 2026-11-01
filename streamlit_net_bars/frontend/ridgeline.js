export function ridgelineModel(data,state) {
  const all=data.groups.flatMap(g=>g.points.map(p=>p.value)),low=all.length?Math.min(...all):0,high=all.length?Math.max(...all):0;
  const pad=(high-low)*.15||Math.abs(low)*.1||1,domain=data.style?.xlim||[low-pad,high+pad];
  const rows=data.groups.filter(g=>!(state.hidden||[]).includes(g.name)).map(g=>({...g,summary:distribution(g.points.map(p=>p.value))}));
  if(state.sort==='mean'||state.sort==='median')rows.sort((a,b)=>a.summary===null?(b.summary===null?0:1):b.summary===null?-1:b.summary[state.sort]-a.summary[state.sort]);
  const selected=rows.filter(r=>(state.selected||[]).includes(r.name)),points=rows.flatMap(r=>r.points.map(p=>({...p,group:r.name}))).filter(p=>
    (selected.length||state.range!=null)&&(!selected.length||selected.some(r=>r.name===p.group))&&(state.range==null||p.value>=state.range[0]&&p.value<=state.range[1]));
  return {rows,domain,selected,points};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.ridgeline');
  root.style.setProperty('--range-color',data.selected_color);
  let state={...data.selection,hidden:[...data.selection.hidden],selected:[...data.selection.selected]};
  const ns='http://www.w3.org/2000/svg',clipId='ridge-'+crypto.randomUUID(),palette=['#4b80b6','#56a69a','#a092bc','#c08a59','#b46f7d','#81985f'];
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const fmt=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?'scientific':'standard'}).format(v);
  const color=name=>data.style.colors[name]||palette[data.groups.findIndex(g=>g.name===name)%palette.length];
  const publish=()=>{draw();setStateValue('selection',{...state});};
  const toggle=name=>{state.selected=state.selected.includes(name)?state.selected.filter(n=>n!==name):[...state.selected,name];publish();};
  function draw() {
    const model=ridgelineModel(data,state),axis=niceAxis(...model.domain,5,!data.style.xlim);model.domain=axis.domain;
    root.replaceChildren();const card=el('section',{class:'ridgeline-card'});root.append(card);
    card.append(el('p',{class:'eyebrow'},'Distribution shape explorer'),el('h3',{},data.title),el('p',{class:'intro'},'Click ridges to select groups. Brush a value interval or enter limits to select observations within that range. Smoothing and overlap change the display, not the data.'));
    const legend=el('div',{class:'legend',role:'group','aria-label':'Group visibility'});
    data.groups.forEach(g=>{const hidden=state.hidden.includes(g.name),button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} group ${g.name}`},g.name);button.style.borderLeft=`4px solid ${color(g.name)}`;button.onclick=()=>{state.hidden=hidden?state.hidden.filter(n=>n!==g.name):[...state.hidden,g.name];state.selected=state.selected.filter(n=>!state.hidden.includes(n));publish();};legend.append(button);});card.append(legend);
    const controls=el('div',{class:'controls'}),select=(label,key,options)=>{const wrap=el('label',{},label),input=el('select',{'aria-label':label});for(const[value,text]of options)input.append(el('option',{value},text));input.value=String(state[key]);input.onchange=()=>{state[key]=key==='smoothing'?Number(input.value):input.value;publish();};wrap.append(input);controls.append(wrap);};
    const smoothOptions=[[.5,'Fine (0.5×)'],[1,'Standard (1×)'],[2,'Smooth (2×)']];if(!smoothOptions.some(([v])=>v===state.smoothing))smoothOptions.push([state.smoothing,`${state.smoothing}×`]);select('Density smoothing','smoothing',smoothOptions);
    select('Sort groups','sort',[['input','Input order'],['mean','Highest mean first'],['median','Highest median first']]);select('Interaction','mode',[['groups','Select groups'],['brush','Brush values']]);
    const overlapLabel=el('label',{},`Overlap: ${state.overlap}×`),overlap=el('input',{type:'range',min:.5,max:2.5,step:.1,value:state.overlap,'aria-label':'Ridge overlap'});overlap.onchange=()=>{state.overlap=Number(overlap.value);publish();};overlapLabel.append(overlap);controls.append(overlapLabel);
    const button=(text,action,disabled)=>{const b=el('button',{type:'button'},text);b.disabled=!!disabled;b.onclick=action;controls.append(b);};
    button('Show all',()=>{state.hidden=[];publish();},!state.hidden.length);button('Clear selection',()=>{state.selected=[];state.range=null;publish();},!state.selected.length&&state.range===null);card.append(controls);
    const rangeControls=el('div',{class:'controls range-controls'}),lower=el('input',{type:'number',step:'any',value:state.range?.[0]??model.domain[0],'aria-label':'Range minimum'}),upper=el('input',{type:'number',step:'any',value:state.range?.[1]??model.domain[1],'aria-label':'Range maximum'});
    for(const[label,input]of[['Minimum',lower],['Maximum',upper]]){const wrap=el('label',{},label);wrap.append(input);rangeControls.append(wrap);}
    const apply=el('button',{type:'button'},'Apply range');apply.onclick=()=>{const low=lower.valueAsNumber,high=upper.valueAsNumber;if(!Number.isFinite(low)||!Number.isFinite(high)||low>high){lower.setCustomValidity('Enter finite increasing range limits.');lower.reportValidity();return;}state.range=[low,high];publish();};rangeControls.append(apply);
    const clearRange=el('button',{type:'button'},'Clear range');clearRange.disabled=state.range==null;clearRange.onclick=()=>{state.range=null;publish();};rangeControls.append(clearRange);card.append(rangeControls);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.length} / ${data.groups.length} groups visible · ${model.selected.length} groups selected · ${model.points.length} observations selected${state.range?` · Range ${fmt(state.range[0])} to ${fmt(state.range[1])}`:''}`));
    if(!model.rows.length){card.append(el('p',{class:'empty',role:'status'},'All groups are hidden. Use Show all to restore them.'));return;}
    const plot=el('div',{class:'plot'});card.append(plot);
    const ridgeH=data.row_height*state.overlap,left=Math.min(230,Math.max(110,...data.groups.map(g=>g.name.length*(data.appearance?.label_fontsize||12)*.6+18)))+(data.appearance?.ylabel?25:0),right=25,width=Math.max(340,plot.clientWidth),top=ridgeH+20,bottom=55+(data.appearance?.xlabel?25:0),height=top+(model.rows.length-1)*data.row_height+bottom,plotW=width-left-right;
    const x=v=>left+(v-model.domain[0])/(model.domain[1]-model.domain[0])*plotW,baseline=i=>top+i*data.row_height;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});plot.append(svg);addAxisTitles(svg,data,width,height);
    for(const value of axis.ticks){if(data.style.show_grid)svg.append(shape('line',{x1:x(value),x2:x(value),y1:12,y2:height-bottom,class:'grid'}));svg.append(shape('text',{x:x(value),y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},fmt(value)));}
    const defs=shape('defs'),clip=shape('clipPath',{id:clipId});clip.append(shape('rect',{x:left,y:0,width:plotW,height:height-bottom+2}));defs.append(clip);svg.append(defs);
    const marks=shape('g',{'clip-path':`url(#${clipId})`});svg.append(marks);
    const brush=shape('rect',{y:8,height:height-bottom-8,class:'range-band'});marks.append(brush);
    const setBand=(low,high)=>{const a=Math.max(left,Math.min(width-right,low)),b=Math.max(left,Math.min(width-right,high));brush.setAttribute('x',Math.min(a,b));brush.setAttribute('width',Math.abs(b-a));};
    if(state.range)setBand(x(state.range[0]),x(state.range[1]));else brush.setAttribute('width','0');
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const drawn=model.rows.map((r,i)=>({row:r,index:i}));drawn.sort((a,b)=>Number(state.selected.includes(a.row.name))-Number(state.selected.includes(b.row.name)));
    drawn.forEach(({row,index})=>{
      const base=baseline(index),selected=state.selected.includes(row.name),summary=row.summary,c=color(row.name),group=shape('g',{class:`ridge${selected?' selected':''}${model.selected.length&&!selected?' dimmed':''}`,role:'button',tabindex:0,'aria-pressed':String(selected),'aria-label':`Select group ${row.name}: ${row.points.length} observations${summary?`, median ${fmt(summary.median)}`:''}`});
      group.append(shape('line',{x1:left,x2:width-right,y1:base,y2:base,class:'ridge-baseline'}));
      if(summary){const samples=density(row.points.map(p=>p.value),model.domain,state.smoothing);
        if(samples.length){const d=`M ${x(samples[0][0])} ${base} `+samples.map(([v,h])=>`L ${x(v)} ${base-h*ridgeH}`).join(' ')+` L ${x(samples.at(-1)[0])} ${base} Z`;
          group.append(shape('path',{d,fill:c,'fill-opacity':data.fill_opacity,stroke:selected?data.selected_color:c,'stroke-width':selected?Math.max(2.5,data.line_width):data.line_width,class:'ridge-shape'}));
          if(data.show_median){const nearest=samples.reduce((best,p)=>Math.abs(p[0]-summary.median)<Math.abs(best[0]-summary.median)?p:best,samples[0]);group.append(shape('line',{x1:x(summary.median),x2:x(summary.median),y1:base,y2:base-nearest[1]*ridgeH,class:'median-marker'}));}
        }else{group.append(shape('line',{x1:x(summary.median),x2:x(summary.median),y1:base,y2:base-ridgeH*.5,stroke:selected?data.selected_color:c,'stroke-width':3,class:'constant-marker'}));group.append(shape('circle',{cx:x(summary.median),cy:base-ridgeH*.5,r:3.5,fill:selected?data.selected_color:c}));}
      }else group.append(shape('text',{x:left+10,y:base-8,class:'axis-label'},'No observations'));
      const activate=()=>toggle(row.name);group.onclick=activate;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};
      const show=()=>{tooltip.replaceChildren(el('strong',{},row.name),el('p',{},summary?`n ${summary.n} · Mean ${fmt(summary.mean)} · Median ${fmt(summary.median)}`:'No observations'),el('p',{},summary?`Range ${fmt(summary.min)}–${fmt(summary.max)}`:''));tooltip.hidden=false;const bounds=card.getBoundingClientRect(),rect=group.getBoundingClientRect();tooltip.style.top=`${Math.max(8,rect.y-bounds.y+15)}px`;};group.onpointerenter=show;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=show;group.onblur=()=>tooltip.hidden=true;marks.append(group);
    });
    model.rows.forEach((row,i)=>{const label=shape('text',{x:left-10,y:baseline(i)-5,'text-anchor':'end',class:'row-name',role:'button',tabindex:0,'aria-label':`Select row ${row.name}`,'aria-pressed':String(state.selected.includes(row.name))},row.name);label.onclick=()=>toggle(row.name);label.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(row.name);}};svg.append(label);svg.append(shape('text',{x:left-10,y:baseline(i)+11,'text-anchor':'end',class:'axis-label'},`n = ${row.points.length}`));});
    if(state.mode==='brush'){
      const overlay=shape('rect',{x:left,y:8,width:plotW,height:height-bottom-8,fill:'transparent',class:'brush-surface',tabindex:0,role:'group','aria-label':'Drag horizontally to select a value range; click or press Escape to clear range'});svg.append(overlay);
      const position=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const local=p.matrixTransform(svg.getScreenCTM().inverse());return Math.max(left,Math.min(width-right,local.x));};let origin=null;
      overlay.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();origin=position(e);overlay.setPointerCapture(e.pointerId);};overlay.onpointermove=e=>{if(origin!==null)setBand(origin,position(e));};
      overlay.onpointerup=e=>{if(origin===null)return;const end=position(e),value=p=>model.domain[0]+(p-left)/plotW*(model.domain[1]-model.domain[0]);state.range=Math.abs(end-origin)<3?null:[value(Math.min(origin,end)),value(Math.max(origin,end))];origin=null;publish();};
      overlay.onpointercancel=()=>{origin=null;if(state.range)setBand(x(state.range[0]),x(state.range[1]));else brush.setAttribute('width','0');};overlay.onkeydown=e=>{if(e.key==='Escape'){state.range=null;publish();}};
    }
    card.append(el('p',{class:'footnote'},'Equal-peak Gaussian KDEs compare shape, not sample size · Singleton/constant groups show markers without KDE · Full-input axis is stable across filtering · Selected records must satisfy both group and range filters when active'));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
