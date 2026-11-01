export function stateTransitions(values) {
  return values.slice(1).flatMap((v,i)=>v!==null&&values[i]!==null&&v!==values[i]?[[values[i],v]]:[]);
}
export function sequenceRuns(values,start,end) {
  const runs=[];for(let i=start;i<=end;i++){const last=runs.at(-1);if(last&&last.state===values[i])last.end=i;else runs.push({state:values[i],start:i,end:i});}return runs;
}
export function sequenceModel(data,state) {
  const start=Math.max(0,Math.min(data.x.length-1,state.start??0)),end=Math.max(start,Math.min(data.x.length-1,state.end??data.x.length-1));
  const all=data.rows.map(r=>({...r,transitions:stateTransitions(r.values)}));
  const rows=all.filter(r=>(!state.contains||r.values.includes(state.contains))&&(!state.transition||r.transitions.some(t=>t[0]===state.transition[0]&&t[1]===state.transition[1])));
  if(state.sort==='transitions')rows.sort((a,b)=>b.transitions.length-a.transitions.length);
  if(state.sort==='sequence')rows.sort((a,b)=>{for(let i=0;i<a.values.length;i++){const rank=v=>v===null?data.states.length:data.states.indexOf(v),d=rank(a.values[i])-rank(b.values[i]);if(d)return d;}return 0;});
  const options=[...new Map(all.flatMap(r=>r.transitions).map(t=>[JSON.stringify(t),t])).values()];
  return {rows,start,end,options,selected:rows.filter(r=>(state.selected||[]).includes(r.name))};
}
export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.sequence');
  let state={...data.selection,selected:[...data.selection.selected]};
  const ns='http://www.w3.org/2000/svg',palette=['#4b80b6','#56a69a','#d5a357','#a092bc','#c77e88','#7594a4','#8a9e57','#b38057'];
  const color=v=>v===null?data.missing_color:data.colors[v]||palette[data.states.indexOf(v)%palette.length];
  const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const shape=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const publish=()=>{draw();setStateValue('selection',{...state});};
  function draw() {
    const model=sequenceModel(data,state);root.replaceChildren();const card=el('section',{class:'sequence-card'});root.append(card);
    card.append(el('p',{class:'eyebrow'},'Categorical trajectory explorer'),el('h3',{},data.title),el('p',{class:'intro'},'Each row follows one subject through categorical states. Click a run to inspect a period and select its subject; repeated states form continuous blocks.'));
    const legend=el('div',{class:'legend'});for(const value of data.states){const b=el('button',{type:'button','aria-pressed':String(state.contains===value),'aria-label':`Filter state ${value}`}),swatch=el('i');swatch.style.background=color(value);b.append(swatch,document.createTextNode(value));b.onclick=()=>{state.contains=state.contains===value?null:value;publish();};legend.append(b);}const missing=el('span'),swatch=el('i');swatch.style.background=data.missing_color;missing.append(swatch,document.createTextNode('Missing'));legend.append(missing);card.append(legend);
    const controls=el('div',{class:'controls'}),select=(label,key,options)=>{const wrap=el('label',{},label),input=el('select',{'aria-label':label});for(const[value,text]of options)input.append(el('option',{value},text));input.value=key==='transition'?(state.transition?JSON.stringify(state.transition):''):String(state[key]??'');input.onchange=()=>{state[key]=key==='transition'?(input.value?JSON.parse(input.value):null):key==='start'||key==='end'?Number(input.value):input.value||null;if(state.start>state.end){if(key==='start')state.end=state.start;else state.start=state.end;}publish();};wrap.append(input);controls.append(wrap);};
    select('Contains state','contains',[['','All states'],...data.states.map(v=>[v,v])]);
    select('Contains transition','transition',[['','Any transition'],...model.options.map(t=>[JSON.stringify(t),`${t[0]} → ${t[1]}`])]);
    select('Sort subjects','sort',[['input','Input order'],['transitions','Most transitions'],['sequence','State sequence']]);
    const periods=data.x.map((p,i)=>[i,p]);select('From','start',periods);select('To','end',periods);
    const clear=el('button',{type:'button'},'Clear selection');clear.disabled=!state.selected.length;clear.onclick=()=>{state.selected=[];state.inspect=null;publish();};controls.append(clear);
    const reset=el('button',{type:'button'},'Reset filters');reset.onclick=()=>{state.contains=null;state.transition=null;state.start=0;state.end=data.x.length-1;publish();};controls.append(reset);card.append(controls);
    card.append(el('p',{class:'selection','aria-live':'polite'},`${model.rows.length} / ${data.rows.length} subjects visible · ${model.selected.length} selected · ${model.end-model.start+1} periods`));
    if(!model.rows.length){card.append(el('p',{class:'empty',role:'status'},'No subjects match. Reset filters to restore the view.'));return;}
    const plot=el('div',{class:'plot'});card.append(plot);const count=model.end-model.start+1,labelSize=data.appearance?.label_fontsize||12,left=Math.min(220,Math.max(110,...data.rows.map(r=>r.name.length*labelSize*.6+18)))+(data.appearance?.ylabel?25:0),right=20,top=15,bottom=55+(data.appearance?.xlabel?25:0),width=Math.max(plot.clientWidth,left+right+count*20),height=top+model.rows.length*data.row_height+bottom,step=(width-left-right)/count;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':data.title});plot.append(svg);addAxisTitles(svg,data,width,height);
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const toggle=(name)=>{state.selected=state.selected.includes(name)?state.selected.filter(n=>n!==name):[...state.selected,name];publish();};
    model.rows.forEach((row,j)=>{
      const y=top+j*data.row_height,selected=state.selected.includes(row.name),label=shape('text',{x:left-10,y:y+data.row_height/2+4,'text-anchor':'end',class:'row-name',role:'button',tabindex:0,'aria-label':`Select subject ${row.name}`,'aria-pressed':String(selected)},row.name);label.onclick=()=>toggle(row.name);label.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(row.name);}};svg.append(label);
      sequenceRuns(row.values,model.start,model.end).forEach(run=>{
        const x=left+(run.start-model.start)*step,w=(run.end-run.start+1)*step,group=shape('g',{class:`state-run${selected?' selected':''}`,role:'button',tabindex:0,'aria-pressed':String(selected),'aria-label':`Select ${row.name}: ${run.state??'Missing'}, ${data.x[run.start]} to ${data.x[run.end]}`});
        group.append(shape('rect',{x:x+data.cell_gap/2,y:y+data.cell_gap/2,width:Math.max(1,w-data.cell_gap),height:data.row_height-data.cell_gap,fill:color(run.state)}));
        if(data.show_labels&&w>45)group.append(shape('text',{x:x+w/2,y:y+data.row_height/2+4,'text-anchor':'middle',class:'state-label'},run.state??'—'));
        const inspect=event=>{const bounds=svg.getBoundingClientRect(),local=event?.clientX===undefined?x:(event.clientX-bounds.x)*width/bounds.width;return Math.max(run.start,Math.min(run.end,model.start+Math.floor((local-left)/step)));};
        group.onclick=e=>{state.inspect=[row.name,inspect(e)];toggle(row.name);};group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();state.inspect=[row.name,run.start];toggle(row.name);}};
        const show=e=>{const i=inspect(e);tooltip.replaceChildren(el('strong',{},row.name),el('p',{},`${data.x[i]} · ${row.values[i]??'Missing'}`),el('p',{},`Run: ${data.x[run.start]}–${data.x[run.end]} · ${row.transitions.length} full-sequence transitions`));tooltip.hidden=false;const bounds=card.getBoundingClientRect(),rect=group.getBoundingClientRect();tooltip.style.top=`${Math.max(8,rect.y-bounds.y+15)}px`;};group.onpointermove=show;group.onpointerleave=()=>tooltip.hidden=true;group.onfocus=()=>show();group.onblur=()=>tooltip.hidden=true;svg.append(group);
      });
    });
    const stride=Math.max(1,Math.ceil(count/Math.max(2,(width-left-right)/85)));for(let i=model.start;i<=model.end;i++)if((i-model.start)%stride===0||i===model.end){const label=shape('text',{x:left+(i-model.start+.5)*step,y:height-bottom+25,'text-anchor':'middle',class:'axis-label'},data.x[i].length>14?data.x[i].slice(0,13)+'…':data.x[i]);label.append(shape('title',{},data.x[i]));svg.append(label);}
    card.append(el('p',{class:'footnote'},'Filters and sorting use full sequences · Missing observations break transitions; repeated states do not count as transitions · Equal period spacing in input order · Filtered-out subject selections are retained internally'));
  }
  draw();let width=root.clientWidth,frame;const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});observer.observe(root);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
