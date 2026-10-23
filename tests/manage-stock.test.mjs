import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectStockEdits,applyStockEdits,setBuyPrice} from '../src/manage-stock.js';
import {ShopWindow} from '../src/ui.js';

const stock=(id,name,quantity=3,priceCp=100)=>({id,item:{type:'loot',name},priceCp,quantity,unlimited:false});
const baseShop=()=>({enabled:true,open:true,allowSelling:true,sellRate:.5,
  stock:[stock('a','Apple',3,100),stock('b','Bread',4,200),stock('c','Rope',5,300)],
  ledger:[{kind:'buy',itemName:'Old',totalCp:100}]});
function row(id,price,quantity,unlimited=false,hidden=false){
 const fields={'price':{value:price},'stock':{value:quantity},'unlimited':{checked:unlimited}};
 return {dataset:{sku:id},hidden,querySelector(selector){
   const match=selector.match(/\[data-field="([^"]+)"\]/);
   return fields[match?.[1]]??null;
 }};
}
test('Save All validates and gathers every row including searched/hidden items',()=>{
 const edits=collectStockEdits([row('a','4.50','25'),row('b','0','0',true,true),row('c','3.25','10')]);
 assert.equal(edits.size,3);
 assert.deepEqual(edits.get('a'),{priceCp:450,quantity:25,unlimited:false});
 assert.deepEqual(edits.get('b'),{priceCp:0,quantity:0,unlimited:true});
 const result=applyStockEdits(baseShop(),edits);
 assert.equal(result.rows,3);
 assert.equal(result.changed,3);
 assert.deepEqual(result.shop.stock.map(x=>x.quantity),[25,0,10]);
 assert.deepEqual(result.shop.stock.map(x=>x.priceCp),[450,0,325]);
 assert.deepEqual(result.shop.ledger,[{kind:'buy',itemName:'Old',totalCp:100}]);
});
test('Save All does not mutate original shop record before persistence',()=>{
 const original=baseShop();
 const changes=collectStockEdits([row('a','7.10','99')]);
 const result=applyStockEdits(original,changes);
 assert.equal(original.stock[0].quantity,3);
 assert.equal(result.shop.stock[0].quantity,99);
 assert.equal(result.shop.stock[1].quantity,4);
});
test('invalid stock, price and duplicate row abort the entire batch',()=>{
 for(const itemRow of [row('a','3',''),row('a','3','-1'),row('a','3','1.5'),
  row('a','','1'),row('a','2.001','1'),row('a','abc','1'),row('a','1','1000000')]){
  assert.throws(()=>collectStockEdits([row('b','2','7'),itemRow]));
 }
 assert.throws(()=>collectStockEdits([row('a','1','1'),row('a','2','2')]),/duplicated/);
 assert.throws(()=>applyStockEdits(baseShop(),new Map([['removed',{quantity:20,priceCp:100,unlimited:false}]])),/Stock changed/);
});
test('one Save All click writes the entire shop exactly once and updates Buy view',async()=>{
 let saved=baseShop(),calls=0;
 const npc={id:'m',name:'Mura',type:'npc',img:'npc.png',
   getFlag:()=>saved,setFlag:async(_m,_n,data)=>{calls++;saved=structuredClone(data);}};
 const hero={id:'hero',name:'Hero',type:'character',system:{currency:{gp:100,pp:0,ep:0,sp:0,cp:0}},
   items:{contents:[]},testUserPermission:()=>true};
 const messages=[];
 globalThis.ui={notifications:{info:x=>messages.push(x),error:x=>messages.push('ERR '+x)}};
 globalThis.game={user:{isGM:true,id:'gm'},actors:{contents:[npc,hero],get:id=>id==='m'?npc:hero},
   socket:{emit:()=>{}},version:'14'};
 const win=new ShopWindow({actorId:'m'},async()=>({ok:true}),async()=>({ok:true}));
 const handlers={};
 const rows=[row('a','6.00','9'),row('b','7.00','12',true,true),row('c','8.00','21')];
 const noResults={hidden:true};
 win.element={innerHTML:'',
   addEventListener:(event,handler)=>handlers[event]=handler,
   querySelectorAll(selector){
    return selector==='.ns-manage-item[data-sku]'?rows:[];
   },
   querySelector(selector){
    if(selector==='[data-field="rate"]')return {value:'60'};
    if(selector==='.ns-no-results')return noResults;
    return null;
   }
 };
 win.mode='manage';win.settingsPage='stock';win.bindEvents(win.element);win.render();
 const button={dataset:{action:'save-all-stock'},closest:()=>null};
 await handlers.click({target:{closest:selector=>selector==='button[data-action]'?button:null}});
 assert.equal(calls,1);
 assert.deepEqual(saved.stock.map(x=>x.quantity),[9,12,21]);
 assert.equal(saved.stock[1].unlimited,true);
 assert.equal(saved.sellRate,.6);
 win.mode='buy';win.render();
 assert.match(win.element.innerHTML,/9 left/);
 assert.match(win.element.innerHTML,/21 left/);
 assert.match(win.element.innerHTML,/Unlimited/);
 assert.ok(messages.some(m=>m.includes('Saved 3 items')));
});
test('dark slate reference palette and Save All controls are scoped to NPC Shops',()=>{
 const css=readFileSync(new URL('../styles/npc-shops.css',import.meta.url),'utf8');
 assert.match(css,/--ns-slate:#222630/);
 assert.match(css,/--ns-divider:#414650/);
 assert.match(css,/\.npc-shops-window \.ns-save-all-bar/);
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.equal((ui.match(/button\('save-all-stock'/g)||[]).length,2);
 assert.match(ui,/collectStockEdits\(rows\)/);
});

test('GM Buy editor changes only the selected stock price in GP',()=>{
  const original=baseShop();
  const result=setBuyPrice(original,'b','12.75');
  assert.equal(result.stock[1].priceCp,1275);
  assert.equal(result.stock[0].priceCp,100);
  assert.equal(result.stock[2].priceCp,300);
  assert.equal(result.stock[1].quantity,4);
  assert.deepEqual(result.ledger,original.ledger);
  assert.equal(original.stock[1].priceCp,200);
  assert.equal(setBuyPrice(original,'a','0').stock[0].priceCp,0);
  for(const invalid of ['','-1','abc','1.001',null]){
    assert.throws(()=>setBuyPrice(original,'a',invalid));
  }
  assert.throws(()=>setBuyPrice(original,'missing','4.00'),/no longer/);
});
test('only GMs get the Buy price input; other buyers still see normal price',()=>{
  const stock=[{id:'a',item:{name:'Apple',type:'loot',img:'apple.png',system:{price:{value:1,denomination:'gp'}}},priceCp:100,quantity:2,unlimited:false}];
  const npc={id:'npc',type:'npc',name:'Mura',img:'npc.png',getFlag:()=>({...baseShop(),stock})};
  const hero={id:'hero',type:'character',name:'Hero',system:{currency:{gp:20,cp:0,sp:0,pp:0,ep:0}},items:{contents:[]},testUserPermission:()=>true};
  globalThis.game={user:{isGM:true,id:'gm'},actors:{contents:[npc,hero],get:id=>id==='npc'?npc:hero},version:'14'};
  const win=new ShopWindow({actorId:'npc'},()=>{},()=>{});
  win.element={innerHTML:''};
  win.render();
  assert.match(win.element.innerHTML,/data-field="buy-price"/);
  assert.match(win.element.innerHTML,/data-action="save-buy-price"/);
  game.user={id:'p1',isGM:false};
  win.remoteShop={enabled:true,open:true,sellRate:.5,allowSelling:true,hideTradeTerms:true,stock,ledger:[]};
  win.render();
  assert.doesNotMatch(win.element.innerHTML,/data-field="buy-price"/);
  assert.doesNotMatch(win.element.innerHTML,/data-action="save-buy-price"/);
});
