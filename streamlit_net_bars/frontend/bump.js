export function bumpModel(data,state) {
  const full=data.series.map(s=>({...s,ranks:s.values.map((v,i)=>1+data.series.filter(other=>state.higher===false?other.values[i]<v:other.values[i]>v).length)}));
  const values=full.flatMap(r=>r.values),low=Math.min(...values),high=Math.max(...values),pad=(high-low)*.1||Math.abs(low)*.1||1;
  return {rows:full.filter(r=>!(state.hidden||[]).includes(r.name)),rankMax:Math.max(1,full.length),valueDomain:[low-pad,high+pad]};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.bump');
  const style=data.plot_style||{},palette=['#4b80b6','#56a69a','#a092bc','#c08a59','#b46f7d','#7c8052'];
  let state={...data.selection,hidden:[...data.selection.hidden],selected:[...data.selection.selected]};
  const ns='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const color=name=>style.colors?.[name]||palette[data.series.findIndex(s=>s.name===name)%palette.length];
  const format=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>1e7)?'scientific':'standard'}).format(v);
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=bumpModel(data,state);root.replaceChildren();const card=el('section',{class:'bump-card'});root.append(card);
    const heading=el('div',{class:'heading'}),title=el('div');title.append(el('p',{class:'eyebrow'},'Ranking explorer'),el('h3',{},data.title));
    const show=el('button',{type:'button'},'Show all');show.disabled=!state.hidden.length;show.onclick=()=>{state.hidden=[];publish();};heading.append(title,show);card.append(heading);
    card.append(el('p',{class:'intro'},'Follow competitors across periods. Click a trajectory to highlight it; use the legend to hide or restore competitors.'));
    const legend=el('div',{class:'legend',role:'group','aria-label':'Series visibility'});
    data.series.forEach(row=>{
      const hidden=state.hidden.includes(row.name),button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} series ${row.name}`}),swatch=el('i');swatch.style.background=color(row.name);button.append(swatch,document.createTextNode(row.name));
      button.onclick=()=>{state.hidden=hidden?state.hidden.filter(n=>n!==row.name):[...state.hidden,row.name];state.selected=state.selected.filter(n=>!state.hidden.includes(n));publish();};legend.append(button);
    });card.append(legend);
    const controls=el('div',{class:'controls'});
    const select=(label,key,options)=>{const wrapper=el('label',{},label),input=el('select',{'aria-label':label});for(const[value,text]of options)input.append(el('option',{value},text));input.value=String(state[key]);input.onchange=()=>{state[key]=key==='higher'?input.value==='true':input.value;publish();};wrapper.append(input);controls.append(wrapper);};
    select('Display','mode',[['rank','Rank'],['value','Actual value']]);select('Ranking direction','higher',[['true','Higher is better'],['false','Lower is better']]);
    const clear=el('button',{type:'button'},'Clear highlights');clear.disabled=!state.selected.length;clear.onclick=()=>{state.selected=[];publish();};controls.append(clear);card.append(controls);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.length} / ${data.series.length} competitors visible · ${state.selected.length} highlighted`));
    if(!model.rows.length){card.append(el('p',{role:'status',class:'empty'},'All competitors are hidden. Use Show all to restore them.'));return;}
    const container=el('div',{class:'plot'});card.append(container);
    const width=Math.max(300,container.clientWidth),height=data.height,left=75+(data.appearance?.ylabel?25:0),right=style.show_end_labels===false?35:Math.min(180,width*.25),top=25,bottom=55+(data.appearance?.xlabel?25:0);
    const plotW=width-left-right,plotH=height-top-bottom;
    const valueAxis=niceAxis(...model.valueDomain);model.valueDomain=valueAxis.domain;
    const x=i=>left+(data.x.length===1?.5:i/(data.x.length-1))*plotW;
    const y=v=>state.mode==='rank'?top+(model.rankMax===1?.5:(v-1)/(model.rankMax-1))*plotH:top+(model.valueDomain[1]-v)/(model.valueDomain[1]-model.valueDomain[0])*plotH;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});container.append(svg);addAxisTitles(svg,data,width,height);
    const ranks=Array.from({length:model.rankMax},(_,i)=>i+1),stride=Math.max(1,Math.ceil(model.rankMax/12));
    const ticks=state.mode==='rank'?ranks.filter((v,i)=>i%stride===0||v===model.rankMax):valueAxis.ticks;
    ticks.forEach(v=>{svg.append(shape('line',{x1:left,x2:width-right,y1:y(v),y2:y(v),class:'grid'}));svg.append(shape('text',{x:left-10,y:y(v)+4,'text-anchor':'end',class:'axis-label'},state.mode==='rank'?`#${v}`:format(v)));});
    const tickStride=Math.max(1,Math.ceil(data.x.length/Math.max(2,plotW/85)));
    data.x.forEach((label,i)=>{if(i%tickStride===0||i===data.x.length-1){const text=shape('text',{x:x(i),y:height-bottom+25,'text-anchor':i===0?'start':i===data.x.length-1?'end':'middle',class:'axis-label'},label.length>16?label.slice(0,15)+'…':label);text.append(shape('title',{},label));svg.append(text);}});
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const showTooltip=(row,i)=>{tooltip.replaceChildren(el('strong',{},row.name),el('p',{},`${data.x[i]} · Rank ${row.ranks[i]} · Value ${format(row.values[i])}`));tooltip.hidden=false;};
    const ordered=[...model.rows].sort((a,b)=>Number(state.selected.includes(a.name))-Number(state.selected.includes(b.name)));
    ordered.forEach(row=>{
      const selected=state.selected.includes(row.name),group=shape('g',{class:`trajectory${selected?' selected':''}${state.selected.length&&!selected?' dimmed':''}`,role:'button',tabindex:0,'aria-pressed':String(selected),'aria-label':`Highlight ${row.name}: ranks ${row.ranks.join(', ')}`});
      const activate=()=>{state.selected=selected?state.selected.filter(n=>n!==row.name):[...state.selected,row.name];publish();};group.onclick=activate;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};
      const values=state.mode==='rank'?row.ranks:row.values,points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
      group.append(shape('polyline',{points,stroke:color(row.name),class:'trajectory-hit'}),shape('polyline',{points,stroke:color(row.name),class:'bump-line'}));
      values.forEach((v,i)=>{if(style.show_points!==false||values.length===1){const point=shape('circle',{cx:x(i),cy:y(v),r:style.point_size??4,fill:color(row.name),class:'bump-dot'});point.onpointerenter=()=>showTooltip(row,i);group.append(point);}});
      if(style.show_end_labels!==false){const label=shape('text',{x:width-right+9,y:y(values.at(-1))+4,class:'row-name',fill:color(row.name)},row.name.length>18?row.name.slice(0,17)+'…':row.name);label.append(shape('title',{},row.name));group.append(label);}
      group.onpointermove=e=>{const bounds=svg.getBoundingClientRect(),position=(e.clientX-bounds.left)*width/bounds.width;const i=data.x.length===1?0:Math.max(0,Math.min(data.x.length-1,Math.round((position-left)/plotW*(data.x.length-1))));showTooltip(row,i);};group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=()=>showTooltip(row,row.values.length-1);group.onblur=()=>tooltip.hidden=true;svg.append(group);
    });
    card.append(el('p',{class:'footnote'},'Competition ranks: ties share a rank and leave a gap (1, 1, 3). Hidden competitors still determine ranks and axis limits. Exact ties overlap; use highlights to inspect them. Periods are equally spaced in supplied order.'));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
