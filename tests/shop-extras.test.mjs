import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCompendiumBrowser,renderTables,initExtras,extraClick} from '../src/shop-extras-ui.js';
import {emptyShop,shopData,publicShop} from '../src/core.js';

test('table options are GM-only and default to preview-based stock',()=>{
 const shop=emptyShop();
 assert.deepEqual(shop.tables,[]);
 assert.equal(shop.autoTextLoot,true);
 assert.deepEqual(publicShop(shop).ledger,[]);
 assert.equal(publicShop(shop).tables,undefined);
});
test('existing shop stock and old table links remain intact',()=>{
 const stock=[{id:'old',item:{name:'Herbs'},priceCp:100,quantity:2}];
 const old={enabled:true,stock,tables:[{uuid:'RollTable.a',name:'Old Table',rolls:1,enabled:true}]};
 const data=shopData({getFlag:()=>old});
 assert.deepEqual(data.stock,stock);assert.equal(data.tables.length,1);
});
test('GM-only table panel and Compendium UI have correct actions',()=>{
 globalThis.game={packs:{contents:[]}};
 const w={gm:true};initExtras(w);
 assert.match(renderCompendiumBrowser(w),/browse-compendium/);
 const html=renderTables(w,{tables:[],autoTextLoot:true,textLootPriceCp:0});
 assert.match(html,/Rollable Tables/);
 assert.match(html,/roll-all-tables/);
 assert.match(html,/add-preview-items/);
 assert.equal(renderTables({...w,gm:false},emptyShop()),'');
 assert.equal(renderCompendiumBrowser({...w,gm:false}),'');
});
test('players cannot invoke hidden roll or import actions',async()=>{
 const w={gm:false};
 await assert.rejects(extraClick(w,'browse-tables',{}),/GM only/);
 await assert.rejects(extraClick(w,'browse-compendium',{}),/GM only/);
});
test('shop window keeps existing Buy/Sell/Manage and GM-only Rollable Tables',async()=>{
 const {ShopWindow}=await import('../src/ui.js');
 globalThis.game={user:{isGM:true},actors:{contents:[],get:()=>({id:'npc',name:'NPC',type:'npc',getFlag:()=>({enabled:true,open:true,stock:[],ledger:[]})})},packs:{contents:[]},version:'14'};
 const w=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 w.element={innerHTML:''};w.render();
 assert.match(w.element.innerHTML,/tab-buy/);
 assert.match(w.element.innerHTML,/tab-sell/);
 assert.match(w.element.innerHTML,/tab-manage/);
 assert.match(w.element.innerHTML,/tab-tables/);
 globalThis.game.user={isGM:false};
 const p=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 p.remoteShop={enabled:true,open:true,stock:[],ledger:[]};
 p.element={innerHTML:''};p.render();
 assert.doesNotMatch(p.element.innerHTML,/tab-tables/);
});

test('Import All button is present only for GM and import uses confirmation',async()=>{
 const {renderCompendiumBrowser,initExtras,handleImportAll}=await import('../src/shop-extras-ui.js');
 globalThis.game={packs:{contents:[]}};
 const w={gm:true};initExtras(w);
 w.compendiumPackId='demo.items';
 assert.match(renderCompendiumBrowser(w),/import-all-compendium/);
 assert.match(renderCompendiumBrowser(w),/Import All Items/);
 assert.equal(renderCompendiumBrowser({...w,gm:false}),'');
 await assert.rejects(handleImportAll({...w,gm:false}),/GM only/);
});
test('Import All confirms entire Compendium and avoids duplicate stock',async()=>{
 const {handleImportAll,initExtras}=await import('../src/shop-extras-ui.js');
 const items=[{_id:'a',name:'Dagger',type:'weapon'},{_id:'b',name:'Rope',type:'equipment'}];
 const pack={collection:'my.items',documentName:'Item',metadata:{label:'Shop Inventory'},
  getIndex:async()=>items,getDocument:async id=>{
   const doc=items.find(i=>i._id===id);
   return {documentName:'Item',type:doc.type,name:doc.name,system:{quantity:1,price:{value:2,denomination:'gp'}},
    toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)}}};
  }};
 const worldShop={enabled:true,open:true,stock:[{sourceUuid:'Compendium.my.items.a',item:{name:'Dagger'}}],ledger:[]};
 const actor={type:'npc',async setFlag(_m,_p,shop){Object.assign(worldShop,shop);}};
 globalThis.game={user:{isGM:true},packs:{contents:[pack]}};
 const w={gm:true,actor,get shop(){return worldShop},render(){this.renders=(this.renders??0)+1}};
 initExtras(w);w.compendiumPackId='my.items';
 const prompt=[];
 const result=await handleImportAll(w,{confirmAction:msg=>{prompt.push(msg);return true;},batchSize:1});
 assert.equal(result.added,1);assert.equal(result.skippedExisting,1);
 assert.equal(worldShop.stock.length,2);
 assert.match(prompt[0],/entire pack/);
 assert.match(w.bulkImportStatus,/1 added/);
 assert.equal(w.busy,false);
});
test('Cancelled Import All keeps existing stock untouched',async()=>{
 const {handleImportAll,initExtras}=await import('../src/shop-extras-ui.js');
 const pack={collection:'p.items',documentName:'Item',getIndex:async()=>[{_id:'1',name:'Sword',type:'weapon'}]};
 const worldShop={stock:[]};
 globalThis.game={packs:{contents:[pack]}};
 const w={gm:true,get shop(){return worldShop},render(){}};
 initExtras(w);w.compendiumPackId='p.items';
 const r=await handleImportAll(w,{confirmAction:()=>false});
 assert.equal(r.cancelled,true);assert.deepEqual(worldShop.stock,[]);
});
