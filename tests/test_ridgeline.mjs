import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/distribution.js',import.meta.url),'utf8')+
  await readFile(new URL('../streamlit_net_bars/frontend/ridgeline.js',import.meta.url),'utf8');
const {ridgelineModel,density}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={groups:[{name:'A',points:[1,2,3].map((value,i)=>({id:'a'+i,value}))},
  {name:'B',points:[3,4,5].map((value,i)=>({id:'b'+i,value}))},{name:'Empty',points:[]}],style:{}};
test('group and range selections intersect; range-only searches all visible groups',()=>{
  assert.equal(ridgelineModel(data,{}).points.length,0);
  assert.equal(ridgelineModel(data,{selected:['A']}).points.length,3);
  assert.deepEqual(ridgelineModel(data,{selected:['A'],range:[2,4]}).points.map(p=>p.id),['a1','a2']);
  assert.equal(ridgelineModel(data,{range:[2,4]}).points.length,4);
});
test('hidden groups and sorting preserve full-input axes; empty groups sort last',()=>{
  const full=ridgelineModel(data,{}),hidden=ridgelineModel(data,{hidden:['B'],range:[0,10]});
  assert.deepEqual(full.domain,hidden.domain);assert.equal(hidden.points.length,3);
  assert.deepEqual(ridgelineModel(data,{sort:'median'}).rows.map(r=>r.name),['B','A','Empty']);
});
test('shared density functions support tiny scales and constant groups',()=>{
  assert.deepEqual(density([2,2],[0,4]),[]);
  const a=density([1,2,3],[0,4]),b=density([1e-12,2e-12,3e-12],[0,4e-12]);
  a.forEach((p,i)=>assert.ok(Math.abs(p[1]-b[i][1])<1e-12));
  assert.deepEqual(ridgelineModel({groups:[{name:'Empty',points:[]}],style:{}},{}).domain,[-1,1]);
});
