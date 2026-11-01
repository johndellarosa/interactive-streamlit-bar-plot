import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/box.js',import.meta.url),'utf8');
const {boxStats,quartileIds,boxModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const points=[1,2,3,4,100].map((value,i)=>({id:String(i),value}));
test('interpolated quartiles and Tukey whiskers identify observations beyond fences',()=>{
  const s=boxStats(points);assert.equal(s.median,3);assert.equal(s.low,1);assert.equal(s.high,4);assert.deepEqual(s.outlierIds,['4']);
  assert.equal(boxStats([]),null);assert.equal(boxStats([{id:'a',value:7}]).median,7);
  assert.equal(boxStats([{id:'a',value:0},{id:'b',value:100}],0).low,25);
});
test('quartile value intervals are disjoint and include every observation, with ties together',()=>{
  for(const sample of [points,[1,1,1,1].map((value,i)=>({id:String(i),value}))]){
    const s=boxStats(sample),ids=[0,1,2,3].flatMap(i=>quartileIds(sample,s,i));
    assert.equal(new Set(ids).size,sample.length);assert.equal(ids.length,sample.length);
  }
});
test('exclusion recomputes summaries while fixed original domains remain stable',()=>{
  const data={groups:[{name:'A',points}],whis:1.5,style:{}};
  const full=boxModel(data,{}),filtered=boxModel(data,{excluded:['4'],selected:['4','0']});
  assert.equal(filtered.rows[0].summary.median,2.5);assert.deepEqual(filtered.selected.map(p=>p.id),['0']);
  assert.deepEqual(full.domain,filtered.domain);
  assert.ok(boxModel(data,{excluded:['4'],fixed:false}).domain[1]<10);
  assert.equal(boxModel(data,{excluded:points.map(p=>p.id)}).rows[0].summary,null);
});
test('tiny scales, empty rows, and custom limits remain finite',()=>{
  const tiny=boxModel({groups:[{name:'A',points:points.map(p=>({...p,value:p.value*1e-12}))}],style:{}},{});
  assert.ok(tiny.domain[1]<1e-9);
  assert.deepEqual(boxModel({groups:[{name:'A',points:[]}],style:{}},{}).domain,[-1,1]);
});
