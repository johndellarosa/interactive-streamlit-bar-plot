import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/histogram.js',import.meta.url),'utf8');
const {histogramModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={groups:[{name:'A',points:[0,1,2,3,4].map((value,i)=>({id:String(i),value}))}]};
test('shared bins include minimum, internal edges, and maximum exactly once',()=>{
  const model=histogramModel(data,{bins:4});
  assert.deepEqual(model.bins.map(b=>b.points.length),[1,1,1,2]);
  assert.equal(model.bins.flatMap(b=>b.points).length,5);
});
test('percentage and density normalize across groups',()=>{
  const percent=histogramModel(data,{bins:4,normalization:'percent'});
  assert.equal(percent.bins.reduce((s,b)=>s+b.value,0),100);
  const density=histogramModel(data,{bins:2,normalization:'density'});
  assert.equal(density.bins.reduce((s,b)=>s+b.value*(b.high-b.low),0),1);
});
test('exclusion preserves full-input bins, baseline and selected identities through rebinning',()=>{
  const model=histogramModel(data,{bins:2,excluded:['4'],selected:['1','4']});
  assert.deepEqual(model.domain,[0,4]);assert.deepEqual(model.selected.map(p=>p.id),['1']);
  assert.equal(model.bins.flatMap(b=>b.baseline).length,5);assert.equal(model.visible.length,4);
  assert.deepEqual(histogramModel(data,{bins:10,selected:['1']}).selected.map(p=>p.id),['1']);
});
test('hidden groups, constant/empty values, and tiny scales stay finite',()=>{
  assert.equal(histogramModel(data,{bins:2,hidden:['A']}).visible.length,0);
  assert.deepEqual(histogramModel({groups:[{name:'A',points:[]}]},{bins:2}).domain,[0,1]);
  const constant=histogramModel({groups:[{name:'A',points:[{id:'a',value:0}]}]},{bins:2});
  assert.equal(constant.bins.flatMap(b=>b.points).length,1);
  const tiny=histogramModel({groups:[{name:'A',points:data.groups[0].points.map(p=>({...p,value:p.value*1e-12}))}]},{bins:4,normalization:'density'});
  assert.ok(Math.abs(tiny.bins.reduce((s,b)=>s+b.value*(b.high-b.low),0)-1)<1e-12);
});
