import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('../streamlit_net_bars/frontend/chart.js', import.meta.url), 'utf8');
const {axisExtent, formatValue} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const series = [{name:'Income',values:[100,80]}, {name:'Costs',values:[-60,-90]}];

test('fixed axis remains identical for every visibility selection in both modes', () => {
  for (const cumulative of [false,true]) {
    const original = axisExtent(series, new Set(), cumulative, true);
    for (const hidden of [['Income'],['Costs'],['Income','Costs']]) {
      assert.equal(axisExtent(series, new Set(hidden), cumulative, true), original);
    }
  }
});

test('automatic axis shrinks but keeps the original reference in view', () => {
  const fixed = axisExtent(series, new Set(['Income']), false, true);
  const automatic = axisExtent(series, new Set(['Income']), false, false);
  assert.ok(automatic < fixed);
  assert.ok(automatic >= 90);
  assert.ok(axisExtent(series, new Set(['Income','Costs']), false, false) >= 40);
});

test('cumulative fixed domain includes filtered nets larger than the original', () => {
  const scale = axisExtent(series, new Set(), true, true);
  assert.ok(scale >= 180); // Income alone, versus original cumulative net of 30.
  assert.ok(scale >= 150); // Costs alone.
});

test('signed, changing contributions remain bounded for every subset', () => {
  const mixed = [{name:'A',values:[100,-200,300]}, {name:'B',values:[-50,100,-400]}];
  const fixed = axisExtent(mixed, new Set(), true, true);
  for (const hidden of [[],['A'],['B'],['A','B']]) {
    assert.equal(axisExtent(mixed, new Set(hidden), true, true), fixed);
    assert.ok(axisExtent(mixed, new Set(hidden), true, false) <= fixed);
  }
});

test('axis follows the data magnitude for tiny and large values in every mode', () => {
  for (const factor of [1e-12, 1e-6, .01, 1e6, 1e12]) {
    const scaled = series.map(s => ({name:s.name, values:s.values.map(v=>v*factor)}));
    for (const cumulative of [false,true]) for (const fixed of [false,true]) {
      const hidden = new Set(['Costs']);
      const expected = axisExtent(series,hidden,cumulative,fixed)*factor;
      assert.ok(Math.abs(axisExtent(scaled,hidden,cumulative,fixed)-expected) <= expected*1e-12);
    }
  }
});

test('all-zero data retains a finite nonzero fallback domain', () => {
  assert.equal(axisExtent([{name:'Zero',values:[0,0]}],new Set(),false,true),1);
});

test('small axis labels and tooltip values stay nonzero and distinct', () => {
  const values = [-1.12e-6,-5.6e-7,0,5.6e-7,1.12e-6];
  const labels = values.map(v=>formatValue(v,5.6e-7));
  assert.equal(new Set(labels).size,5);
  assert.equal(labels[2],'0');
  assert.match(formatValue(1e-6),/1e-6/);
  assert.match(formatValue(-1e-12),/-1e-12/);
  assert.equal(formatValue(-0),'0');
  assert.equal(formatValue(-1e-22,1e-6),'0');
  assert.equal(formatValue(.00123456), '0.00123456');
});

test('large labels and zoomed large offsets remain distinguishable', () => {
  assert.match(formatValue(1e12), /1e\+?12/);
  const labels = Array.from({length:5},(_,i)=>formatValue(1e9+i*.001,.001));
  assert.equal(new Set(labels).size,5);
});

