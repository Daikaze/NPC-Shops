import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyShop,shopData,publicShop} from '../src/core.js';
test('new merchants support tables but never expose table settings to players',()=>{
 const shop=emptyShop();
 assert.deepEqual(shop.tables,[]);
 assert.equal(shop.autoTextLoot,true);
 assert.equal(publicShop(shop).tables,undefined);
});
test('older NPC Shops stock and ledger remain unchanged on upgrade',()=>{
 const items=[{id:'old',item:{name:'Gillyweed',type:'loot'},quantity:3,priceCp:400}];
 const actor={getFlag:()=>({enabled:true,stock:items,ledger:[{kind:'buy'}]})};
 const shop=shopData(actor);
 assert.deepEqual(shop.stock,items);
 assert.deepEqual(shop.ledger,[{kind:'buy'}]);
 assert.deepEqual(shop.tables,[]);
});
