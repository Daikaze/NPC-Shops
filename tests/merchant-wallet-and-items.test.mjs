import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyShop,publicShop} from '../src/core.js';
import {executeTrade} from '../src/transactions.js';
import {renderMerchantView} from '../src/merchant-view.js';
import {ShopWindow} from '../src/ui.js';
import {shopDragPayload,parseShopDrag,dragPayloadFromEvent,dropActorFromEvent,openShopItemSheet}
 from '../src/shop-item-interaction.js';

function world({flagFail=false}={}){
 const stock={id:'sword',item:{
   name:'Steel Sword',type:'weapon',img:'sword.png',
   system:{quantity:1,price:{value:3,denomination:'gp'}}
 },priceCp:300,quantity:6,unlimited:false};
 let saved={...emptyShop(),enabled:true,open:true,stock:[stock],cashboxCp:0};
 const buyer={id:'hero',name:'Hero',type:'character',documentName:'Actor',
   system:{currency:{gp:20,pp:0,sp:0,cp:0,ep:0}},items:{contents:[]},
   async update(paths){for(const [k,v] of Object.entries(paths))if(k.startsWith('system.currency.'))this.system.currency[k.split('.').at(-1)]=v},
   async createEmbeddedDocuments(_kind,items){const created=items.map((i,n)=>({...i,id:'new'+n}));this.delivered=created;return created},
   async deleteEmbeddedDocuments(_kind,ids){this.removed=ids},
   testUserPermission:()=>true};
 const merchant={id:'shop',name:'Mura',type:'npc',documentName:'Actor',
   system:{currency:{gp:2,pp:0,sp:0,cp:0,ep:0}},
   getFlag:()=>saved,
   async setFlag(_id,_key,next){if(flagFail)throw new Error('Shop write failed');saved=structuredClone(next)},
   async update(paths){for(const [k,v] of Object.entries(paths))if(k.startsWith('system.currency.'))this.system.currency[k.split('.').at(-1)]=v}};
 globalThis.game={user:{id:'gm',isGM:true},users:{get:()=>({id:'player',name:'Player',active:true})},
   actors:{get:id=>id==='shop'?merchant:id==='hero'?buyer:undefined,contents:[merchant,buyer]},
   version:'14',socket:{emit:()=>{}}};
 globalThis.ChatMessage={create:async()=>({id:'receipt'})};
 return {merchant,buyer,get shop(){return saved}};
}
test('paid purchases deposit exact coins on NPC Actor and GM-only lifetime Cashbox',async()=>{
 const w=world();
 const reply=await executeTrade({requestId:'cash-unique-1',merchantId:'shop',buyerId:'hero',userId:'player',kind:'buy',skuId:'sword',quantity:2});
 assert.equal(reply.ok,true,reply.message);
 assert.equal(w.buyer.system.currency.gp,14);
 assert.equal(w.merchant.system.currency.gp,8);
 assert.equal(w.shop.cashboxCp,600);
 assert.equal(w.shop.stock[0].quantity,4);
 assert.equal(w.shop.ledger.at(-1).totalCp,600);
 assert.equal(publicShop(w.shop).cashboxCp,undefined);
 assert.equal(publicShop(w.shop).tables,undefined);
 // Deduping the exact same trade request cannot charge anyone twice.
 const again=await executeTrade({requestId:'cash-unique-1',merchantId:'shop',buyerId:'hero',userId:'player',kind:'buy',skuId:'sword',quantity:2});
 assert.equal(again.ok,true);
 assert.equal(w.merchant.system.currency.gp,8);
});
test('failed final shop save refunds buyer, restores merchant coins and deletes delivered item',async()=>{
 const w=world({flagFail:true});
 const reply=await executeTrade({requestId:'cash-unique-2',merchantId:'shop',buyerId:'hero',userId:'player',kind:'buy',skuId:'sword',quantity:1});
 assert.equal(reply.ok,false);
 assert.match(reply.message,/Shop write failed/);
 assert.equal(w.buyer.system.currency.gp,20);
 assert.equal(w.merchant.system.currency.gp,2);
 assert.equal(w.shop.cashboxCp,0);
 assert.deepEqual(w.buyer.removed,['new0']);
});
test('GM Cashbox is private; player never gets Cashbox navigation or proceeds',()=>{
 globalThis.game={version:'14'};
 const shop={...emptyShop(),enabled:true,stock:[],cashboxCp:450};
 const base={name:'Mura',minimized:false,mode:'manage',settingsPage:'cashbox',
  eligibleBuyers:[],cart:{buy:new Map(),sell:new Map()},categoryFilter:{buy:'all',sell:'all'},
  searchQueries:{buy:'',sell:'',manage:''},renderManage:()=>'',busy:false,actor:{system:{currency:{gp:15,pp:0,cp:0,ep:0,sp:0}}}};
 const gm=renderMerchantView({...base,gm:true},shop,null,'Mura','img');
 assert.match(gm,/Merchant Cashbox/);
 assert.match(gm,/Gross purchase proceeds/);
 assert.match(gm,/4.50/);
 assert.match(gm,/15.00/);
 const player=renderMerchantView({...base,gm:false,mode:'buy'},publicShop(shop),null,'Mura','img');
 assert.doesNotMatch(player,/Cashbox|Gross purchase proceeds|4.50/);
});
test('shop drag payload cannot be mistaken for native Item copy, and Actor drops locate v11/v14 sheets',()=>{
 const str=shopDragPayload('merchant','sku1');
 assert.deepEqual(parseShopDrag(str),{merchantId:'merchant',skuId:'sku1',quantity:1});
 assert.equal(parseShopDrag(JSON.stringify({type:'Item',data:{name:'Free Item'}})),null);
 assert.equal(parseShopDrag(JSON.stringify({type:'NPCShopsPurchase',merchantId:'m',skuId:'s',quantity:999})),null);
 const event={dataTransfer:{getData:type=>type==='text/plain'?str:''}};
 assert.equal(dragPayloadFromEvent(event).skuId,'sku1');
 const actor={id:'hero',documentName:'Actor'};
 for(const dataset of [{actorId:'hero'},{documentId:'hero'},{uuid:'Actor.hero'}]){
  const target={closest:()=>({dataset})};
  assert.equal(dropActorFromEvent({target},{actors:{get:id=>id==='hero'?actor:null}}),actor);
 }
 const app={actor};
 assert.equal(dropActorFromEvent({target:{closest:()=>({dataset:{appid:'12'}})}},
   {actors:{get:()=>undefined},apps:{12:app}}),actor);
});
test('clicking a shop item opens a native temporary Foundry Item sheet',async()=>{
 let rendered=0;
 class TempItem{
  constructor(data,opts){this.data=data;this.opts=opts;this.sheet={render:force=>{assert.equal(force,true);rendered++}}}
 }
 const doc=openShopItemSheet({name:'Steel Sword',type:'weapon',system:{price:{value:3}}},{itemClass:TempItem});
 assert.equal(doc.data.name,'Steel Sword');
 assert.equal(doc.opts.parent,null);
 assert.equal(rendered,1);
 const shop=world();
 const win=new ShopWindow({actorId:'shop'},()=>{},
   async(_id,skuId)=>({ok:true,item:{name:skuId,type:'weapon'}}));
 win.element={innerHTML:'',querySelectorAll:()=>[],classList:{toggle(){}}};
 globalThis.CONFIG={Item:{documentClass:TempItem}};
 await win.inspectItem('sword');
 assert.equal(rendered,2);
 assert.equal(win.element.innerHTML.includes('draggable="true"'),false);
 win.render();win.mode='buy';win.render();
 assert.match(win.element.innerHTML,/data-action="inspect-item"/);
 assert.match(win.element.innerHTML,/draggable="true"/);
 assert.match(win.element.innerHTML,/data-action="cart-add"/);
});
test('dragging a shop item onto the bill adds it to cart, never directly creates inventory',async()=>{
 const w=world();
 const win=new ShopWindow({actorId:'shop'},()=>{},()=>{});
 win.element={innerHTML:'',querySelectorAll:()=>[],classList:{toggle(){}}};
 const listeners={};
 win.element.addEventListener=(k,fn)=>{(listeners[k]??=[]).push(fn)};
 win.bindEvents(win.element);
 win.render();
 const data=shopDragPayload('shop','sword');
 const transfer={getData:type=>type==='application/x-npc-shops'?data:'',
   setData(){},types:['application/x-npc-shops']};
 const bill={closest:selector=>selector==='.ns-mp-bill'?bill:null};
 const event={target:bill,dataTransfer:transfer,preventDefault(){},stopPropagation(){}};
 await listeners.drop[0](event);
 assert.equal(win.cart.buy.get('sword'),1);
 assert.equal(w.buyer.delivered,undefined);
 assert.equal(w.merchant.system.currency.gp,2);
});
