import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/upset.js',import.meta.url),'utf8');
const {upsetModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={max_intersections:2,intersections:[
  {key:'10',sets:['A'],degree:1,count:3,ids:['1','2','3']},
  {key:'11',sets:['A','B'],degree:2,count:2,ids:['4','5']},
  {key:'00',sets:[],degree:0,count:1,ids:['6']},
]};
test('sorting and column cap preserve complete matching counts',()=>{
  const model=upsetModel(data,{});
  assert.equal(model.matched,6);assert.equal(model.shown.length,2);assert.equal(model.rows.length,3);
  assert.equal(upsetModel(data,{sort:'degree'}).shown[0].key,'11');
});
test('required and excluded sets constrain exact memberships',()=>{
  assert.deepEqual(upsetModel(data,{required:['A'],excluded:['B']}).rows.map(r=>r.key),['10']);
  assert.equal(upsetModel(data,{required:['B'],excluded:['A']}).rows.length,0);
  assert.deepEqual(upsetModel(data,{min_count:3}).rows.map(r=>r.key),['10']);
});
test('multi-selection returns distinct IDs including selected columns outside display cap',()=>{
  assert.deepEqual(upsetModel(data,{selected:['11','00']}).selectedIds,['4','5','6']);
  assert.deepEqual(upsetModel(data,{selected:['11'],excluded:['B']}).selectedIds,[]);
});
test('empty inputs and all-filtered results are supported',()=>{
  assert.equal(upsetModel({intersections:[]},{}).matched,0);
  assert.equal(upsetModel(data,{min_count:100}).shown.length,0);
});
