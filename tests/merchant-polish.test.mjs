import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMerchantView} from '../src/merchant-view.js';
import {publicShop,emptyShop} from '../src/core.js';
import {ShopWindow,clearMerchantHistory} from '../src/ui.js';
import {confirmShopDialog} from '../src/shop-dialog.js';
import {readFileSync} from 'node:fs';

function mockWindow(gm,mode='buy'){
 return {gm,mode,minimized:false,eligibleBuyers:[],cart:{buy:new Map(),sell:new Map()},
  categoryFilter:{buy:'all',sell:'all'},searchQueries:{buy:'',sell:'',manage:''},
  busy:false,name:'Mura',settingsPage:'terms',renderManage:()=>'<section>Stock</section>'};
}
test('Trade percentage visibility defaults GM only and can be revealed to players',()=>{
 globalThis.game={version:'14'};
 const shop={...emptyShop(),enabled:true};
 assert.equal(shop.hideTradeTerms,true);
 const publicData=publicShop(shop);
 assert.equal(publicData.hideTradeTerms,true);
 assert.equal(publicData.ledger.length,0);
 const player=mockWindow(false);
 const gm=mockWindow(true);
 assert.doesNotMatch(renderMerchantView(player,publicData,null,'Mura','img'),/Sells at list/);
 assert.match(renderMerchantView(gm,shop,null,'Mura','img'),/Sells at list/);
 assert.match(renderMerchantView(player,{...publicData,hideTradeTerms:false},null,'Mura','img'),/Sells at list/);
 gm.mode='manage';gm.settingsPage='terms';
 const settings=renderMerchantView(gm,shop,null,'Mura','img');
 assert.match(settings,/data-action="toggle-terms-visibility"/);
 assert.match(settings,/Show to Players/);
});
test('Minimization toggles an actual window class and allows restoration',()=>{
 const actor={id:'npc',name:'Mura',img:'npc.png',type:'npc',getFlag:()=>({...emptyShop(),enabled:true})};
 globalThis.game={version:'11',user:{isGM:true},actors:{get:()=>actor,contents:[actor]}};
 const win=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 const active=new Set();
 win.element={innerHTML:'',classList:{toggle:(key,on)=>{if(on)active.add(key);else active.delete(key)}},querySelectorAll:()=>[]};
 win.toggleMinimize();
 assert.equal(win.minimized,true);assert.ok(active.has('ns-is-minimized'));
 assert.doesNotMatch(win.element.innerHTML,/data-action="minimize"/);
 win.toggleMinimize();
 assert.equal(win.minimized,false);assert.ok(!active.has('ns-is-minimized'));
});
test('Foundry-contained confirmation resolves yes/cancel without a browser confirm()',async()=>{
 const make=()=>{
  const doc={created:[],createElement(tag){
   const el={tag,children:[],events:{},className:'',setAttribute(){},
    append(...children){this.children.push(...children)},appendChild(x){this.children.push(x)},
    addEventListener(k,f){this.events[k]=f},remove(){this.removed=true},
    focus(){this.focused=true}};
   doc.created.push(el);return el;
  },addEventListener(k,f){this.key=f},removeEventListener(){this.key=null}};
  const root={ownerDocument:doc,appendChild(x){this.child=x}};
  return {doc,root};
 };
 let {doc,root}=make();
 const yes=confirmShopDialog(root,{title:'Remove Merchant',message:'Remove from shop?',danger:true});
 assert.equal(root.child.className,'ns-confirm-overlay');
 const panel=root.child.children[0];
 assert.equal(panel.children[1].textContent,'Remove from shop?');
 panel.children[2].children[1].events.click();
 assert.equal(await yes,true);
 assert.equal(root.child.removed,true);
 ({doc,root}=make());
 const no=confirmShopDialog(root,{title:'Remove Table',message:'Keep stock'});
 doc.key({key:'Escape',preventDefault(){}});
 assert.equal(await no,false);
});
test('v11 Buyback percentage can be edited and saved without relying on v14 ApplicationV2',async()=>{
 let saved={...emptyShop(),enabled:true,sellRate:.5};
 const npc={id:'npc',name:'Mura',type:'npc',getFlag:()=>saved,
  async setFlag(_id,_key,next){saved=structuredClone(next)}};
 globalThis.game={version:'11',user:{isGM:true},actors:{get:()=>npc,contents:[npc]},socket:{emit:()=>{}}};
 globalThis.ui={notifications:{info:()=>{},error:()=>{}}};
 const window=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 const listeners={};
 const field={value:'85',matches:s=>s==='[data-field="rate"]'};
 window.element={innerHTML:'',addEventListener:(k,fn)=>listeners[k]=fn,querySelector:s=>s==='[data-field="rate"]'?field:null,querySelectorAll:()=>[]};
 window.mode='manage';window.bindEvents(window.element);
 listeners.input({target:field});
 const button={dataset:{action:'save-rate'},closest:s=>s==='.ns-config,.ns-mp-terms'?{querySelector:()=>field}:null};
 await listeners.click({target:{closest:s=>s==='button[data-action]'?button:null}});
 assert.equal(saved.sellRate,.85);
 window.render();
 assert.match(window.element.innerHTML,/value="85"/);
});
test('Stock editor visually matches Buy and the external browser confirm is not used by actions',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const tables=readFileSync(new URL('../src/merchant-tables-ui.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles/merchant-tables.css',import.meta.url),'utf8');
 assert.match(ui,/ns-manage-categories/);
 assert.match(ui,/ns-stock-row/);
 assert.match(ui,/confirmShopDialog/);
 assert.match(tables,/win\.confirm/);
 assert.doesNotMatch(tables,/globalThis\.confirm/);
 assert.match(css,/\.ns-manage-categories \.ns-category/);
 assert.match(css,/\.ns-stock-fields/);
 assert.match(css,/\.ns-is-minimized/);
 assert.match(css,/\.ns-confirm-overlay/);
});

