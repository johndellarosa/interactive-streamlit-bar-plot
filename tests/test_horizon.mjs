import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/horizon.js',import.meta.url),'utf8');
const {horizonModel,foldBand}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={x:['Jan','Feb','Mar'],series:[{name:'A',values:[-3,0,6]},{name:'B',values:[2,4,2]}]};

test('shared domains use all series even when one is hidden or the window changes',()=>{
  const base=horizonModel(data,{baseline:'zero',bands:3,scale:'shared'});
  assert.equal(base.sharedPeak,6);
  assert.equal(base.rows[1].bandWidth,2);
  const filtered=horizonModel(data,{baseline:'zero',bands:3,scale:'shared',hidden:['A'],start:1,end:1});
  assert.equal(filtered.rows[0].bandWidth,2);
  assert.equal(filtered.start,filtered.end);
});
test('first and mean baselines use the entire series',()=>{
  const first=horizonModel(data,{baseline:'first',bands:3});
  assert.deepEqual(first.rows[0].deviations,[0,3,9]);
  const mean=horizonModel(data,{baseline:'mean',start:1,end:1});
  assert.equal(mean.rows[0].base,1);
  assert.deepEqual(mean.rows[0].deviations,[-4,-1,5]);
});
test('individual scales, ordering and all-hidden selection',()=>{
  const individual=horizonModel(data,{scale:'individual',bands:2,sort:'latest'});
  assert.equal(individual.rows[0].name,'A');
  assert.equal(individual.rows[1].bandWidth,2);
  assert.equal(horizonModel(data,{hidden:['A','B']}).rows.length,0);
});
test('folded layers are clamped and split precisely at sign and band crossings',()=>{
  assert.deepEqual(foldBand([-2,2],1,0,1),[[0,0],[.5,0],[.75,1],[1,1]]);
  assert.deepEqual(foldBand([-2,2],1,0,-1),[[0,1],[.25,1],[.5,0],[1,0]]);
  for(const sign of [1,-1]) for(let band=0;band<3;band++) {
    for(const [,level] of foldBand([-9,9,-9],3,band,sign)) assert.ok(level>=0 && level<=1);
  }
});
test('zero and one-point series have finite geometry',()=>{
  assert.deepEqual(foldBand([0],0,0,1),[[0,0],[1,0]]);
  assert.deepEqual(foldBand([2],1,1,1),[[0,1],[1,1]]);
  assert.equal(horizonModel({x:['A'],series:[{name:'Zero',values:[0]}]},{}).rows[0].bandWidth,0);
});
test('horizon shapes are invariant to magnitude',()=>{
  const a=foldBand([-3,0,6],2,1,1);
  const b=foldBand([-3e-12,0,6e-12],2e-12,1,1);
  assert.deepEqual(a,b);
});
