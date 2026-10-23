import test from 'node:test';
import assert from 'node:assert/strict';
import {cartEntries,cartLines,cartTotal,adjustCart,canCheckout} from '../src/merchant-cart.js';
import {ShopWindow} from '../src/ui.js';

const wallet=gp=>({gp,sp:0,cp:0,ep:0,pp:0});
const item=(name,type='loot')=>({name,type,img:'bag.png',system:{quantity:3,price:{value:5,denomination:'gp'}}});
function world(stock=[{id:'s1',item:item('Potion','consumable'),priceCp:300,quantity:4,unlimited:false}]){
 let saved={enabled:true,open:true,allowSelling:true,sellRate:.5,stock,ledger:[]};
 const npc={id:'merchant',name:'Kiro',type:'npc',img:'npc.png',getFlag:()=>saved,
  setFlag:async(_id,_key,shop)=>{saved=structuredClone(shop)}};
 const hero={id:'hero',name:'Hero',type:'character',system:{currency:wallet(20)},
   items:{contents:[]},testUserPermission:()=>true};
 globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:()=>{}}};
 globalThis.game={user:{id:'gm',isGM:true},actors:{contents:[npc,hero],get:id=>id==='merchant'?npc:hero},
   socket:{emit:()=>{}},version:'14',release:{generation:14}};
 const win=new ShopWindow({actorId:'merchant',name:'Kiro',img:'npc.png'},async()=>({ok:true,message:'Trade completed'}),async()=>({ok:true}));
 win.element={innerHTML:''};
 return {npc,hero,win,get saved(){return saved}};
}
test('Merchant Presets-style columns and bill are visible for GM',()=>{
 const {win}=world();
 win.render();
 assert.match(win.element.innerHTML,/ns-mp-hero/);
 assert.match(win.element.innerHTML,/ns-mp-sidebar/);
 assert.match(win.element.innerHTML,/ns-mp-bill/);
 assert.match(win.element.innerHTML,/BILL OF SALE/);
 assert.match(win.element.innerHTML,/data-action="tab-manage"/);
 assert.match(win.element.innerHTML,/4 left/);
});
test('Save Stock 4→17 is immediately reflected on Buy tab',async()=>{
 const {win,npc}=world();
 win.mode='manage';win.render();
 const next=structuredClone(win.shop);next.stock[0].quantity=17;
 await win.saveShop(next);
 assert.equal(npc.getFlag().stock[0].quantity,17);
 win.mode='buy';win.render();
 assert.match(win.element.innerHTML,/17 left/);
 assert.doesNotMatch(win.element.innerHTML,/4 left/);
});
test('saving stock does not change original merchant item price, ledger or NPC type',async()=>{
 const {win,npc}=world();
 const next=structuredClone(win.shop);next.stock[0].quantity=22;
 await win.saveShop(next);
 assert.equal(npc.getFlag().stock[0].priceCp,300);
 assert.deepEqual(npc.getFlag().ledger,[]);
 assert.equal(npc.type,'npc');
});
test('basket increases quantity, totals correct, prevents overselling',()=>{
 const {hero,win}=world();
 win.render();const cart=win.cart.buy,shop=win.shop;
 assert.equal(adjustCart(cart,'s1',1,4),1);
 assert.equal(adjustCart(cart,'s1',10,4),4);
 assert.equal(cartLines(cart,shop,hero,'buy')[0].quantity,4);
 assert.equal(cartTotal(cartLines(cart,shop,hero,'buy')),1200);
 assert.equal(canCheckout(cart,shop,hero,'buy'),true);
 hero.system.currency=wallet(3);
 assert.equal(canCheckout(cart,shop,hero,'buy'),false);
});
test('checkout submits one GM-validated trade per bill line',async()=>{
 const {win}=world();
 const submitted=[];
 win.submit=async details=>{submitted.push(details);return {ok:true,message:'Trade complete'}};
 win.cart.buy.set('s1',2);
 win.render();
 assert.match(win.element.innerHTML,/Buy/);
 await win.checkoutCart();
 assert.equal(submitted.length,1);
 assert.equal(submitted[0].quantity,2);
 assert.equal(submitted[0].skuId,'s1');
 assert.equal(win.cart.buy.size,0);
});
test('on failed checkout unsold entries remain in cart',async()=>{
 const {win}=world();
 win.submit=async()=>({ok:false,message:'Shop ran out'});
 win.cart.buy.set('s1',2);
 await assert.rejects(win.checkoutCart(),/Shop ran out/);
 assert.equal(win.cart.buy.get('s1'),2);
});
test('player receives new stock after GM update',async()=>{
 const {win,hero}=world();
 globalThis.game.user={id:'p1',isGM:false};
 globalThis.game.actors={contents:[hero],get:()=>undefined};
 win.remoteShop={enabled:true,open:true,sellRate:.5,allowSelling:true,stock:[{id:'s1',item:{name:'Potion'},priceCp:300,quantity:3}],ledger:[]};
 win.info=async()=>({ok:true,shop:{...win.remoteShop,stock:[{id:'s1',item:{name:'Potion'},priceCp:300,quantity:19}]},name:'Kiro',img:'npc.png'});
 await win.load();
 assert.match(win.element.innerHTML,/19 left/);
});
