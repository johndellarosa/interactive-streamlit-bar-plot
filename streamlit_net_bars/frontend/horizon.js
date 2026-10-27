export function horizonModel(data, settings) {
  const bands=Math.max(2,Math.min(5,Number(settings.bands)||3));
  const start=Math.max(0,Math.min(data.x.length-1,Number(settings.start)||0));
  const end=Math.max(start,Math.min(data.x.length-1,settings.end ?? data.x.length-1));
  const rows=data.series.map((s,index)=>{
    const base=settings.baseline==='first'?s.values[0]:settings.baseline==='mean'?
      s.values.reduce((sum,v)=>sum+v/s.values.length,0):0;
    const deviations=s.values.map(v=>v-base);
    return {...s,index,base,deviations,peak:Math.max(...deviations.map(Math.abs))};
  });
  const sharedPeak=Math.max(...rows.map(s=>s.peak));
  const visible=rows.filter(s=>!(settings.hidden || []).includes(s.name));
  visible.forEach(s=>{s.bandWidth=(settings.scale==='individual'?s.peak:sharedPeak)/bands;});
  if(settings.sort==='latest') visible.sort((a,b)=>b.deviations[end]-a.deviations[end] || a.index-b.index);
  if(settings.sort==='variation') visible.sort((a,b)=>{
    const spread=s=>Math.max(...s.values.slice(start,end+1))-Math.min(...s.values.slice(start,end+1));
    return spread(b)-spread(a) || a.index-b.index;
  });
  return {rows:visible,bands,start,end,sharedPeak};
}

// Include each band/sign crossing before folding. This avoids inventing a
// colored bridge between samples on opposite sides of the baseline.
export function foldBand(values, bandWidth, bandIndex, sign) {
  const level=v=>bandWidth?Math.max(0,Math.min(1,sign*v/bandWidth-bandIndex)):0;
  if(values.length===1) return [[0,level(values[0])],[1,level(values[0])]];
  const points=[];
  values.forEach((v,i)=>{
    if(i) {
      const previous=values[i-1];
      const cuts=[sign*bandIndex*bandWidth,sign*(bandIndex+1)*bandWidth];
      const fractions=cuts.map(c=>(c-previous)/(v-previous)).filter(f=>f>0 && f<1).sort((a,b)=>a-b);
      fractions.forEach(f=>points.push([i-1+f,level(previous+(v-previous)*f)]));
    }
    points.push([i,level(v)]);
  });
  return points;
}

