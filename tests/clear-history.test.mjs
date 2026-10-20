import test from 'node:test';
import assert from 'node:assert/strict';
import {clearMerchantHistory, ShopWindow} from '../src/ui.js';
import {MODULE_ID} from '../src/core.js';
function merchant() {
  const shop={enabled:true,stock:[{id:'x',item:{name:'Potion',img:'icons/svg/item-bag.svg'},priceCp:123,quantity:5,unlimited:false}],sellRate:0.5,ledger:[{at:'2026-10-20T01:02:03Z',actorName:'Player',kind:'buy',quantity:1,itemName:'Rope',totalCp:100},{at:'2026-10-20T01:04:05Z',actorName:'Player',kind:'sell',quantity:2,itemName:'Potion',totalCp:200}]};
  const updates=[];
  return {name:'Kiro Shop',shop,updates,getFlag(m,k){assert.equal(m,MODULE_ID);assert.equal(k,'shop');return shop;},async update(data){updates.push(data);assert.deepEqual(Object.keys(data),['flags.npc-shops.shop.ledger']);shop.ledger=data['flags.npc-shops.shop.ledger'];}};
}
test('GM clears only transaction history and leaves inventory/settings unchanged',async()=>{
  globalThis.game={user:{isGM:true}};
  const a=merchant(), preserved=structuredClone({...a.shop,ledger:[]});
  const result=await clearMerchantHistory(a,()=>true);
  assert.deepEqual(result,{cleared:2,cancelled:false});
  assert.deepEqual(a.shop,preserved);
  assert.equal(a.updates.length,1);
});
test('Cancel does not delete history',async()=>{
  globalThis.game={user:{isGM:true}};
  const a=merchant();
  assert.deepEqual(await clearMerchantHistory(a,()=>false),{cleared:0,cancelled:true});
  assert.equal(a.shop.ledger.length,2);
  assert.equal(a.updates.length,0);
});
test('Players cannot clear transaction history',async()=>{
  globalThis.game={user:{isGM:false}};
  const a=merchant();
  await assert.rejects(clearMerchantHistory(a,()=>true),/Only a GM/);
  assert.equal(a.updates.length,0);
});
test('Manage shows Clear History only to GM, disabled for empty ledger',()=>{
  globalThis.game={user:{isGM:true}};
  const w=new ShopWindow({actorId:'x'},()=>{},()=>{});
  const a=merchant();
  assert.match(w.renderManage(a.shop),/data-action="clear-history"/);
  assert.match(w.renderManage({...a.shop,ledger:[]}),/data-action="clear-history"[^>]*disabled/);
  globalThis.game={user:{isGM:false}};
  assert.equal(w.renderManage(a.shop),'');
});
