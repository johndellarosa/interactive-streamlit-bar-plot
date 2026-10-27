import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/paired_change.js',import.meta.url),'utf8');
const {pairedModel,summarizePairs}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={rows:[
  {id:'A',group:'North',before:10,after:14,change:4},
  {id:'B',group:'North',before:15,after:13,change:-2},
  {id:'C',group:'South',before:20,after:25,change:5},
  {id:'D',group:'South',before:12,after:12,change:0},
]};
test('summaries describe within-pair differences',()=>{
  assert.deepEqual(summarizePairs(data.rows),{count:4,mean_change:1.75,median_change:2,increased:2,decreased:1,unchanged:1});
  assert.equal(summarizePairs([]).median_change,null);
});
test('histogram preserves every pair and selection links by stable ID',()=>{
  const model=pairedModel(data,{selected:['A','C'],bins:5});
  assert.equal(model.bins.reduce((n,b)=>n+b.rows.length,0),4);
  assert.deepEqual(model.selected.map(r=>r.id),['A','C']);
  assert.equal(model.selectedSummary.mean_change,4.5);
});
test('filters and exclusion remove whole pairs without changing domains',()=>{
  const full=pairedModel(data,{});
  const filtered=pairedModel(data,{hidden_groups:['South'],excluded:['B'],selected:['B','A']});
  assert.deepEqual(filtered.rows.map(r=>r.id),['A']);
  assert.deepEqual(filtered.selected.map(r=>r.id),['A']);
  assert.deepEqual(filtered.valueDomain,full.valueDomain);
  assert.deepEqual(filtered.changeDomain,full.changeDomain);
  assert.deepEqual(pairedModel(data,{direction:'unchanged'}).rows.map(r=>r.id),['D']);
  assert.equal(pairedModel(data,{hidden_groups:['North','South']}).rows.length,0);
});
test('tiny values and constant pairs retain finite useful scales',()=>{
  const tiny=pairedModel({rows:data.rows.map(r=>({...r,before:r.before*1e-12,after:r.after*1e-12,change:r.change*1e-12}))},{});
  assert.ok(tiny.valueDomain[1]<1e-9);
  assert.ok(tiny.changeDomain[0]<0 && tiny.changeDomain[1]>0);
  const zero=pairedModel({rows:[{id:'A',group:'One',before:0,after:0,change:0}]},{});
  assert.deepEqual(zero.valueDomain,[-1,1]);
  assert.equal(zero.bins.reduce((n,b)=>n+b.rows.length,0),1);
});
