import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await readFile(new URL('../streamlit_net_bars/frontend/lasagna.js',import.meta.url),'utf8');
const {lasagnaModel,heatColor}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data={x:['A','B','C'],series:[{name:'One',values:[1,null,5]},{name:'Two',values:[10,20,30]},{name:'Missing',values:[null,null,null]}]};
test('full-input means exclude missing values and centered colors retain meaning across windows',()=>{
  const full=lasagnaModel(data,{scale:'centered'}),filtered=lasagnaModel(data,{scale:'centered',start:1,end:1,hidden:['Two']});
  assert.equal(full.rows[0].mean,3);assert.deepEqual(full.rows[0].display,[-2,null,2]);
  assert.deepEqual(full.domain,filtered.domain);assert.equal(filtered.rows[0].mean,3);
  assert.deepEqual(full.domain,[-10,10]);
});
test('sorts use full-input means or last observed values, missing rows last',()=>{
  assert.deepEqual(lasagnaModel(data,{sort:'mean'}).rows.map(r=>r.name),['Two','One','Missing']);
  assert.deepEqual(lasagnaModel(data,{sort:'latest'}).rows.map(r=>r.name),['Two','One','Missing']);
  assert.equal(lasagnaModel(data,{hidden:['One','Two','Missing']}).rows.length,0);
});
test('palette interpolation clamps limits and treats missing separately',()=>{
  assert.equal(heatColor(null,[0,10],['#000000','#ffffff'],'#eeeeee'),'#eeeeee');
  assert.equal(heatColor(5,[0,10],['#000000','#ffffff'],'#eeeeee'),'#808080');
  assert.equal(heatColor(20,[0,10],['#000000','#ffffff'],'#eeeeee'),'#ffffff');
});
test('all missing, constant values and custom color limits are finite',()=>{
  assert.deepEqual(lasagnaModel({x:['A'],series:[{name:'One',values:[null]}]},{}).domain,[0,1]);
  assert.deepEqual(lasagnaModel({x:['A'],series:[{name:'One',values:[0]}]},{}).domain,[-1,1]);
  assert.deepEqual(lasagnaModel({...data,vmin:0,vmax:100},{}).domain,[0,100]);
});
