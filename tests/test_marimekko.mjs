import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=await readFile(new URL('../streamlit_net_bars/frontend/marimekko.js',import.meta.url),'utf8');
const {mekkoLayout}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={x:['North','South'],series:[{name:'A',values:[30,10]},{name:'B',values:[10,50]}]};
const area=layout=>layout.columns.reduce((sum,c)=>sum+c.width*c.segments.reduce((h,s)=>h+s.height,0),0);

test('column widths, segment heights and areas encode the input proportions',()=>{
  const layout=mekkoLayout(data,{});
  assert.equal(layout.columns[0].width,.4);
  assert.equal(layout.columns[0].segments[0].height,.75);
  assert.ok(Math.abs(layout.columns[0].width*layout.columns[0].segments[0].height-.3)<1e-12);
  assert.equal(area(layout),1);
});
test('recalculation redistributes widths and heights after excluding a segment',()=>{
  const layout=mekkoLayout(data,{hidden_series:['A']});
  assert.equal(layout.visibleTotal,60);
  assert.equal(layout.columns[0].width,1/6);
  assert.equal(layout.columns[0].segments[1].height,1);
  assert.equal(layout.columns[0].segments[1].bottom,0);
  assert.equal(area(layout),1);
});
test('original totals preserve positions and encode excluded areas as gaps',()=>{
  const layout=mekkoLayout(data,{hidden_series:['A'],recalculate:false});
  assert.equal(layout.columns[0].width,.4);
  assert.equal(layout.columns[0].segments[1].height,.25);
  assert.equal(layout.columns[0].segments[1].bottom,.75);
  assert.ok(Math.abs(area(layout)-.6)<1e-12);
});
test('category exclusion collapses in recalculated mode and keeps its slot in original mode',()=>{
  const layout=mekkoLayout(data,{hidden_categories:['North']});
  assert.equal(layout.columns[0].width,0);
  assert.equal(layout.columns[1].width,1);
  const original=mekkoLayout(data,{hidden_categories:['North'],recalculate:false});
  assert.equal(original.columns[1].x,.4);
  assert.equal(original.columns[0].segments[0].height,0);
});
test('all hidden and all zero remain finite',()=>{
  for(const selection of [{hidden_series:['A','B']},{hidden_categories:['North','South']}]) {
    const layout=mekkoLayout(data,selection);
    assert.equal(layout.visibleTotal,0);
    assert.equal(area(layout),0);
  }
  const layout=mekkoLayout({x:['Zero'],series:[{name:'A',values:[0]}]},{});
  assert.equal(layout.columns[0].width,0);
  assert.equal(layout.columns[0].segments[0].height,0);
});
test('proportions do not depend on the order of magnitude',()=>{
  const scaled={...data,series:data.series.map(s=>({...s,values:s.values.map(v=>v*1e-12)}))};
  const layout=mekkoLayout(scaled,{});
  assert.ok(Math.abs(layout.columns[0].width-.4)<1e-12);
  assert.ok(Math.abs(area(layout)-1)<1e-12);
});
