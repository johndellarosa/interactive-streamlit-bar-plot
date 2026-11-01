import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/waterfall.js',import.meta.url),'utf8');
const {waterfallModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={start:100,rows:[{id:'a',label:'A',value:50},{id:'b',label:'B',value:-80},{id:'c',label:'C',value:10}],show_reference:true};
test('signed contributions build running totals; exclusion recomputes subsequent steps',()=>{
  const full=waterfallModel(data,{});
  assert.deepEqual(full.rows.map(r=>[r.start,r.end]),[[100,150],[150,70],[70,80]]);
  const filtered=waterfallModel(data,{excluded:['b'],selected:['a','b']});
  assert.equal(filtered.total,160);assert.equal(filtered.original,80);
  assert.deepEqual(filtered.rows.map(r=>[r.start,r.end]),[[100,150],[150,160]]);
  assert.deepEqual(filtered.selected.map(r=>r.id),['a']);
});
test('fixed domains cover every subset even when removal creates a higher total',()=>{
  const full=waterfallModel(data,{});
  for(let mask=0;mask<8;mask++){
    const excluded=data.rows.filter((r,i)=>mask&(1<<i)).map(r=>r.id),model=waterfallModel(data,{excluded});
    assert.deepEqual(model.domain,full.domain);
    model.rows.forEach(r=>{assert.ok(r.start>=model.domain[0]&&r.end>=model.domain[0]);assert.ok(r.start<=model.domain[1]&&r.end<=model.domain[1]);});
  }
});
test('zero crossings, all-excluded and zero-only input remain finite',()=>{
  const crossing=waterfallModel({start:10,rows:[{id:'a',value:-30},{id:'b',value:50}]},{});
  assert.deepEqual(crossing.rows.map(r=>r.end),[-20,30]);
  assert.equal(waterfallModel(data,{excluded:['a','b','c']}).total,100);
  assert.deepEqual(waterfallModel({start:0,rows:[]},{}).domain,[0,1]);
});
test('tiny magnitudes and explicit limits preserve values and semantics',()=>{
  const tiny=waterfallModel({...data,start:1e-10,rows:data.rows.map(r=>({...r,value:r.value*1e-12}))},{});
  assert.ok(tiny.domain[1]<1e-8);
  assert.deepEqual(waterfallModel({...data,ylim:[20,120]},{}).domain,[20,120]);
  assert.ok(waterfallModel(data,{excluded:['a','c'],fixed:false}).domain[1]<waterfallModel(data,{}).domain[1]);
});
const structured={...data,has_scenario:true,scenario_start:110,
  rows:data.rows.map((r,i)=>({...r,scenario_value:[70,-60,20][i]})),
  groups:[{name:'Operations',ids:['a','b']}],subtotals:{b:'Operating subtotal'}};
test('collapse groups changes display only; checkpoint is not an extra contribution',()=>{
  const expanded=waterfallModel(structured,{}),collapsed=waterfallModel(structured,{collapsed:['Operations']});
  assert.equal(collapsed.total,80);assert.equal(collapsed.scenarioTotal,140);
  assert.equal(collapsed.display[0].value,-30);assert.deepEqual(collapsed.display[0].ids,['a','b']);
  assert.equal(collapsed.display[1].kind,'subtotal');assert.equal(collapsed.display[1].end,70);
  assert.deepEqual(collapsed.checkpoints,expanded.checkpoints);
  assert.equal(collapsed.total,expanded.total);assert.equal(collapsed.scenarioTotal,expanded.scenarioTotal);
});
test('shared exclusions apply to both scenarios; excluded anchors still emit checkpoints',()=>{
  const model=waterfallModel(structured,{excluded:['b'],collapsed:['Operations']});
  assert.equal(model.total,160);assert.equal(model.scenarioTotal,200);
  assert.equal(model.original,80);assert.equal(model.originalScenario,140);
  assert.deepEqual(model.display[0].ids,['a']);assert.equal(model.checkpoints[0].total,150);
  assert.equal(model.checkpoints[0].scenario_total,180);
  const allExcluded=waterfallModel(structured,{excluded:['a','b','c'],collapsed:['Operations']});
  assert.equal(allExcluded.checkpoints[0].total,100);assert.equal(allExcluded.scenarioTotal,110);
});
test('fixed axes cover all subsets in both scenarios and do not change with display view',()=>{
  const full=waterfallModel(structured,{});
  for(let mask=0;mask<8;mask++)for(const view of ['baseline','scenario','comparison']){
    const excluded=data.rows.filter((r,i)=>mask&(1<<i)).map(r=>r.id),model=waterfallModel(structured,{excluded,view,collapsed:['Operations']});
    assert.deepEqual(model.domain,full.domain);
    model.bars.forEach(r=>[r.start,r.end,r.scenario_start,r.scenario_end].forEach(v=>assert.ok(v>=model.domain[0]&&v<=model.domain[1])));
  }
});
