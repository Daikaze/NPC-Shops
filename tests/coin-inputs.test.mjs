import test from 'node:test';
import assert from 'node:assert/strict';
import {coinEditor,readCoinEditor,splitPriceCoins} from '../src/coin-inputs.js';
import {setBuyPrice,collectStockEdits,applyStockEdits} from '../src/manage-stock.js';

function root(prefix,values,others={}) {
 return {querySelector:selector=>{
  const match=selector.match(/\[data-coin-field="([^"]+)"\]\[data-coin="([^"]+)"\]/);
  if(match)return match[1]===prefix && match[2] in values?{value:values[match[2]]}:null;
  const other=selector.match(/\[data-field="([^"]+)"\]/);
  return other ? others[other[1]]??null : null;
 }};
}
test('all PP GP SP CP inputs render side-by-side without a dropdown',()=>{
 for(const kind of ['buy-price','price','cashbox-balance']) {
  const html=coinEditor(kind,1234);
  assert.equal((html.match(/<label class="ns-coin-input/g)||[]).length,4);
  assert.match(html,/data-coin="pp"/);
  assert.match(html,/data-coin="gp"/);
  assert.match(html,/data-coin="sp"/);
  assert.match(html,/data-coin="cp"/);
  assert.doesNotMatch(html,/<select|<option/);
 }
 assert.deepEqual(splitPriceCoins(1234),{pp:1,gp:2,sp:3,cp:4});
 assert.deepEqual(splitPriceCoins(0),{pp:0,gp:0,sp:0,cp:0});
});
test('each money input is an integer count, summed without rounding',()=>{
 const values={pp:'2',gp:'3',sp:'4',cp:'5'};
 assert.deepEqual(readCoinEditor(root('buy-price',values),'buy-price'),{
  totalCp:2345,parts:{pp:2,gp:3,sp:4,cp:5},legacy:false
 });
 for(const bad of ['-1','1.5','','NaN','1e2']){
  assert.throws(()=>readCoinEditor(root('price',{...values,cp:bad}),'price'),/CP must be/);
 }
 assert.throws(()=>readCoinEditor(root('price',{pp:'1',gp:'1',sp:'1'}),'price'),/Missing CP/);
 assert.throws(()=>readCoinEditor(root('price',{...values,pp:String(Number.MAX_SAFE_INTEGER)}),'price'),/safe currency/);
});
test('Buy saves exact combined money and preserves unrelated stock',()=>{
 const shop={stock:[{id:'a',item:{name:'Apple'},priceCp:500,quantity:8},{id:'b',item:{name:'Bread'},priceCp:100,quantity:2}]};
 const price=readCoinEditor(root('buy-price',{pp:'1',gp:'2',sp:'3',cp:'4'}),'buy-price');
 const updated=setBuyPrice(shop,'a',{totalCp:price.totalCp});
 assert.equal(updated.stock[0].priceCp,1234);
 assert.equal(updated.stock[1].priceCp,100);
 assert.equal(updated.stock[0].quantity,8);
 assert.equal(shop.stock[0].priceCp,500);
});
test('Stock Save All reads every field, including hidden rows',()=>{
 const row=(id,values,quantity,hidden=false)=>{
  const x=root('price',values,{stock:{value:quantity},unlimited:{checked:false}});
  return {...x,dataset:{sku:id},hidden};
 };
 const edits=collectStockEdits([
  row('a',{pp:'0',gp:'0',sp:'4',cp:'7'},'12'),
  row('b',{pp:'1',gp:'0',sp:'0',cp:'0'},'0',true)
 ]);
 assert.equal(edits.get('a').priceCp,47);
 assert.equal(edits.get('b').priceCp,1000);
 const shop={stock:[{id:'a',item:{name:'A'},priceCp:100,quantity:2},{id:'b',item:{name:'B'},priceCp:300,quantity:2}]};
 const changed=applyStockEdits(shop,edits).shop;
 assert.deepEqual(changed.stock.map(x=>x.priceCp),[47,1000]);
 assert.deepEqual(changed.stock.map(x=>x.quantity),[12,0]);
});
test('cashbox editors show actual coin counts, not a consolidated gold balance',()=>{
 const wallet={pp:0,gp:24,ep:5,sp:3,cp:7};
 const html=coinEditor('cashbox-balance',wallet);
 assert.match(html,/data-coin="gp"[^>]*value="24"/);
 assert.match(html,/data-coin="sp"[^>]*value="3"/);
 assert.match(html,/data-coin="cp"[^>]*value="7"/);
 assert.doesNotMatch(html,/data-coin="ep"/);
 const updated=readCoinEditor(root('cashbox-balance',{pp:'2',gp:'8',sp:'4',cp:'5'}),'cashbox-balance');
 assert.deepEqual({...wallet,...updated.parts},{pp:2,gp:8,ep:5,sp:4,cp:5});
});
