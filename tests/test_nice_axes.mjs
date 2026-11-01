import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/axes.js',import.meta.url),'utf8');
const {niceAxis}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('round automatic bounds contain padded data with useful intervals',()=>{
  const axis=niceAxis(-358.4,358.4);
  assert.deepEqual(axis.domain,[-400,400]);assert.deepEqual(axis.ticks,[-400,-200,0,200,400]);
  for(const [low,high] of [[0,47.3],[24.22,83.09],[-11.311,14.801],[-.17,.38]]){
    const result=niceAxis(low,high);
    assert.ok(result.domain[0]<=low && result.domain[1]>=high);
    assert.ok(result.ticks.length>=2 && result.ticks.length<=12);
    result.ticks.forEach(t=>assert.ok(Number.isFinite(t)));
  }
});
test('nice scales preserve magnitude and symmetry',()=>{
  const base=niceAxis(-358.4,358.4);
  for(const factor of [1e-12,1e-6,.01,1e6,1e12]){
    const axis=niceAxis(-358.4*factor,358.4*factor);
    assert.ok(Math.abs(axis.domain[1]-base.domain[1]*factor)<base.domain[1]*factor*1e-12);
    assert.equal(axis.domain[0],-axis.domain[1]);
  }
});
test('explicit bounds and zoom remain exact, with rounded interior ticks',()=>{
  const axis=niceAxis(1.23,4.87,5,false);
  assert.deepEqual(axis.domain,[1.23,4.87]);assert.deepEqual(axis.ticks,[2,3,4]);
  const offset=niceAxis(1e9+.13,1e9+.89,5,false);
  assert.equal(new Set(offset.ticks).size,offset.ticks.length);
});
test('counts use integer ticks and all-zero fallback remains useful',()=>{
  assert.deepEqual(niceAxis(0,1.1,5,true,1).ticks,[0,1,2]);
  assert.deepEqual(niceAxis(-1,1).ticks,[-1,-.5,0,.5,1]);
});
