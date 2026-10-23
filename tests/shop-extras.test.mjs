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

test('single Item Compendium import remains, bulk import controls are absent', async()=>{
 const {renderCompendiumBrowser,initExtras,extraClick}=await import('../src/shop-extras-ui.js');
 const item={documentName:'Item',type:'weapon',name:'Longsword',img:'sword.png',system:{quantity:1,price:{value:15,denomination:'gp'}},
   toObject(){return {type:this.type,name:this.name,img:this.img,system:structuredClone(this.system)}}};
 const pack={collection:'demo.weapons',documentName:'Item',metadata:{label:'Weapons'},
   getIndex:async()=>[{_id:'one',name:'Longsword',type:'weapon'}],getDocument:async()=>item};
 const shop=emptyShop();shop.enabled=true;
 globalThis.game={packs:{contents:[pack]}};
 const w={gm:true,get shop(){return shop},async saveShop(updated){Object.assign(shop,updated)},render(){}};
 initExtras(w);w.compendiumPackId='demo.weapons';
 const browser=renderCompendiumBrowser(w);
 assert.match(browser,/Find Items/);
 assert.match(browser,/Import from Item Compendium/);
 assert.doesNotMatch(browser,/Import All Items|import-all-compendium/);
 assert.equal(await extraClick(w,'import-all-compendium',{closest:()=>null}),false);
 await extraClick(w,'browse-compendium',{});
 assert.equal(w.compendiumEntries.length,1);
 const target={closest:()=>({dataset:{compendiumId:'one'}})};
 await extraClick(w,'import-compendium',target);
 assert.equal(shop.stock.length,1);
 assert.equal(shop.stock[0].item.name,'Longsword');
});