test('double-click title bar minimizes/restores in v11 and v14, without a button',()=>{
 for(const version of ['11','14']){
  const npc={id:'npc',name:'Shopkeeper',type:'npc',getFlag:()=>({...emptyShop(),enabled:true})};
  globalThis.game={version,user:{isGM:true},actors:{get:()=>npc,contents:[npc]}};
  const win=new ShopWindow({actorId:'npc'},()=>{},()=>{});
  const events={};let flips=0;
  const classes=new Set();
  win.element={innerHTML:'',classList:{toggle:(c,b)=>b?classes.add(c):classes.delete(c)},
   querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
  win.bindEvents(win.element);
  win.render();
  assert.match(win.element.innerHTML,/Double-click to minimize or restore/);
  assert.doesNotMatch(win.element.innerHTML,/data-action="minimize"/);
  const header={closest:s=>s.includes('.ns-mp-top')?header:null};
  const button={closest:s=>s.includes('button,')?button:header};
  events.dblclick({target:header,preventDefault(){flips++},stopPropagation(){}});
  assert.equal(win.minimized,true);
  assert.ok(classes.has('ns-is-minimized'));
  events.dblclick({target:button,preventDefault(){flips++},stopPropagation(){}});
  assert.equal(win.minimized,true,'double-click on Close should not minimize');
  events.dblclick({target:header,preventDefault(){flips++},stopPropagation(){}});
  assert.equal(win.minimized,false);
  assert.equal(flips,2);
  assert.ok(!classes.has('ns-is-minimized'));
 }
});
test('Checkout says Buy (not Seal it); Sell uses Sell and both preserve actions',()=>{
 globalThis.game={version:'14'};
 const shop={...emptyShop(),enabled:true,open:true};
 for(const [mode,word] of [['buy','Buy'],['sell','Sell']]){
  const w=mockWindow(true,mode);
  const markup=renderMerchantView(w,shop,null,'Merchant','img');
  assert.match(markup,new RegExp('>'+word+' · 0.00 gp</span>'));
  assert.doesNotMatch(markup,/Seal it|Sell it/);
  assert.match(markup,/data-action="cart-checkout"/);
 }
});

test('Clear All merchant stock uses Foundry confirmation and preserves trade configuration',async()=>{
 const npcItems=[
  {id:'first',item:{name:'Sword',type:'weapon',img:'sword.png',system:{}},priceCp:1500,quantity:4,unlimited:false},
  {id:'second',item:{name:'Potion',type:'consumable',img:'potion.png',system:{}},priceCp:300,quantity:12,unlimited:false}
 ];
 let saved={...emptyShop(),enabled:true,stock:npcItems,ledger:[{kind:'buy',itemName:'Potion',quantity:1,totalCp:300,at:'2026-10-23T18:00:00Z',actorName:'Hero'}],
   tables:[{uuid:'RollTable.village',name:'Village'}],sellRate:.65,open:true};
 let writes=0;
 const npc={id:'npc',name:'Mura',type:'npc',img:'npc.png',getFlag:()=>saved,
   async setFlag(_id,_key,value){writes++;saved=structuredClone(value)}};
 globalThis.game={version:'14',user:{isGM:true,id:'gm'},
   actors:{get:()=>npc,contents:[npc]},socket:{emit:()=>{}}};
 const notifications=[];
 globalThis.ui={notifications:{info:x=>notifications.push(x),error:x=>notifications.push('ERR '+x)}};
 const shop=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 shop.mode='manage';shop.settingsPage='stock';
 const events={};
 shop.element={innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[],
  addEventListener:(name,fn)=>(events[name]??=[]).push(fn)};
 shop.bindEvents(shop.element);
 shop.render();
 assert.match(shop.element.innerHTML,/data-action="clear-all-stock"/);
 shop.confirm=async()=>false;
 assert.equal(await shop.clearAllStock(),false);
 assert.equal(writes,0);
 assert.equal(saved.stock.length,2);
 let prompt;
 shop.confirm=async(message,opts)=>{prompt={message,opts};return true};
 // Verify click routes to Clear All, rather than deleting through a hidden side effect.
 const button={dataset:{action:'clear-all-stock'}};
 const event={target:{closest:selector=>selector==='button[data-action]'?button:null}};
 for(const listener of events.click)await listener(event);
 assert.equal(writes,1);
 assert.equal(saved.stock.length,0);
 assert.equal(saved.enabled,true);
 assert.equal(saved.open,true);
 assert.equal(saved.sellRate,.65);
 assert.equal(saved.ledger.length,1);
 assert.equal(saved.tables.length,1);
 assert.equal(prompt.opts.danger,true);
 assert.match(prompt.message,/Remove all 2 item types/);
 assert.match(shop.element.innerHTML,/data-action="clear-all-stock"/);
 assert.match(shop.element.innerHTML,/disabled class="ns-clear-all"/);
 assert.ok(notifications.some(x=>x.includes('Cleared 2 item types')));
});
test('Clear All is GM-only and cannot clear other NPC data when no items exist',async()=>{
 const npc={id:'npc',name:'NPC',type:'npc',getFlag:()=>({...emptyShop(),enabled:true})};
 globalThis.game={version:'11',user:{isGM:false},actors:{get:()=>npc,contents:[npc]}};
 const win=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 win.mode='manage';win.settingsPage='stock';
 await assert.rejects(()=>win.clearAllStock(),/Only a GM/);
});
test('v11 and v14 titlebar tap preserves native double-click (no pointer capture)',async()=>{
 for(const version of ['11','14']){
  const actor={id:'npc',name:'Merchant',type:'npc',getFlag:()=>({...emptyShop(),enabled:true})};
  globalThis.game={version,user:{isGM:true},actors:{get:()=>actor,contents:[actor]}};
  const w=new ShopWindow({actorId:'npc'},()=>{},()=>{});
  let captured=0,released=0;
  const events={},classes=new Set();
  w.element={innerHTML:'',offsetLeft:20,offsetTop:15,style:{},
   setPointerCapture:()=>{captured++},releasePointerCapture:()=>{released++},
   classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)},
   querySelectorAll:()=>[],
   addEventListener:(name,fn)=>(events[name]??=[]).push(fn)};
  w.bindEvents(w.element);
  w.makeDraggable(w.element);
  w.render();
  const header={closest:selector=>
   selector.includes('button,a')?null:selector.includes('.ns-mp-top')?header:null};
  const ev=(type,extra={})=>({type,target:header,pointerId:7,clientX:100,clientY:120,
   preventDefault(){},stopPropagation(){},...extra});
  const emit=async(name,event)=>{for(const fn of events[name]??[])await fn(event)};
  await emit('pointerdown',ev('pointerdown'));
  await emit('pointerup',ev('pointerup'));
  assert.equal(captured,0,'single titlebar click must not start pointer capture');
  await emit('dblclick',ev('dblclick'));
  assert.equal(w.minimized,true);
  assert.ok(classes.has('ns-is-minimized'));
  await emit('dblclick',ev('dblclick'));
  assert.equal(w.minimized,false,'next independent double-click restores');
  assert.ok(!classes.has('ns-is-minimized'));
  await emit('click',ev('click',{detail:2}));
  assert.equal(w.minimized,true,'click detail=2 works if Foundry suppresses dblclick');
  await emit('dblclick',ev('dblclick'));
  assert.equal(w.minimized,true,'second event from same double-click must not toggle back');
  await emit('pointerdown',ev('pointerdown'));
  await emit('pointermove',ev('pointermove',{clientX:112,clientY:120}));
  assert.equal(captured,1,'dragging 12px must start capture');
  await emit('pointerup',ev('pointerup',{clientX:112,clientY:120}));
  assert.equal(released,1,'drag releases capture after movement');
 }
});
test('touch double-tap also minimizes the NPC Shops titlebar',async()=>{
 const actor={id:'npc',name:'Merchant',type:'npc',getFlag:()=>({...emptyShop(),enabled:true})};
 globalThis.game={version:'14',user:{isGM:true},actors:{get:()=>actor,contents:[actor]}};
 const w=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 const events={};
 w.element={innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[],
  addEventListener:(name,fn)=>(events[name]??=[]).push(fn)};
 w.bindEvents(w.element);w.render();
 const header={closest:selector=>
  selector.includes('button,a')?null:selector.includes('.ns-mp-top')?header:null};
 const tap={target:header,pointerType:'touch',clientX:25,clientY:30,
  preventDefault(){},stopPropagation(){}};
 for(const fn of events.pointerup)await fn(tap);
 assert.equal(w.minimized,false);
 for(const fn of events.pointerup)await fn(tap);
 assert.equal(w.minimized,true);
});
