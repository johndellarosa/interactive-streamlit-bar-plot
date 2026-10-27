export function quantile(sorted,p) {
  if(!sorted.length)return null;
  const i=(sorted.length-1)*p,k=Math.floor(i),f=i-k;
  return sorted[k]*(1-f)+sorted[Math.min(k+1,sorted.length-1)]*f;
}
export function distribution(values) {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  if(!n)return null;
  const q1=quantile(sorted,.25),median=quantile(sorted,.5),q3=quantile(sorted,.75),iqr=q3-q1;
  return {n,q1,median,q3,low:sorted.find(v=>v>=q1-1.5*iqr),high:sorted.findLast(v=>v<=q3+1.5*iqr),
    mean:sorted.reduce((s,v)=>s+v/n,0),min:sorted[0],max:sorted.at(-1)};
}
export function raincloudModel(data,state) {
  const all=data.groups.flatMap(g=>g.points.map(p=>p.value));
  const low=all.length?Math.min(...all):0,high=all.length?Math.max(...all):0;
  const span=high-low,pad=span*.15 || Math.abs(low)*.1 || 1,domain=data.style?.xlim || [low-pad,high+pad];
  const ordered=data.style?.group_order?data.style.group_order.map(name=>data.groups.find(g=>g.name===name)):data.groups;
  const rows=ordered.filter(g=>!(state.hidden||[]).includes(g.name)).map(g=>({...g,summary:distribution(g.points.map(p=>p.value))}));
  const selected=rows.flatMap(g=>g.points.filter(p=>(state.selected||[]).includes(p.id)).map(p=>({...p,group:g.name})));
  return {rows,domain,selected};
}
export function density(values,domain,smoothing=1) {
  if(values.length<2 || Math.min(...values)===Math.max(...values))return [];
  // Work in unit coordinates to avoid magnitude-dependent variance underflow.
  const span=domain[1]-domain[0],v=values.map(x=>(x-domain[0])/span),summary=distribution(v),n=v.length;
  const sd=Math.sqrt(v.reduce((s,x)=>s+(x-summary.mean)**2/(n-1),0));
  const robust=(summary.q3-summary.q1)/1.34;
  const scale=robust>0?Math.min(sd,robust):sd;
  const bandwidth=Math.max(1e-5,.9*scale*Math.pow(n,-.2)*smoothing);
  const samples=Array.from({length:161},(_,i)=>{
    const x=i/160,y=v.reduce((s,p)=>s+Math.exp(-.5*((x-p)/bandwidth)**2),0)/n/bandwidth;
    return [domain[0]+x*span,y];
  });
  const peak=Math.max(...samples.map(p=>p[1]));
  return samples.map(([x,y])=>[x,peak?y/peak:0]);
}

