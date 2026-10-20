import test from 'node:test';
import assert from 'node:assert/strict';
import {itemCategory,groupItems} from '../src/categories.js';
import {publicShop} from '../src/core.js';
import {ShopWindow} from '../src/ui.js';
const item=(name,type,subtype)=>({name,img:'p.png',type,system:subtype?{type:subtype}:{}});
const stock=(name,type,subtype)=>({id:name,item:item(name,type,subtype),priceCp:150,quantity:3,unlimited:false});
test('automatic categories cover standard physical item types',()=>{
  const expected=[['weapon','weapons'],['consumable','consumables'],['tool','tools'],['loot','loot'],['container','containers'],['other','other']];
  for(const [kind,label] of expected)assert.equal(itemCategory(item(kind,kind)),label);
  assert.equal(itemCategory(item('Armor','equipment',{value:'heavy'})),'armor');
  assert.equal(itemCategory(item('Shield','equipment',{value:'shield'})),'armor');
  assert.equal(itemCategory(item('Rope','equipment',{value:'trinket'})),'equipment');
});
test('items are grouped by category then name without changing saved stock',()=>{
  const entries=[stock('Z Sword','weapon'),stock('Potion','consumable'),stock('A Sword','weapon')];
  const old=structuredClone(entries);
  const grouped=groupItems(entries,x=>x.item);
  assert.deepEqual(grouped.map(x=>x.label),['Weapons','Consumables']);
  assert.deepEqual(grouped[0].entries.map(x=>x.id),['A Sword','Z Sword']);
  assert.deepEqual(entries,old);
});
test('public shop shares category without leaking private item system details',()=>{
  const data=publicShop({enabled:true,open:true,stock:[stock('Shield','equipment',{value:'shield'})]});
  assert.equal(data.stock[0].item.category,'armor');
  assert.equal(data.stock[0].item.system,undefined);
});
test('buy and manage remain usable through category wrappers',()=>{
  globalThis.game={user:{isGM:true}};
  const w=new ShopWindow({actorId:'m'},()=>{},()=>{});
  const shop={enabled:true,open:true,allowSelling:true,sellRate:.5,stock:[stock('Sword','weapon'),stock('Potion','consumable')],ledger:[]};
  assert.match(w.renderBuy(shop,{id:'buyer'}),/Weapons/);
  assert.match(w.renderBuy(shop,{id:'buyer'}),/Consumables/);
  assert.match(w.renderBuy(shop,{id:'buyer'}),/data-action="buy"/);
  assert.match(w.renderManage(shop),/data-action="save-item"/);
  assert.match(w.renderManage(shop),/Transaction History/);
  w.mode='buy';w.categoryState.set('buy:weapons',false);
  assert.doesNotMatch(w.renderCategories(shop.stock,x=>x.item,x=>x.item.name),/data-category="weapons" open/);
});
