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
 assert.match(win.element.innerHTML,/data-action="minimize"/);
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