export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.raincloud');
  const style=data.style || {};
  for(const [key,value] of Object.entries({point_alpha:style.point_alpha??.7,cloud_alpha:style.cloud_alpha??.45,box_alpha:style.box_alpha??.7}))root.style.setProperty('--'+key.replace('_','-'),value);
  const clipId='rain-'+crypto.randomUUID();
  let state={...data.selection,hidden:[...data.selection.hidden],selected:[...data.selection.selected]};
  const ns='http://www.w3.org/2000/svg',palette=['#4b80b6','#56a69a','#a092bc','#c08a59','#b46f7d'];
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const format=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?'scientific':'standard'}).format(v);
  const hash=id=>{let n=5381;for(const c of id)n=((n*33)^c.charCodeAt(0))>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295;};
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=raincloudModel(data,state);root.replaceChildren();const card=el('section',{class:'raincloud-card'});root.append(card);
    const heading=el('div',{class:'heading'}),title=el('div');title.append(el('p',{class:'eyebrow'},'Distribution explorer'),el('h3',{},data.title));
    const show=el('button',{type:'button'},'Show all');show.disabled=!state.hidden.length;show.onclick=()=>{state.hidden=[];publish();};heading.append(title,show);card.append(heading);
    card.append(el('p',{class:'intro'},'Clouds show distribution shape, boxes summarize the middle half, and dots show individual observations. Click dots to select them.'));
    const legend=el('div',{class:'legend',role:'group','aria-label':'Group visibility'});
    data.groups.forEach((g,i)=>{
      const hidden=state.hidden.includes(g.name),button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} group ${g.name}`});
      const swatch=el('i');swatch.style.background=style.colors?.[g.name] || palette[i%palette.length];button.append(swatch,document.createTextNode(g.name));
      button.onclick=()=>{state.hidden=hidden?state.hidden.filter(n=>n!==g.name):[...state.hidden,g.name];state.selected=raincloudModel(data,state).selected.map(p=>p.id);publish();};legend.append(button);
    });card.append(legend);
    const controls=el('div',{class:'controls'}),label=el('label',{},'Density smoothing'),smooth=el('select',{'aria-label':'Density smoothing'});
    for(const[value,text]of[[.5,'Fine (0.5×)'],[1,'Standard (1×)'],[2,'Smooth (2×)'],[state.smoothing,`${state.smoothing}×`]])if(![...smooth.options].some(o=>o.value===String(value)))smooth.append(el('option',{value},text));
    smooth.value=String(state.smoothing);smooth.onchange=()=>{state.smoothing=Number(smooth.value);publish();};label.append(smooth);controls.append(label);
    const points=el('button',{type:'button','aria-pressed':String(state.points)},'Show points');points.onclick=()=>{state.points=!state.points;publish();};controls.append(points);
    const clear=el('button',{type:'button'},'Clear selection');clear.disabled=!model.selected.length;clear.onclick=()=>{state.selected=[];publish();};controls.append(clear);card.append(controls);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.reduce((s,g)=>s+g.points.length,0)} observations visible · ${model.selected.length} selected`));
    if(!model.rows.length){card.append(el('p',{class:'empty',role:'status'},'All groups are hidden. Use Show all to restore them.'));return;}
    const container=el('div',{class:'plot'});card.append(container);
    const labelSize=data.appearance?.label_fontsize||12;
    const width=Math.max(300,container.clientWidth),left=Math.min(width*.38,Math.max(100,...data.groups.map(g=>g.name.length*labelSize*.6+20)))+(data.appearance?.ylabel?24:0),right=40,top=25;
    const bottom=55+(data.appearance?.xlabel?25:0),height=top+model.rows.length*data.row_height+bottom;
    const plotW=width-left-right,x=v=>left+(v-model.domain[0])/(model.domain[1]-model.domain[0])*plotW;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});container.append(svg);addAxisTitles(svg,data,width,height);
    const tickCount=style.tick_count || 5;
    for(let i=0;i<tickCount;i++){
      const value=model.domain[0]+(model.domain[1]-model.domain[0])*i/(tickCount-1),xx=x(value);
      if(style.show_grid!==false)svg.append(shape('line',{x1:xx,x2:xx,y1:top,y2:height-bottom,class:'grid'}));
      svg.append(shape('text',{x:xx,y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},format(value)));
    }
    const defs=shape('defs'),clip=shape('clipPath',{id:clipId});clip.append(shape('rect',{x:left,y:top-12,width:plotW,height:height-bottom-top+24}));defs.append(clip);svg.append(defs);
    const marks=shape('g',{'clip-path':`url(#${clipId})`});svg.append(marks);
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    model.rows.forEach((g,index)=>{
      const color=style.colors?.[g.name] || palette[data.groups.findIndex(r=>r.name===g.name)%palette.length],base=top+index*data.row_height+data.row_height*.54,boxY=base+16,pointY=base+39;
      const name=shape('text',{x:left-16,y:base-12,'text-anchor':'end',class:'row-name'},g.name);name.append(shape('title',{},g.name));svg.append(name);
      svg.append(shape('text',{x:left-16,y:base+7,'text-anchor':'end',class:'axis-label'},`n = ${g.points.length}`));
      if(!g.summary){svg.append(shape('text',{x:left+10,y:base,class:'axis-label'},'No observations'));return;}
      const s=g.summary,d=density(g.points.map(p=>p.value),model.domain,state.smoothing),cloudH=data.row_height*.44;
      if(style.show_density!==false && d.length){const path=`M ${x(d[0][0])} ${base} `+d.map(([v,h])=>`L ${x(v)} ${base-h*cloudH}`).join(' ')+` L ${x(d.at(-1)[0])} ${base} Z`;
        const cloud=shape('path',{d:path,fill:color,class:'cloud'});cloud.append(shape('title',{},`${g.name}: smoothed distribution, n=${s.n}`));marks.append(cloud);}
      const box=shape('g',{class:'box',tabindex:0,role:'img','aria-label':`${g.name}: median ${format(s.median)}, Q1 ${format(s.q1)}, Q3 ${format(s.q3)}, whiskers ${format(s.low)} to ${format(s.high)}`});
      box.append(shape('line',{x1:x(s.low),x2:x(s.high),y1:boxY,y2:boxY,stroke:color}));
      for(const v of[s.low,s.high])box.append(shape('line',{x1:x(v),x2:x(v),y1:boxY-5,y2:boxY+5,stroke:color}));
      box.append(shape('rect',{x:x(s.q1),y:boxY-7,width:Math.max(1,x(s.q3)-x(s.q1)),height:14,fill:color}));
      box.append(shape('line',{x1:x(s.median),x2:x(s.median),y1:boxY-7,y2:boxY+7,class:'median'}));if(style.show_box!==false)marks.append(box);
      if(state.points)g.points.forEach(p=>{
        const selected=model.selected.some(r=>r.id===p.id),dot=shape('circle',{cx:x(p.value),cy:pointY+hash(p.id)*(style.jitter??15),r:selected?(style.point_size??3.2)*1.375:(style.point_size??3.2),fill:color,
          class:`point${selected?' selected':''}${model.selected.length&&!selected?' dimmed':''}`,role:'button',tabindex:0,'aria-pressed':String(selected),'aria-label':`Select ${p.id}: ${g.name}, ${format(p.value)}`});
        const toggle=()=>{state.selected=selected?state.selected.filter(i=>i!==p.id):[...state.selected,p.id];publish();};dot.onclick=toggle;dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
        const hover=()=>{tooltip.replaceChildren(el('strong',{},p.id),el('p',{},`${g.name} · ${format(p.value)}`));tooltip.hidden=false;};dot.onpointerenter=hover;dot.onpointerleave=()=>tooltip.hidden=true;dot.onfocus=hover;dot.onblur=()=>tooltip.hidden=true;marks.append(dot);
      });
    });
    card.append(el('p',{class:'footnote'},`Equal-peak Gaussian densities · Quartiles use linear interpolation; whiskers reach observed values within 1.5 × IQR · ${style.xlim?'Custom axis limits; observations outside limits are clipped (selection and summaries still include them)':'Full-input axis stays fixed when hiding groups'} · Constant/single observations have no density`));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(width-root.clientWidth)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
