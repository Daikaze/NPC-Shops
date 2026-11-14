import test from 'node:test';
import assert from 'node:assert/strict';
import {addCoins,changeWallet,formatCoins,formatWallet,moneyTotal,priceCoin,priceInputValue,priceToCp} from '../src/core.js';
import {collectStockEdits,setBuyPrice} from '../src/manage-stock.js';
import {ShopWindow} from '../src/ui.js';

test('PP GP SP CP pricing stores exact copper and rejects fractional copper',()=>{
 assert.equal(priceToCp('2','pp'),2000);
 assert.equal(priceToCp('3.5','gp'),350);
 assert.equal(priceToCp('2.5','sp'),25);
 assert.equal(priceToCp('7','cp'),7);
 assert.equal(priceInputValue(1250,'pp'),'1.25');
 assert.equal(priceInputValue(125,'gp'),'1.25');
 assert.equal(formatCoins(1134),'1 pp 1 gp 3 sp 4 cp');
 assert.equal(formatWallet({pp:1,gp:12,ep:1,sp:3,cp:4}),'1 pp 12 gp 1 ep 3 sp 4 cp');
 assert.throws(()=>priceToCp('0.5','cp'),/whole number of copper/);
 assert.throws(()=>priceToCp('10','fake'),/Choose PP/);
});
test('legacy Gold stock is priced without migration; new denomination is retained',()=>{
 const shop={stock:[{id:'a',item:{name:'Rope'},priceCp:500,quantity:1}]};
 assert.equal(priceCoin(shop.stock[0]),'gp');
 const next=setBuyPrice(shop,'a','3','sp');
 assert.equal(next.stock[0].priceCp,30);
 assert.equal(next.stock[0].priceDenomination,'sp');
 assert.equal(shop.stock[0].priceCp,500);
 const fields={price:{value:'5'},'price-denomination':{value:'cp'},stock:{value:'4'},unlimited:{checked:false}};
 const edits=collectStockEdits([{dataset:{sku:'a'},querySelector:q=>fields[q.match(/data-field="([^"]+)"/)?.[1]]}]);
 assert.deepEqual(edits.get('a'),{priceCp:5,priceDenomination:'cp',quantity:4,unlimited:false});
});
test('Platinum payouts credit PP instead of converting all income to Gold',()=>{
 const initial={pp:0,gp:2,sp:3,cp:0,ep:0};
 const after=addCoins(initial,1000);
 assert.equal(after.pp,1);
 assert.equal(after.gp,2);
 assert.equal(after.sp,3);
 assert.equal(moneyTotal(after),moneyTotal(initial)+1000);
 assert.equal(moneyTotal(changeWallet(after,-113)),moneyTotal(initial)+887);
});
test('search scans all shelves even with another category selected and opens v11 details',()=>{
 const row=name=>({dataset:{searchName:name},hidden:false,querySelector:()=>null});
 const sword=row('Longsword'),potion=row('Healing Potion');
 const category=(id,rows)=>({dataset:{category:id,view:'manage'},tagName:'DETAILS',open:false,hidden:false,
  querySelectorAll:sel=>sel==='.ns-item'?rows:[],querySelector:()=>null});
 const weapons=category('weapons',[sword]),consumables=category('consumables',[potion]);
 const noResults={hidden:true};
 const w=new ShopWindow({id:'m'},()=>{},()=>{});
 w.element={querySelectorAll:sel=>sel==='.ns-items .ns-category'?[weapons,consumables]:[],
  querySelector:sel=>sel==='.ns-no-results'?noResults:null};
 w.mode='buy';w.categoryFilter.buy='weapons';w.searchQueries.buy='pOtIoN';
 w.applySearchFilter();
 assert.equal(weapons.hidden,true);
 assert.equal(consumables.hidden,false);
 assert.equal(consumables.open,true);
 assert.equal(potion.hidden,false);
 assert.equal(noResults.hidden,true);
 w.searchQueries.buy='';w.applySearchFilter();
 assert.equal(consumables.hidden,true);
 assert.equal(weapons.hidden,false);
 w.mode='manage';w.searchQueries.manage='sword';
 w.categoryState.set('manage:weapons',false);
 w.applySearchFilter();
 assert.equal(weapons.open,true);
 w.searchQueries.manage='';w.applySearchFilter();
 assert.equal(weapons.open,false);
});
test('Foundry v11 & v14 use the same NPC Shops merchant summary and coin selectors',()=>{
 const stock=[{id:'a',item:{name:'Dagger',type:'weapon',system:{}},priceCp:5,quantity:1}];
 const npc={id:'merchant',name:'Mura',type:'npc',img:'mura.png',getFlag:()=>({enabled:true,open:true,sellRate:.5,allowSelling:true,stock,ledger:[]})};
 const buyer={id:'hero',name:'Hero',type:'character',system:{currency:{pp:1,gp:1,sp:2,cp:3,ep:0}},items:{contents:[]},testUserPermission:()=>true};
 const previous=globalThis.game;
 try {
  for(const version of ['11','14']){
   globalThis.game={version,release:{generation:Number(version)},user:{isGM:true,id:'gm'},
    actors:{get:id=>id===npc.id?npc:buyer,contents:[npc,buyer]}};
   const win=new ShopWindow(npc,()=>{},()=>{});
   win.element={innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[]};
   win.render();
   assert.match(win.element.innerHTML,/ns-native-summary/);
   assert.match(win.element.innerHTML,/data-field="buy-price-denomination"/);
   assert.match(win.element.innerHTML,/ns-money-pp/);
   win.mode='manage';win.settingsPage='stock';win.render();
   assert.match(win.element.innerHTML,/data-field="price-denomination"/);
   win.settingsPage='cashbox';win.render();
   assert.match(win.element.innerHTML,/data-action="save-cashbox-balance"/);
  }
 } finally {globalThis.game=previous;}
});
