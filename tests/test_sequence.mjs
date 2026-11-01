import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/sequence.js',import.meta.url),'utf8');
const {sequenceModel,stateTransitions,sequenceRuns}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={x:['1','2','3','4'],states:['A','B'],rows:[{name:'One',values:['A','A','B','B']},{name:'Two',values:['A',null,'B','A']},{name:'Missing',values:[null,null,null,null]}]};
test('runs merge repeated states; missing values break transitions',()=>{
  assert.deepEqual(stateTransitions(['A','A',null,'B','A']),[['B','A']]);
  assert.deepEqual(sequenceRuns(['A','A','B','B'],1,2),[{state:'A',start:1,end:1},{state:'B',start:2,end:2}]);
});
test('transition and state filters use full sequences, independently of the window',()=>{
  const model=sequenceModel(data,{transition:['A','B'],start:3,end:3,selected:['One','Two']});
  assert.deepEqual(model.rows.map(r=>r.name),['One']);assert.equal(model.selected.length,1);
  assert.deepEqual(sequenceModel(data,{contains:'B',transition:['B','A']}).rows.map(r=>r.name),['Two']);
});
test('sorting honors declared state order and keeps all-missing rows last',()=>{
  assert.deepEqual(sequenceModel(data,{sort:'sequence'}).rows.map(r=>r.name),['One','Two','Missing']);
  assert.deepEqual(sequenceModel(data,{sort:'transitions'}).rows.map(r=>r.name),['One','Two','Missing']);
  assert.equal(sequenceModel(data,{contains:'Unseen'}).rows.length,0);
});
