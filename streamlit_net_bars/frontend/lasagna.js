export function lasagnaModel(data,state) {
  const start=Math.max(0,Math.min(data.x.length-1,state.start??0)),end=Math.max(start,Math.min(data.x.length-1,state.end??data.x.length-1));
  const all=data.series.map(row=>{
    const valid=row.values.filter(v=>v!==null),mean=valid.length?valid.reduce((s,v)=>s+v/valid.length,0):null;
    return {...row,mean,latest:valid.length?valid.at(-1):null,display:row.values.map(v=>v===null?null:state.scale==='centered'?v-mean:v)};
  });
  const values=all.flatMap(r=>r.display.filter(v=>v!==null));
  let low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1;
  if(state.scale==='centered'){const peak=Math.max(Math.abs(low),Math.abs(high))||1;low=-peak;high=peak;}
  else if(low===high){const pad=Math.abs(low)*.1||1;low-=pad;high+=pad;}
  if(data.vmin!==null && data.vmin!==undefined){low=data.vmin;high=data.vmax;}
  const rows=all.filter(r=>!(state.hidden||[]).includes(r.name));
  if(state.sort==='mean'||state.sort==='latest')rows.sort((a,b)=>{
    const av=a[state.sort],bv=b[state.sort];return av===null?(bv===null?0:1):bv===null?-1:bv-av;
  });
  return {rows,start,end,domain:[low,high]};
}
export function heatColor(value,domain,palette,missing) {
  if(value===null)return missing;
  const t=Math.max(0,Math.min(1,(value-domain[0])/(domain[1]-domain[0])))*(palette.length-1),i=Math.min(palette.length-2,Math.floor(t)),f=t-i;
  const rgb=c=>[1,3,5].map(k=>parseInt(c.slice(k,k+2),16));
  return '#'+rgb(palette[i]).map((v,k)=>Math.round(v+(rgb(palette[i+1])[k]-v)*f).toString(16).padStart(2,'0')).join('');
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.lasagna');
  let state={...data.selection,hidden:[...data.selection.hidden],selected:[...data.selection.selected]};
  const ns='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const fmt=v=>v===null?'Missing':new Intl.NumberFormat(undefined,{maximumSignificantDigits:5,notation:v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>1e7)?'scientific':'standard'}).format(v);
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=lasagnaModel(data,state);root.replaceChildren();const card=el('section',{class:'lasagna-card'});root.append(card);
    const heading=el('div',{class:'heading'}),title=el('div');title.append(el('p',{class:'eyebrow'},'Longitudinal explorer'),el('h3',{},data.title));
    const show=el('button',{type:'button'},'Show all rows');show.disabled=!state.hidden.length;show.onclick=()=>{state.hidden=[];publish();};heading.append(title,show);card.append(heading);
    card.append(el('p',{class:'intro'},'Each row is a subject and each column a period. Click cells to select observations; use the row controls to filter subjects.'));
    const details=el('details'),summary=el('summary',{},'Row visibility');details.append(summary);const chips=el('div',{class:'legend'});
    data.series.forEach(row=>{const hidden=state.hidden.includes(row.name),button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} row ${row.name}`},row.name);button.onclick=()=>{state.hidden=hidden?state.hidden.filter(n=>n!==row.name):[...state.hidden,row.name];state.selected=state.selected.filter(([name])=>!state.hidden.includes(name));publish();};chips.append(button);});details.append(chips);card.append(details);
    const controls=el('div',{class:'controls'});
    const select=(label,key,options)=>{const wrapper=el('label',{},label),input=el('select',{'aria-label':label});for(const[value,text]of options)input.append(el('option',{value},text));input.value=String(state[key]);input.onchange=()=>{state[key]=key==='start'||key==='end'?Number(input.value):input.value;if(state.start>state.end){if(key==='start')state.end=state.start;else state.start=state.end;}publish();};wrapper.append(input);controls.append(wrapper);};
    select('Sort rows','sort',[['input','Input order'],['mean','Highest mean first'],['latest','Highest last observed first']]);
    select('Color scale','scale',[['raw','Raw values'],['centered','Deviation from row mean']]);
    const periods=data.x.map((p,i)=>[i,p]);select('From','start',periods);select('To','end',periods);
    const clear=el('button',{type:'button'},'Clear selection');clear.disabled=!state.selected.length;clear.onclick=()=>{state.selected=[];publish();};controls.append(clear);card.append(controls);
    const visibleSelected=state.selected.filter(([name,i])=>model.rows.some(r=>r.name===name&&r.values[i]!==null)&&i>=model.start&&i<=model.end);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.length} / ${data.series.length} subjects visible · ${model.end-model.start+1} periods · ${visibleSelected.length} cells selected in this window`));
    const legend=el('div',{class:'color-legend'}),gradient=el('span',{class:'gradient'});gradient.style.background=`linear-gradient(to right,${data.palette.join(',')})`;
    const missing=el('i');missing.style.background=data.missing_color;
    legend.append(el('span',{},fmt(model.domain[0])),gradient,el('span',{},fmt(model.domain[1])),missing,document.createTextNode('Missing'));card.append(legend);
    if(!model.rows.length){card.append(el('p',{role:'status',class:'empty'},'All rows are hidden. Use Show all rows to restore them.'));return;}
    const container=el('div',{class:'plot'});card.append(container);
    const count=model.end-model.start+1,labelSize=data.appearance?.label_fontsize||12,left=Math.min(230,Math.max(105,...data.series.map(r=>r.name.length*labelSize*.6+15)))+(data.appearance?.ylabel?25:0),right=20,top=15,bottom=55+(data.appearance?.xlabel?25:0);
    const width=Math.max(container.clientWidth,left+count*18+right),height=top+model.rows.length*data.row_height+bottom,step=(width-left-right)/count;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});container.append(svg);addAxisTitles(svg,data,width,height);
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    model.rows.forEach((row,j)=>{
      const y=top+j*data.row_height,name=shape('text',{x:left-10,y:y+data.row_height/2+4,'text-anchor':'end',class:'row-name'},row.name);name.append(shape('title',{},row.name));svg.append(name);
      for(let i=model.start;i<=model.end;i++){
        const value=row.values[i],display=row.display[i],selected=visibleSelected.some(([name,index])=>name===row.name&&index===i),x=left+(i-model.start)*step;
        const group=shape('g',{class:`heat-cell${selected?' selected':''}`,role:value===null?'img':'button',tabindex:0,
          'aria-label':`${value===null?'Missing':'Select'} ${row.name}, ${data.x[i]}: ${fmt(value)}${state.scale==='centered'&&value!==null?`, deviation ${fmt(display)}`:''}`});
        if(value!==null)group.setAttribute('aria-pressed',String(selected));
        group.append(shape('rect',{x:x+data.cell_gap/2,y:y+data.cell_gap/2,width:Math.max(1,step-data.cell_gap),height:data.row_height-data.cell_gap,fill:heatColor(display,model.domain,data.palette,data.missing_color)}));
        if(data.show_values&&step>=35)group.append(shape('text',{x:x+step/2,y:y+data.row_height/2+4,'text-anchor':'middle',class:'cell-value'},value===null?'—':fmt(display)));
        const toggle=()=>{if(value===null)return;state.selected=selected?state.selected.filter(([name,index])=>name!==row.name||index!==i):[...state.selected,[row.name,i]];publish();};group.onclick=toggle;
        group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
        const hover=()=>{tooltip.replaceChildren(el('strong',{},row.name),el('p',{},`${data.x[i]} · ${fmt(value)}`));if(state.scale==='centered'&&value!==null)tooltip.append(el('p',{},`Deviation: ${fmt(display)} · Full-row mean: ${fmt(row.mean)}`));tooltip.hidden=false;};group.onpointerenter=hover;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=hover;group.onblur=()=>tooltip.hidden=true;svg.append(group);
      }
    });
    const stride=Math.max(1,Math.ceil(count/Math.max(2,(width-left-right)/85)));
    for(let i=model.start;i<=model.end;i++)if((i-model.start)%stride===0||i===model.end){const label=shape('text',{x:left+(i-model.start+.5)*step,y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},data.x[i].length>14?data.x[i].slice(0,13)+'…':data.x[i]);label.append(shape('title',{},data.x[i]));svg.append(label);}
    card.append(el('p',{class:'footnote'},`${state.scale==='centered'?'Colors show deviations from each subject’s full-input mean.':'Colors compare absolute values across subjects.'} Color limits and sorting use the full input, independent of visibility/window. Missing values are excluded from means. Selections outside the window are retained.`));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
