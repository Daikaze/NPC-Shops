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
  globalThis.game={user:{id:'gm',isGM:true},version:'11',actors:{contents:[],get:()=>({id:'unconfigured',name:'Town NPC',type:'npc',img:'npc.png',getFlag:()=>undefined})}};
  const win=new ShopWindow({actorId:'unconfigured',name:'Town NPC'},async()=>{},async()=>{});
  win.element={innerHTML:''};
  win.render();
  assert.match(win.element.innerHTML,/Make Merchant/);
});

test('GM sees Buy, Sell and Manage; players see Buy and Sell only', async () => {
  const {ShopWindow}=await import('../src/ui.js');
  const merchant={id:'merchant',name:'Mura',img:'npc.png',getFlag:()=>({enabled:true,open:true,stock:[],ledger:[]})};
  globalThis.game={user:{id:'gm',isGM:true},version:'14',actors:{contents:[],get:()=>merchant}};
  const gmWin=new ShopWindow({actorId:'merchant'},async()=>{},async()=>{});
  gmWin.mode='manage';gmWin.element={innerHTML:''};gmWin.render();
  assert.match(gmWin.element.innerHTML,/data-action="tab-buy"/);
  assert.match(gmWin.element.innerHTML,/data-action="tab-sell"/);
  assert.match(gmWin.element.innerHTML,/data-action="tab-manage"/);
  assert.doesNotMatch(gmWin.element.innerHTML,/Rollable Tables/);
  globalThis.game.user={id:'p',isGM:false};
  const playerWin=new ShopWindow({actorId:'merchant'},async()=>{},async()=>{});
  playerWin.remoteShop={enabled:true,open:true,stock:[],ledger:[],allowSelling:true};
  playerWin.element={innerHTML:''};playerWin.render();
  assert.match(playerWin.element.innerHTML,/data-action="tab-buy"/);
  assert.match(playerWin.element.innerHTML,/data-action="tab-sell"/);
  assert.doesNotMatch(playerWin.element.innerHTML,/data-action="tab-manage"/);
  assert.doesNotMatch(playerWin.element.innerHTML,/Rollable Tables/);
});

test('successful player sale posts one chat receipt and duplicate ID does not repeat it',async()=>{
  const gm={id:'gm',name:'GM',isGM:true,active:true},player={id:'seller',name:'Stoyan',isGM:false,active:true};
  const shop={...emptyShop(),enabled:true,allowSelling:true,sellRate:0.5};
  const merchant={id:'merchant-sell',name:'Kiro Shop',getFlag:()=>shop,setFlag:async function(_mid,_key,s){Object.assign(shop,s);}};
  const source={id:'gillyweed',name:'Gillyweed',type:'loot',system:{quantity:2,price:{value:10,denomination:'gp'}},toObject(){return {name:this.name,type:this.type,system:this.system};}};
  const stock=new Map([[source.id,source]]);
  const buyer={id:'herb-seller',name:'Rashira',system:{currency:wallet({gp:2})},items:{get:id=>stock.get(id)},testUserPermission:()=>true,
    update:async function(paths){for(const [path,val] of Object.entries(paths))this.system.currency[path.replace('system.currency.','')]=val;},
    deleteEmbeddedDocuments:async(_type,ids)=>{for(const id of ids)stock.delete(id);}};
  const chat=[];
  globalThis.ChatMessage={getSpeaker:({alias})=>({alias}),create:async data=>chat.push(data)};
  globalThis.game={user:gm,users:{get:id=>id===player.id?player:null},actors:{get:id=>id===merchant.id?merchant:id===buyer.id?buyer:null}};
  const req={kind:'sell',merchantId:merchant.id,buyerId:buyer.id,itemId:source.id,quantity:2,userId:player.id,requestId:'v016-sale-test'};
  const result=await executeTrade(req);
  assert.equal(result.ok,true,result.message);assert.equal(buyer.system.currency.gp,12);
  assert.equal(chat.length,1);assert.match(chat[0].content,/Stoyan/);
  assert.match(chat[0].content,/Rashira/);assert.match(chat[0].content,/Kiro Shop/);
  assert.match(chat[0].content,/2 × Gillyweed/);
  assert.deepEqual(chat[0].whisper,[]);
  await executeTrade(req);assert.equal(chat.length,1);
  delete globalThis.ChatMessage;
});
test('failed purchase never announces sale',async()=>{
  const gm={id:'gm',isGM:true,active:true},player={id:'buyer',isGM:false,active:true};
  const shop={...emptyShop(),enabled:true,stock:[{id:'s1',item:{name:'Potion',type:'consumable'},priceCp:10000,quantity:1,unlimited:false}]};
  const merchant={id:'merchant-failure',name:'Mura',getFlag:()=>shop};
  const buyer={id:'hero-failure',name:'Hero',system:{currency:wallet({gp:1})},testUserPermission:()=>true};
  const chat=[];
  globalThis.ChatMessage={create:async m=>chat.push(m)};
  globalThis.game={user:gm,users:{get:id=>id===player.id?player:null},actors:{get:id=>id===merchant.id?merchant:id===buyer.id?buyer:null}};
  const result=await executeTrade({kind:'buy',merchantId:merchant.id,buyerId:buyer.id,skuId:'s1',quantity:1,userId:player.id,requestId:'v016-failure-test'});
  assert.equal(result.ok,false);assert.equal(chat.length,0);
  delete globalThis.ChatMessage;
});

test('GM cannot see Make Merchant for a PC, even with an empty shop', async()=>{
  const {ShopWindow}=await import('../src/ui.js');
  const actor={id:'pc-1',name:'Hero',type:'character',img:'hero.png',getFlag:()=>undefined,setFlag:async()=>{throw Error('PC should never become merchant')}};
  globalThis.game={user:{id:'gm',isGM:true},version:'14',actors:{contents:[],get:()=>actor}};
  const win=new ShopWindow({actorId:actor.id,name:actor.name},async()=>{},async()=>{});
  win.element={innerHTML:''};
  win.render();
  assert.doesNotMatch(win.element.innerHTML,/data-action="enable"/);
  assert.doesNotMatch(win.element.innerHTML,/Make Merchant/);
  assert.match(win.element.innerHTML,/Only NPC actors/);
  await assert.rejects(()=>win.saveShop({...emptyShop(),enabled:true}),/Only NPC actors/);
});