export default function(component) {
  const {parentElement,data,setStateValue}=component;
  const root=parentElement.querySelector('.horizon');
  const style=data.plot_style || {};
  let settings={...data.selection,hidden:[...(data.selection.hidden || [])]};
  const blue=style.positive_colors || ['#dceaf5','#b2d0e8','#79afd4','#457fab','#245678'];
  const orange=style.negative_colors || ['#f7e5d7','#edc3a7','#dd9775','#bb6b49','#8f432e'];
  const colors=(ramp,bands)=>Array.from({length:bands},(_,i)=>ramp[Math.round(i*4/(bands-1))]);
  const ns='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},text)=>{
    const node=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
    if(text!==undefined)node.textContent=text;return node;
  };
  const shape=(tag,attrs={},text)=>{
    const node=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
    if(text!==undefined)node.textContent=text;return node;
  };
  const format=v=>new Intl.NumberFormat(undefined,{maximumSignificantDigits:4,
    notation:v!==0 && (Math.abs(v)<1e-4 || Math.abs(v)>=1e7)?'scientific':'standard'}).format(Object.is(v,-0)?0:v);
  const publish=()=>{draw();setStateValue('selection',{...settings,hidden:[...settings.hidden]});};
  const toggle=name=>{const hidden=new Set(settings.hidden);hidden.has(name)?hidden.delete(name):hidden.add(name);settings.hidden=[...hidden];publish();};
  function draw() {
    root.replaceChildren();
    const card=el('section',{class:'horizon-card'});root.append(card);
    const heading=el('div',{class:'heading'}),title=el('div');
    title.append(el('p',{class:'eyebrow'},'Time-series explorer'),el('h3',{},data.title));
    const showAll=el('button',{type:'button'},'Show all');showAll.disabled=!settings.hidden.length;
    showAll.onclick=()=>{settings.hidden=[];publish();};heading.append(title,showAll);card.append(heading);
    card.append(el('p',{class:'intro'},'Blue = above baseline. Orange = below. Darker bands indicate larger deviations. Click a row to expand its line view.'));
    const filters=el('div',{class:'filters',role:'group','aria-label':'Series visibility'});
    data.series.forEach(s=>{
      const hidden=settings.hidden.includes(s.name);
      const button=el('button',{type:'button','aria-pressed':String(!hidden),'aria-label':`${hidden?'Show':'Hide'} ${s.name}`},s.name);
      button.onclick=()=>toggle(s.name);filters.append(button);
    });card.append(filters);
    const controls=el('div',{class:'controls'});
    const select=(label,key,options)=>{
      const wrapper=el('label',{},label),input=el('select',{'aria-label':label});
      options.forEach(([value,text])=>input.append(el('option',{value},text)));
      input.value=String(settings[key]);input.onchange=()=>{
        settings[key]=['bands','start','end'].includes(key)?Number(input.value):input.value;
        if(key==='start' && settings.start>settings.end)settings.end=settings.start;
        if(key==='end' && settings.end<settings.start)settings.start=settings.end;
        publish();
      };wrapper.append(input);controls.append(wrapper);
    };
    select('Baseline','baseline',[['zero','Zero'],['mean','Series mean'],['first','First value']]);
    select('Bands','bands',[[2,'2 bands'],[3,'3 bands'],[4,'4 bands'],[5,'5 bands']]);
    select('Scale','scale',[['shared','Shared across series'],['individual','Each series independently']]);
    select('Order','sort',[['input','Input order'],['latest','Latest deviation'],['variation','Largest variation']]);
    card.append(controls);
    const windowControls=el('div',{class:'window-controls'});
    // Reuse the select builder, then move window controls onto their own line.
    select('From','start',data.x.map((name,i)=>[i,name]));windowControls.append(controls.lastChild);
    select('To','end',data.x.map((name,i)=>[i,name]));windowControls.append(controls.lastChild);
    const reset=el('button',{type:'button'},'Full range');reset.disabled=settings.start===0 && settings.end===data.x.length-1;
    reset.onclick=()=>{settings.start=0;settings.end=data.x.length-1;publish();};windowControls.append(reset);card.append(windowControls);
    const model=horizonModel(data,settings),positive=colors(blue,model.bands),negative=colors(orange,model.bands);
    const legend=el('div',{class:'legend'});
    for(const [label,ramp] of [['Below baseline',negative],['Above baseline',positive]]) {
      const key=el('span',{class:'color-key'});key.append(el('span',{},label));
      ramp.forEach(color=>{const swatch=el('span',{class:'swatch'});swatch.style.background=color;key.append(swatch);});legend.append(key);
    }
    const step=model.sharedPeak/model.bands;
    legend.append(el('span',{class:'legend-note'},settings.scale==='individual'?'Band width varies by row; inspect a point for its scale.':`One band = ${format(step)} deviation units · shared scale`));
    card.append(legend);
    if(!model.rows.length) {card.append(el('p',{class:'empty',role:'status'},'All series are hidden. Use Show all or the series chips to restore them.'));return;}
    const plot=el('div',{class:'plot'});card.append(plot);
    const width=Math.max(260,plot.clientWidth),left=width<600?112:166,right=70,top=12,gap=9,bottom=34+(data.appearance?.xlabel?24:0);
    const plotW=Math.max(40,width-left-right),count=model.end-model.start+1;
    const x=i=>left+(count===1?.5:(i-model.start)/(count-1))*plotW;
    const positions=[];let cursor=top;
    model.rows.forEach(row=>{const h=settings.expanded===row.name?data.row_height*3:data.row_height;positions.push({row,y:cursor,h});cursor+=h+gap;});
    const height=cursor+bottom;
    const svg=shape('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'group',tabindex:0,
      'aria-label':`${data.title}. Use Left and Right arrows to inspect time points; Escape clears inspection.`});plot.append(svg);

    addAxisTitles(svg,data,width,height);
    const tooltip=el('div',{class:'tooltip',role:'tooltip'});tooltip.hidden=true;card.append(tooltip);
    const overlay=shape('g',{'pointer-events':'none'});let hoverIndex=null;
    const vertical=shape('line',{class:'crosshair',y1:top,y2:cursor-gap,visibility:'hidden'});overlay.append(vertical);
    positions.forEach(({row,y,h})=>{
      const expanded=settings.expanded===row.name;
      const rowGroup=shape('g',{role:'button',tabindex:0,'aria-expanded':String(expanded),
        'aria-label':`${expanded?'Collapse':'Expand'} ${row.name}`});
      const expand=()=>{settings.expanded=expanded?null:row.name;publish();};
      rowGroup.onclick=expand;rowGroup.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();expand();}};
      rowGroup.append(shape('rect',{x:left,y,width:plotW,height:h,rx:3,class:'row-background'}));
      const available=Math.floor((left-20)/6.5),label=row.name.length>available?row.name.slice(0,available-1)+'…':row.name;
      const name=shape('text',{x:data.appearance?.ylabel?30:4,y:y+h/2+4,class:'row-name'},label);name.append(shape('title',{},row.name));rowGroup.append(name);
      const last=row.deviations[model.end];
      rowGroup.append(shape('text',{x:width-3,y:y+h/2+4,'text-anchor':'end',class:last<0?'negative-value':'positive-value'},`${last>0?'+':''}${format(last)}`));
      const values=row.deviations.slice(model.start,model.end+1);
      if(expanded) {
        const peak=(settings.scale==='individual'?row.peak:model.sharedPeak)||1;
        rowGroup.append(shape('line',{x1:left,x2:left+plotW,y1:y+h/2,y2:y+h/2,class:'detail-zero'}));
        const points=values.map((v,i)=>`${x(model.start+i)},${y+h/2-v/peak*h*.46}`).join(' ');
        rowGroup.append(shape('polyline',{points,class:'detail-line'}));
        rowGroup.append(shape('text',{x:left+5,y:y+12,class:'detail-label'},'Line view · zero-centered deviation'));
      } else {
        for(const sign of [1,-1])for(let band=0;band<model.bands;band++) {
          const points=foldBand(values,row.bandWidth,band,sign);
          const px=index=>left+(count===1?index:index/(count-1))*plotW;
          const d=`M${left},${y+h} `+points.map(([index,level])=>`L${px(index)},${y+h-level*h}`).join(' ')+` L${left+plotW},${y+h} Z`;
          rowGroup.append(shape('path',{d,fill:(sign>0?positive:negative)[band],class:'band'}));
        }
      }
      svg.append(rowGroup);
    });
    const labels=Math.min(count,Math.max(2,Math.floor(plotW/95)));
    const indices=new Set(Array.from({length:labels},(_,i)=>model.start+Math.round(i*(count-1)/Math.max(1,labels-1))));
    indices.forEach(i=>svg.append(shape('text',{x:x(i),y:height-12-(data.appearance?.xlabel?24:0),'text-anchor':count===1?'middle':i===model.start?'start':i===model.end?'end':'middle',class:'axis-label'},data.x[i])));
    svg.append(overlay);
    const inspect=(index,event)=>{
      hoverIndex=index;vertical.setAttribute('x1',x(index));vertical.setAttribute('x2',x(index));vertical.setAttribute('visibility','visible');
      tooltip.replaceChildren(el('strong',{},data.x[index]));
      model.rows.forEach(row=>{
        const entry=el('div',{class:'tooltip-row'});entry.append(el('span',{},row.name),el('b',{},format(row.values[index])),el('span',{class:row.deviations[index]<0?'negative-value':'positive-value'},`Δ ${format(row.deviations[index])}`));tooltip.append(entry);
        if(settings.scale==='individual') tooltip.append(el('small',{},`${row.name}: band width ${format(row.bandWidth)}`));
      });
      tooltip.append(el('small',{},`Baseline: ${settings.baseline} · ${settings.scale==='shared'?`band width ${format(step)}`:'band width: each row peak ÷ band count'}`));
      tooltip.hidden=false;
      const bounds=card.getBoundingClientRect();
      tooltip.style.left=`${Math.max(8,Math.min(card.clientWidth-tooltip.offsetWidth-8,(event?.clientX??bounds.left+left)-bounds.left+15))}px`;
      tooltip.style.top=`${Math.max(8,Math.min(card.clientHeight-tooltip.offsetHeight-8,(event?.clientY??bounds.top+100)-bounds.top+15))}px`;
    };
    const clear=()=>{hoverIndex=null;tooltip.hidden=true;vertical.setAttribute('visibility','hidden');};
    svg.onpointermove=event=>{
      const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const local=point.matrixTransform(svg.getScreenCTM().inverse());
      if(local.x<left||local.x>left+plotW){clear();return;}
      inspect(model.start+Math.max(0,Math.min(count-1,Math.round((local.x-left)/plotW*(count-1)))),event);
    };
    svg.onpointerleave=clear;svg.onblur=clear;
    svg.onkeydown=event=>{
      if(event.target!==svg)return;
      if(event.key==='Escape'){clear();return;}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();inspect(Math.max(model.start,Math.min(model.end,(hoverIndex??model.start)+(event.key==='ArrowLeft'?-1:1))));
      }
    };
    card.append(el('p',{class:'footnote'},`${model.rows.length} of ${data.series.length} series · ${count} of ${data.x.length} positions · Right-hand values are deviations at ${data.x[model.end]}`));
  }
  draw();let width=root.clientWidth,frame;
  const observer=new ResizeObserver(()=>{if(Math.abs(root.clientWidth-width)<1)return;width=root.clientWidth;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);});
  observer.observe(root);return()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
