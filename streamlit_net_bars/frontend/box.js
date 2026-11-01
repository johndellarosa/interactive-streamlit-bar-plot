export function boxStats(points,whis=1.5) {
  const v=points.map(p=>p.value).sort((a,b)=>a-b),n=v.length;
  if(!n)return null;
  const q=p=>{const i=(n-1)*p,k=Math.floor(i),f=i-k;return v[k]*(1-f)+v[Math.min(k+1,n-1)]*f;};
  const q1=q(.25),median=q(.5),q3=q(.75),lower=q1-whis*(q3-q1),upper=q3+whis*(q3-q1);
  return {n,q1,median,q3,min:v[0],max:v.at(-1),low:Math.min(q1,v.find(x=>x>=lower)??q1),high:Math.max(q3,v.findLast(x=>x<=upper)??q3),
    mean:v.reduce((s,x)=>s+x/n,0),outlierIds:points.filter(p=>p.value<lower||p.value>upper).map(p=>p.id)};
}
export function quartileIds(points,summary,index) {
  if(!summary)return [];
  return points.filter(p=>index===0?p.value<=summary.q1:index===1?p.value>summary.q1&&p.value<=summary.median:
    index===2?p.value>summary.median&&p.value<=summary.q3:p.value>summary.q3).map(p=>p.id);
}
export function boxModel(data,state) {
  const rows=data.groups.filter(g=>!(state.hidden||[]).includes(g.name)).map(g=>{
    const points=g.points.filter(p=>!(state.excluded||[]).includes(p.id));return {...g,points,summary:boxStats(points,data.whis)};
  });
  const visible=rows.flatMap(g=>g.points.map(p=>({...p,group:g.name}))),selected=visible.filter(p=>(state.selected||[]).includes(p.id));
  const values=(state.fixed===false?visible:data.groups.flatMap(g=>g.points)).map(p=>p.value);
  const low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):0,pad=(high-low)*.1||Math.abs(low)*.1||1;
  return {rows,visible,selected,domain:data.style?.xlim||[low-pad,high+pad]};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.box-plot');
  const style=data.style,palette=['#4b80b6','#56a69a','#a092bc','#c08a59','#b46f7d'];
  root.style.setProperty('--point-alpha',style.point_alpha);root.style.setProperty('--box-alpha',style.box_alpha);
  let state={...data.selection,hidden:[...data.selection.hidden],selected:[...data.selection.selected],excluded:[...data.selection.excluded],history:data.selection.history.map(h=>[...h])};
  const ns='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const fmt=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?'scientific':'standard'}).format(v);
  const color=name=>style.colors[name]||palette[data.groups.findIndex(g=>g.name===name)%palette.length];
  const jitter=id=>{let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967295;};
  const publish=()=>{draw();setStateValue('selection',{...state});};
  const choose=ids=>{state.selected=ids;publish();};
  function draw() {
    const model=boxModel(data,state),axis=niceAxis(...model.domain,5,!style.xlim);model.domain=axis.domain;root.replaceChildren();const card=el('section',{class:'box-card'});root.append(card);
    const heading=el('div',{class:'heading'}),title=el('div');title.append(el('p',{class:'eyebrow'},'Interactive distribution explorer'),el('h3',{},data.title));heading.append(title);card.append(heading);
    card.append(el('p',{class:'intro'},'Select observations or quartile regions, then exclude selected points to recalculate the boxes. Undo restores exclusions.'));
    const legend=el('div',{class:'legend',role:'group','aria-label':'Group visibility'});
    data.groups.forEach(g=>{const hidden=state.hidden.includes(g.name),button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} group ${g.name}`},g.name);button.style.borderLeft=`4px solid ${color(g.name)}`;button.onclick=()=>{state.hidden=hidden?state.hidden.filter(n=>n!==g.name):[...state.hidden,g.name];state.selected=boxModel(data,state).selected.map(p=>p.id);publish();};legend.append(button);});card.append(legend);
    const controls=el('div',{class:'controls'});
    const button=(text,action,disabled=false)=>{const b=el('button',{type:'button'},text);b.disabled=disabled;b.onclick=action;controls.append(b);return b;};
    button('Select outliers',()=>choose(model.rows.flatMap(r=>r.summary?.outlierIds||[])),!model.visible.length);
    button('Clear selection',()=>choose([]),!model.selected.length);
    button('Exclude selected',()=>{state.history.push([...state.excluded]);state.excluded=[...new Set([...state.excluded,...model.selected.map(p=>p.id)])];state.selected=[];publish();},!model.selected.length);
    button('Undo exclusion',()=>{state.excluded=state.history.pop();state.selected=[];publish();},!state.history.length);
    button('Restore all',()=>{if(state.excluded.length)state.history.push([...state.excluded]);state.excluded=[];state.hidden=[];state.selected=[];publish();},!state.excluded.length&&!state.hidden.length);
    const fixed=button('Fixed axis',()=>{state.fixed=!state.fixed;publish();});fixed.setAttribute('aria-pressed',String(state.fixed));fixed.disabled=!!style.xlim;card.append(controls);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.visible.length} observations visible · ${model.selected.length} selected · ${state.excluded.length} excluded`));
    if(!model.rows.length){card.append(el('p',{class:'empty',role:'status'},'All groups are hidden. Use Restore all to recover.'));return;}
    const container=el('div',{class:'plot'});card.append(container);
    const width=Math.max(320,container.clientWidth),left=Math.min(width*.35,Math.max(100,...data.groups.map(g=>g.name.length*(data.appearance?.label_fontsize||12)*.6+18)))+(data.appearance?.ylabel?25:0),right=35,top=20,bottom=55+(data.appearance?.xlabel?25:0),height=top+model.rows.length*data.row_height+bottom;
    const plotW=width-left-right,x=v=>left+(v-model.domain[0])/(model.domain[1]-model.domain[0])*plotW;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});container.append(svg);addAxisTitles(svg,data,width,height);
    for(const value of axis.ticks){const xx=x(value);if(style.show_grid)svg.append(shape('line',{x1:xx,x2:xx,y1:top,y2:height-bottom,class:'grid'}));svg.append(shape('text',{x:xx,y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},fmt(value)));}
    const defs=shape('defs'),clip=shape('clipPath',{id:'box-clip'});clip.append(shape('rect',{x:left-1,y:top-5,width:plotW+2,height:height-bottom-top+15}));defs.append(clip);svg.append(defs);
    const marks=shape('g',{'clip-path':'url(#box-clip)'});svg.append(marks);
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const bind=(node,label,action,text)=>{node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',label);node.onclick=action;node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}};const show=()=>{tooltip.replaceChildren(el('strong',{},text));tooltip.hidden=false;};node.onpointerenter=show;node.onpointerleave=()=>tooltip.hidden=true;node.onfocus=show;node.onblur=()=>tooltip.hidden=true;};
    model.rows.forEach((row,j)=>{
      const base=top+j*data.row_height+27,c=color(row.name),s=row.summary;
      svg.append(shape('text',{x:left-12,y:base+4,'text-anchor':'end',class:'row-name'},row.name));svg.append(shape('text',{x:left-12,y:base+23,'text-anchor':'end',class:'axis-label'},`n = ${row.points.length}`));
      if(!s){svg.append(shape('text',{x:left+10,y:base+4,class:'axis-label'},'No retained observations'));return;}
      const whisker=shape('g',{class:'whisker'});whisker.append(shape('line',{x1:x(s.low),x2:x(s.high),y1:base,y2:base,stroke:c}));for(const v of [s.low,s.high])whisker.append(shape('line',{x1:x(v),x2:x(v),y1:base-10,y2:base+10,stroke:c}));marks.append(whisker);
      const boundaries=[s.min,s.q1,s.median,s.q3,s.max];
      for(let q=0;q<4;q++){
        const ids=quartileIds(row.points,s,q),region=shape('rect',{x:x(boundaries[q]),y:base-14,width:Math.max(2,x(boundaries[q+1])-x(boundaries[q])),height:28,fill:c,class:q===1||q===2?'box-region':'tail-region'});
        bind(region,`Select Q${q+1} in ${row.name}: ${ids.length} observations`,()=>choose(ids),`${row.name} · Q${q+1} value interval · ${ids.length} observations · Median ${fmt(s.median)}`);marks.append(region);
      }
      marks.append(shape('line',{x1:x(s.median),x2:x(s.median),y1:base-14,y2:base+14,class:'median'}));
      if(data.show_mean){const mean=shape('path',{d:`M ${x(s.mean)} ${base-5} l 5 5 l -5 5 l -5 -5 Z`,class:'mean'});mean.append(shape('title',{},`Mean: ${fmt(s.mean)}`));marks.append(mean);}
      if(style.show_points)row.points.forEach(p=>{
        const selected=model.selected.some(r=>r.id===p.id),outlier=s.outlierIds.includes(p.id),point=shape('circle',{cx:x(p.value),cy:base+31+jitter(p.id)*style.jitter,r:style.point_size,
          fill:c,class:`point${selected?' selected':''}${model.selected.length&&!selected?' dimmed':''}${outlier?' outlier':''}`});
        point.setAttribute('aria-pressed',String(selected));bind(point,`Select ${p.id}: ${row.name}, ${fmt(p.value)}${outlier?', outlier':''}`,()=>{state.selected=selected?state.selected.filter(i=>i!==p.id):[...state.selected,p.id];publish();},`${p.id} · ${row.name} · ${fmt(p.value)}${outlier?' · Outlier':''}`);marks.append(point);
      });
    });
    card.append(el('p',{class:'footnote'},`Linear-interpolated quartiles · Whiskers: ${data.whis} × IQR · Quartile selections use disjoint value intervals; tied values stay together · ${style.xlim?'Custom limits clip marks; selection still includes all retained data':state.fixed?'Full-input axis stays fixed':'Axis fits retained visible data'} · Exclusions recalculate all summaries`));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
