import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/raincloud.js',import.meta.url),'utf8');
const {quantile,distribution,density,raincloudModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('quartiles interpolate and Tukey whiskers exclude distant outliers',()=>{
  assert.equal(quantile([1,2,3,4],.25),1.75);
  const s=distribution([1,2,3,4,100]);assert.equal(s.median,3);assert.equal(s.high,4);assert.equal(s.low,1);
  assert.equal(distribution([]),null);
});
test('density is finite, equal peak and invariant to measurement magnitude',()=>{
  const a=density([1,2,3,5],[0,6]),b=density([1e-12,2e-12,3e-12,5e-12],[0,6e-12]);
  assert.equal(a.length,161);assert.equal(Math.max(...a.map(p=>p[1])),1);
  a.forEach((p,i)=>assert.ok(Math.abs(p[1]-b[i][1])<1e-12));
  assert.deepEqual(density([1,1],[0,2]),[]);assert.deepEqual(density([1],[0,2]),[]);
  assert.notDeepEqual(a,density([1,2,3,5],[0,6],2));
});
test('visibility preserves full-input domain and selected IDs stay in visible groups',()=>{
  const data={groups:[{name:'A',points:[{id:'a',value:1}]},{name:'B',points:[{id:'b',value:10}]}]};
  const full=raincloudModel(data,{}),filtered=raincloudModel(data,{hidden:['B'],selected:['a','b']});
  assert.deepEqual(full.domain,filtered.domain);assert.deepEqual(filtered.selected.map(p=>p.id),['a']);
  assert.equal(raincloudModel(data,{hidden:['A','B']}).rows.length,0);
  assert.deepEqual(raincloudModel({groups:[{name:'Empty',points:[]}]},{}).domain,[-1,1]);
});
test('custom group order and axis limits preserve underlying observations and summaries',()=>{
  const data={groups:[{name:'A',points:[{id:'a',value:1}]},{name:'B',points:[{id:'b',value:10}]}],
    style:{group_order:['B','A'],xlim:[3,7]}};
  const model=raincloudModel(data,{selected:['b']});
  assert.deepEqual(model.domain,[3,7]);assert.deepEqual(model.rows.map(r=>r.name),['B','A']);
  assert.equal(model.rows[0].summary.median,10);assert.equal(model.selected.length,1);
});
