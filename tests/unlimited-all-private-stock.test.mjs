import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyShop,publicShop} from '../src/core.js';
import {buyStockLimit,cartLines,canCheckout,adjustCart} from '../src/merchant-cart.js';
import {renderMerchantView} from '../src/merchant-view.js';
import {setUnlimitedForAll,collectStockEdits} from '../src/manage-stock.js';
import {ShopWindow} from '../src/ui.js';
import {executeTrade} from '../src/transactions.js';

const product=(id,quantity,unlimited=false)=>({
 id,item:{type:'loot',name:id,img:'bag.png',system:{price:{value:1,denomination:'gp'}}},
 quantity,unlimited,priceCp:100
});
const shop=()=>({...emptyShop(),enabled:true,open:true,
 stock:[product('Rope',7),product('Potion',0,true),product('Lantern',0)]});

test('the GM-to-player shop payload hides both quantities and unlimited flag',()=>{
 const original=shop(),pub=publicShop(original);
 assert.equal(pub.stock.length,3);
 assert.deepEqual(pub.stock.map(s=>s.available),[true,true,false]);
 for(const row of pub.stock){
  assert.equal(Object.hasOwn(row,'quantity'),false);
  assert.equal(Object.hasOwn(row,'unlimited'),false);
 }
 assert.equal(original.stock[0].quantity,7);
 assert.equal(original.stock[1].unlimited,true);
 assert.doesNotMatch(JSON.stringify(pub),/"quantity":|"unlimited":/);
});
test('player Buy view displays only Available or Sold out, GM still sees exact stock',()=>{
 const previous=globalThis.game;
 try {
  globalThis.game={version:'14',release:{generation:14}};
  const base={name:'Merchant',mode:'buy',settingsPage:'stock',eligibleBuyers:[],
   cart:{buy:new Map(),sell:new Map()},categoryFilter:{buy:'all',sell:'all'},
   searchQueries:{buy:'',sell:'',manage:''},renderManage:()=>'',busy:false,unifiedInterface:true};
  const safe=publicShop(shop());
  const player=renderMerchantView({...base,gm:false},safe,null,'Merchant','shop.png');
  assert.match(player,/Available/);
  assert.match(player,/Sold out/);
  assert.doesNotMatch(player,/7 left|Last one|Unlimited<\/span>|0 left/);
  assert.doesNotMatch(player,/data-action="toggle-unlimited-all"/);
  const gm=renderMerchantView({...base,gm:true},shop(),null,'Merchant','shop.png');
  assert.match(gm,/7 left/);
  assert.match(gm,/Unlimited<\/span>/);
 } finally {globalThis.game=previous;}
});
test('player carts use public availability, while GM stock remains the authority',()=>{
 const stock=publicShop(shop());
 assert.equal(buyStockLimit(stock.stock[0]),9999);
 assert.equal(buyStockLimit(stock.stock[1]),9999);
 assert.equal(buyStockLimit(stock.stock[2]),0);
 assert.equal(buyStockLimit(shop().stock[0]),7);
 assert.equal(buyStockLimit(shop().stock[1]),9999);
 const basket=new Map();
 adjustCart(basket,'Rope',2,buyStockLimit(stock.stock[0]));
 assert.equal(cartLines(basket,stock,{system:{currency:{gp:15}}},'buy')[0].quantity,2);
 assert.equal(canCheckout(basket,stock,{system:{currency:{gp:15}}},'buy'),true);
 const emptyBasket=new Map([['Lantern',1]]);
 assert.equal(cartLines(emptyBasket,stock,{system:{currency:{gp:15}}},'buy').length,0);
});
test('Unlimited All toggles every stock entry and can restore exact limited counts',()=>{
 const original=shop();
 const unlimited=setUnlimitedForAll(original,true);
 assert.deepEqual(unlimited.stock.map(s=>s.unlimited),[true,true,true]);
 assert.deepEqual(unlimited.stock.map(s=>s.quantity),[7,0,0]);
 assert.deepEqual(original.stock.map(s=>s.unlimited),[false,true,false]);
 const limited=setUnlimitedForAll(unlimited,false);
 assert.deepEqual(limited.stock.map(s=>s.unlimited),[false,false,false]);
 assert.deepEqual(limited.stock.map(s=>s.quantity),[7,0,0]);
 assert.throws(()=>setUnlimitedForAll(original,'yes'),/boolean/);
});
test('GM-only Unlimited All one-click saves hidden stock rows and resets on second click',async()=>{
 let saved=shop(),saveCount=0;
 const npc={id:'npc',type:'npc',name:'Merchant',img:'npc.png',getFlag:()=>saved,
  setFlag:async(_id,_flag,data)=>{saveCount++;saved=structuredClone(data);}};
 const buyer={id:'hero',name:'Hero',type:'character',
  system:{currency:{gp:100,pp:0,sp:0,cp:0,ep:0}},items:{contents:[]}};
 const previousGame=globalThis.game,previousUi=globalThis.ui;
 try {
  globalThis.game={version:'11',user:{id:'gm',isGM:true},actors:{
   contents:[npc,buyer],get:id=>id==='npc'?npc:buyer},socket:{emit(){}}};
  globalThis.ui={notifications:{info(){},warn(){},error(error){throw new Error(error);}}};
  const win=new ShopWindow(npc,async()=>({ok:true}),async()=>({ok:true}));
  const handlers={};
  const row=(sku,price,quantity,hidden=false)=>{
   const fields={price:{value:price},stock:{value:String(quantity)},unlimited:{checked:false}};
   return {dataset:{sku},hidden,querySelector(selector){
    const m=selector.match(/data-field="([^"]+)"/);
    return fields[m?.[1]]??null;
   }};
  };
  const rows=[row('Rope','1','7'),row('Potion','1','0',true),row('Lantern','1','0')];
  const el={innerHTML:'',classList:{toggle(){}},addEventListener(type,fn){handlers[type]=fn;},
   querySelectorAll(selector){return selector==='.ns-manage-item[data-sku]'?rows:[];},
   querySelector(){return null;}};
  win.element=el;win.mode='manage';win.settingsPage='stock';
  win.bindEvents(el);win.render();
  assert.match(el.innerHTML,/data-action="toggle-unlimited-all"/);
  assert.match(el.innerHTML,/Unlimited All/);
  const action={dataset:{action:'toggle-unlimited-all'},closest:()=>null};
  const click=()=>handlers.click({target:{closest:selector=>selector==='button[data-action]'?action:null}});
  await click();
  assert.deepEqual(saved.stock.map(s=>s.unlimited),[true,true,true]);
  assert.equal(saveCount,1);
  assert.match(el.innerHTML,/Disable Unlimited All/);
  await click();
  assert.deepEqual(saved.stock.map(s=>s.unlimited),[false,false,false]);
  assert.deepEqual(saved.stock.map(s=>s.quantity),[7,0,0]);
  assert.equal(saveCount,2);
 } finally {globalThis.game=previousGame;globalThis.ui=previousUi;}
});
test('GM checkout still refuses unavailable finite quantities without leaking the count',async()=>{
 const stock=shop();stock.stock=[product('Rope',1,false)];
 const merchant={id:'store-private',name:'Store',getFlag:()=>stock};
 const hero={id:'hero-private',name:'Hero',type:'character',system:{currency:{gp:20,pp:0,sp:0,cp:0,ep:0}},
  testUserPermission:()=>true};
 const previousGame=globalThis.game;
 try {
  globalThis.game={user:{isGM:true,id:'gm'},users:{get:id=>({id,name:'Player',active:true})},
   actors:{get:id=>id==='store-private'?merchant:id==='hero-private'?hero:null}};
  const result=await executeTrade({requestId:'private-qty-rejection',userId:'player',
   merchantId:'store-private',buyerId:'hero-private',kind:'buy',skuId:'Rope',quantity:3});
  assert.equal(result.ok,false);
  assert.match(result.message,/Not enough stock/);
  assert.doesNotMatch(result.message,/only 1|1 left/);
 } finally {globalThis.game=previousGame;}
});
