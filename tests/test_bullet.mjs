import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/bullet.js',import.meta.url),'utf8');
const {bulletModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={higher:true,rows:[{name:'A',value:80,target:100,ranges:[60,80,120]},{name:'B',value:120,target:100,ranges:[60,80,140]}]};
test('target status respects direction, filtering and equality',()=>{
  assert.deepEqual(bulletModel(data,{filter:'met'}).rows.map(r=>r.name),['B']);
  assert.deepEqual(bulletModel({...data,higher:false},{filter:'met'}).rows.map(r=>r.name),['A']);
  assert.equal(bulletModel(data,{targets:{A:80}}).rows[0].met,true);
});
test('edits update gaps and domains, while full-input shared scale survives filters',()=>{
  const edited=bulletModel(data,{targets:{A:150},filter:'missed',selected:['A','B']});
  assert.equal(edited.rows[0].gap,-70);assert.equal(edited.peak,150);
  assert.deepEqual(edited.selected.map(r=>r.name),['A']);
  assert.equal(bulletModel(data,{filter:'missed'}).peak,140);
  assert.equal(bulletModel(data,{targets:{A:10}}).rows[0].original_target,100);
});
