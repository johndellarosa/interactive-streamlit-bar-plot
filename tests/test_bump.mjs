import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/bump.js',import.meta.url),'utf8');
const {bumpModel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={series:[{name:'A',values:[10,1]},{name:'B',values:[10,3]},{name:'C',values:[5,2]}]};
test('competition ranks handle ties and reverse direction',()=>{
  assert.deepEqual(bumpModel(data,{}).rows.map(r=>r.ranks),[[1,3],[1,1],[3,2]]);
  assert.deepEqual(bumpModel(data,{higher:false}).rows.map(r=>r.ranks),[[2,1],[2,3],[1,2]]);
});
test('hiding competitors never changes ranks or domains',()=>{
  const full=bumpModel(data,{}),filtered=bumpModel(data,{hidden:['B']});
  assert.deepEqual(filtered.rows[0].ranks,full.rows[0].ranks);
  assert.deepEqual(filtered.valueDomain,full.valueDomain);assert.equal(filtered.rankMax,3);
  assert.equal(bumpModel(data,{hidden:['A','B','C']}).rows.length,0);
});
test('one competitor, constant scores and tiny magnitudes retain finite geometry',()=>{
  const model=bumpModel({series:[{name:'A',values:[0]}]},{});
  assert.deepEqual(model.rows[0].ranks,[1]);assert.deepEqual(model.valueDomain,[-1,1]);
  const tiny=bumpModel({series:data.series.map(r=>({...r,values:r.values.map(v=>v*1e-12)}))},{});
  assert.deepEqual(tiny.rows.map(r=>r.ranks),bumpModel(data,{}).rows.map(r=>r.ranks));
  assert.ok(tiny.valueDomain[1]<1e-9);
});
