import test from 'node:test';
import assert from 'node:assert/strict';
import {addCoins, spendCoins, changeWallet, moneyTotal, emptyShop, shopData, publicShop} from '../src/core.js';
import {setCurrency, executeTrade} from '../src/transactions.js';

const wallet = (values={}) => ({pp:0,gp:0,ep:0,sp:0,cp:0,...values});
test('shops are NOT enabled by default; existing enabled shops are respected', () => {
  assert.equal(emptyShop().enabled,false);
  assert.equal(shopData({getFlag:()=>null}).enabled,false);
  assert.equal(shopData({getFlag:()=>({enabled:true,open:true,stock:[]})}).enabled,true);
});
test('buying with gold subtracts gold and never converts remaining gold to platinum', () => {
  assert.deepEqual(spendCoins(wallet({gp:12}),100),wallet({gp:11}));
  assert.deepEqual(spendCoins(wallet({gp:20,pp:1}),1500),wallet({gp:5,pp:1}));
  assert.deepEqual(spendCoins(wallet({gp:3}),50),wallet({gp:2,ep:1}));
  assert.deepEqual(spendCoins(wallet({pp:1}),150),wallet({gp:8,ep:1}));
  assert.equal(moneyTotal(spendCoins(wallet({gp:3}),50)),250);
});
test('selling pays in gold and change but never upgrades existing gold to platinum', () => {
  assert.deepEqual(addCoins(wallet({gp:9}),100),wallet({gp:10}));
  assert.deepEqual(changeWallet(wallet({gp:9,sp:1}),105),wallet({gp:10,sp:1,cp:5}));
});
test('public shop information omits saved item data and the merchant transaction ledger', () => {
  const pub=publicShop({enabled:true,open:true,allowSelling:true,sellRate:0.5,stock:[{id:'i',item:{name:'Potion',img:'p.png',system:{secret:true}},priceCp:5000,quantity:1}],ledger:[{actorName:'Secret'}]});
  assert.equal(pub.ledger.length,0);
  assert.equal(pub.stock[0].item.system,undefined);
});
test('v11/v14 currency fields are individually saved and checked', async () => {
  const actor={system:{currency:wallet({gp:20})},update:async function(paths){for(const [key,value] of Object.entries(paths)) this.system.currency[key.slice('system.currency.'.length)]=value;}};
  await setCurrency(actor,spendCoins(actor.system.currency,100));
  assert.equal(actor.system.currency.gp,19);
  assert.equal(actor.system.currency.pp,0);
  const broken={system:{currency:wallet({gp:20})},update:async () => {}};
  await assert.rejects(()=>setCurrency(broken,wallet({gp:19})),/did not persist/);
});
test('shop trade grants exactly one item and debits character coins',async () => {
  const gm={id:'gm',isGM:true,active:true};
  const player={id:'player',isGM:false,active:true};
  const shop={...emptyShop(),enabled:true,stock:[{id:'s1',item:{name:'Potion',type:'consumable',system:{quantity:1}},priceCp:1000,quantity:3,unlimited:false}]};
  const merchant={id:'merchant',name:'Merchant',getFlag:()=>shop,setFlag:async function(_mid,_key,s){Object.assign(shop,s);}};
  const buyer={id:'hero',name:'Hero',type:'character',system:{currency:wallet({gp:20})},items:{get:()=>null},testUserPermission:(u)=>u.id==='player',
    update:async function(p){for(const [path,value] of Object.entries(p)) this.system.currency[path.replace('system.currency.','')]=value;},
    createEmbeddedDocuments:async function(type,items){this.bought=items;return [{id:'item1'}];},deleteEmbeddedDocuments:async()=>{throw Error('unexpected rollback');}};
  globalThis.game={user:gm,users:{get: id=>id==='gm'?gm:id==='player'?player:null},actors:{get:id=>id==='merchant'?merchant:id==='hero'?buyer:null}};
  const result=await executeTrade({kind:'buy',merchantId:'merchant',buyerId:'hero',skuId:'s1',quantity:1,userId:'player',requestId:'test-trade-001'});
  assert.equal(result.ok,true,result.message);
  assert.equal(buyer.system.currency.gp,10);
  assert.equal(buyer.system.currency.pp,0);
  assert.equal(buyer.bought[0].system.quantity,1);
  assert.equal(shop.stock[0].quantity,2);
});
test('player can render a remotely loaded storefront without owning the NPC actor', async () => {
  const {ShopWindow}=await import('../src/ui.js');
  const player={id:'p-view',isGM:false,active:true};
  const hero={id:'hero-2',name:'Player Hero',type:'character',img:'hero.png',system:{currency:wallet({gp:10})},items:{contents:[]},testUserPermission:()=>true};
  globalThis.game={user:player,version:'14',actors:{contents:[hero],get:()=>undefined}};
  const win=new ShopWindow({actorId:'unknown-to-player',name:'Shop NPC',img:'npc.png'},async()=>({ok:true}),async()=>({ok:true}));
  win.remoteShop={enabled:true,open:true,allowSelling:true,sellRate:0.5,stock:[{id:'stock-1',item:{name:'Potion',img:'p.png'},priceCp:100,quantity:2}],ledger:[]};
  win.element={innerHTML:''};
  win.render();
  assert.match(win.element.innerHTML,/Potion/);
  assert.match(win.element.innerHTML,/Buy/);
  assert.match(win.element.innerHTML,/Player Hero/);
  assert.doesNotMatch(win.element.innerHTML,/Make Merchant/);
});
test('GM sees Make Merchant for an unconfigured NPC', async () => {
  const {ShopWindow}=await import('../src/ui.js');
  globalThis.game={user:{id:'gm',isGM:true},version:'11',actors:{contents:[],get:()=>({id:'unconfigured',name:'Town NPC',img:'npc.png',getFlag:()=>undefined})}};
  const win=new ShopWindow({actorId:'unconfigured',name:'Town NPC'},async()=>{},async()=>{});
  win.element={innerHTML:''};
  win.render();
  assert.match(win.element.innerHTML,/Make Merchant/);
});
