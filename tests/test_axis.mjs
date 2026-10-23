import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('../streamlit_net_bars/frontend/chart.js', import.meta.url), 'utf8');
const {axisExtent} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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

