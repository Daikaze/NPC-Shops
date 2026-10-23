import test from 'node:test';
import assert from 'node:assert/strict';
import {
 listAvailableTables,tableLink,resultName,resolveRollResult,rollMerchantTable,
 combineRolled,commitRolledStock
} from '../src/merchant-tables.js';
import {ShopWindow} from '../src/ui.js';

const sword={documentName:'Item',uuid:'Compendium.demo.items.sword',name:'Shortsword',
 type:'weapon',img:'sword.png',system:{price:{value:10,denomination:'gp'},quantity:1},
 toObject(){return {name:this.name,type:this.type,img:this.img,system:structuredClone(this.system)}}};
const gilly={...sword,uuid:'Compendium.demo.items.gilly',name:'Gillyweed',type:'loot',img:'gilly.png'};
const pack={collection:'demo.items',documentName:'Item',metadata:{label:'Herbal Items'},
 getIndex:async()=>[{_id:'gilly',name:'Gillyweed',type:'loot'}],
 getDocument:async id=>id==='gilly'?gilly:null};
test('tables from World and RollTable Compendiums both appear',async()=>{
 const source={metadata:{type:'RollTable',label:'Trade tables'},collection:'demo.tables',getIndex:async()=>[{_id:'r1',name:'Village Magic'}]};
 const values=await listAvailableTables({world:[{uuid:'RollTable.x',name:'Village Goods'}],packs:[source]});
 assert.equal(values.length,2);
 assert.ok(values.some(t=>t.uuid==='Compendium.demo.tables.r1'));
});
test('table settings reject malformed UUID or unsafe roll count',()=>{
 assert.throws(()=>tableLink({uuid:'javascript:alert(1)'}),/Invalid/);
 assert.throws(()=>tableLink({uuid:'RollTable.x',rolls:51}),/Invalid quantity/);
 assert.deepEqual(tableLink({uuid:'RollTable.x',name:'General',rolls:2}),{uuid:'RollTable.x',name:'General',rolls:2});
});
test('v11 text result Gathering: Coast: Gillyweed matches a real compendium Item',async()=>{
 assert.equal(resultName({text:'Gathering: Coast: Gillyweed'},'Gathering: Coast'),'Gillyweed');
 const hit=await resolveRollResult({text:'Gathering: Coast: Gillyweed'},{tableName:'Gathering: Coast',
  packs:[pack],items:[],fromUuidFn:async()=>null});
 assert.equal(hit.doc,gilly);
 assert.equal(hit.fallback,false);
});
test('v11 documentCollection/direct result is resolved before name matching',async()=>{
 const res=await resolveRollResult({documentCollection:'demo.items',documentId:'sword',text:'Sword'},{
  fromUuidFn:async uuid=>uuid==='Compendium.demo.items.sword'?sword:null,packs:[],items:[]});
 assert.equal(res.doc,sword);
});
test('v14 documentUuid result is supported',async()=>{
 const res=await resolveRollResult({documentUuid:sword.uuid,name:'Shortsword'},{
  fromUuidFn:async uuid=>uuid===sword.uuid?sword:null,packs:[],items:[]});
 assert.equal(res.doc.name,'Shortsword');
});
test('unmatched nonempty text creates clearly flagged generic Loot, not fake D&D stats',async()=>{
 const res=await resolveRollResult({text:"Pixie's Parasol"},{items:[],packs:[],fromUuidFn:async()=>null});
 assert.equal(res.doc.type,'loot');assert.equal(res.fallback,true);
 assert.equal(res.doc.system.price.value,0);
 assert.equal(res.doc.toObject().flags['npc-shops'].textRollResult,true);
});
test('table Roll returns results without ChatMessages and supports repeated rolls',async()=>{
 let count=0;const table={documentName:'RollTable',name:'Coast',
  roll:async({recursive})=>{assert.equal(recursive,true);count++;return {results:[{name:'Shortsword',documentUuid:sword.uuid}]}}};
 const results=await rollMerchantTable({uuid:'RollTable.a',name:'Coast',rolls:2},{
  fromUuidFn:async ref=>ref==='RollTable.a'?table:ref===sword.uuid?sword:null,
  packs:[],items:[]});
 assert.equal(count,2);assert.equal(results.rows.length,2);
});
test('Keep rolled merges quantities; unchecked roll replaces earlier preview',()=>{
 const first=[{doc:sword,quantity:2,fallback:false}],second=[{doc:sword,quantity:1,fallback:false}];
 const retained=combineRolled(first,second,true);
 assert.equal(retained.length,1);assert.equal(retained[0].quantity,3);
 assert.equal(combineRolled(first,second,false)[0].quantity,1);
});
test('Add All preview commits stock and merges repeat source without deleting old inventory',()=>{
 const prev=combineRolled([],[{doc:sword,quantity:2}],false);
 const shop={enabled:true,open:true,tables:[{uuid:'RollTable.a'}],stock:[],ledger:[{itemName:'a'}]};
 const added=commitRolledStock(shop,prev);
 assert.equal(added.stock[0].item.name,'Shortsword');
 assert.equal(added.stock[0].quantity,2);
 assert.deepEqual(added.ledger,shop.ledger);
 const merged=commitRolledStock(added,prev);
 assert.equal(merged.stock.length,1);assert.equal(merged.stock[0].quantity,4);
 assert.equal(shop.stock.length,0);
});
test('Remove Merchant requires confirmation and retains stock/ledger/tables for reactivation',async()=>{
 let data={enabled:true,open:true,allowSelling:true,sellRate:.5,stock:[{id:'z',item:{name:'Potion'},priceCp:500,quantity:3}],ledger:[{kind:'buy'}],
  tables:[{uuid:'RollTable.x',name:'Stock',rolls:1}]};
 const npc={id:'m',name:'Kiro',type:'npc',img:'img.png',getFlag:()=>data,
  setFlag:async(_mod,_key,next)=>{data=structuredClone(next)}};
 globalThis.game={user:{isGM:true},actors:{contents:[],get:()=>npc},version:'14',socket:{emit:()=>{}}};
 globalThis.ui={notifications:{info:()=>{},error:()=>{}}};
 const w=new ShopWindow({actorId:'m',name:'Kiro'},()=>{},()=>{});
 w.element={innerHTML:''};
 assert.equal(await w.deactivateMerchant(()=>false),false);
 assert.equal(data.enabled,true);
 assert.equal(await w.deactivateMerchant(()=>true),true);
 assert.equal(data.enabled,false);
 assert.equal(data.stock.length,1);assert.equal(data.ledger.length,1);assert.equal(data.tables.length,1);
 assert.match(w.element.innerHTML,/Make Merchant/);
 assert.equal(w.shop.enabled,false);
});
test('merchant settings include Item Piles-style table controls but no player-facing tab',async()=>{
 const npc={id:'m',type:'npc',name:'Kiro',getFlag:()=>({enabled:true,open:true,allowSelling:true,sellRate:.5,stock:[],ledger:[],tables:[]})};
 globalThis.game={user:{isGM:true},actors:{contents:[],get:()=>npc},version:'14'};
 const w=new ShopWindow({actorId:'m'},()=>{},()=>{});w.element={innerHTML:''};
 w.mode='manage';w.settingsPage='tables';w.render();
 assert.match(w.element.innerHTML,/Rollable Tables/);
 assert.match(w.element.innerHTML,/Roll All Tables/);
 assert.match(w.element.innerHTML,/Keep rolled/);
 assert.match(w.element.innerHTML,/Add Table/);
 assert.doesNotMatch(w.element.innerHTML,/data-action="tab-tables"/);
});


test('Roll All enumerates every attached table result, never calls random roll()',async()=>{
 const {allMerchantTableItems}=await import('../src/merchant-tables.js');
 let draws=0;
 const inventory=[
   {documentUuid:sword.uuid,name:'Shortsword'},
   {documentCollection:'demo.items',documentId:'gilly',text:'Gathering: Coast: Gillyweed'},
   {name:"Pixie's Parasol"}
 ];
 const table={documentName:'RollTable',name:'Village Store',results:{contents:inventory},roll:async()=>{draws++;throw Error('Should not draw random results')}};
 const lookup=async uuid=>uuid==='RollTable.village'?table:uuid===sword.uuid?sword:uuid===gilly.uuid?gilly:null;
 const a=await allMerchantTableItems([{uuid:'RollTable.village',name:table.name,rolls:1}],{
   fromUuidFn:lookup,items:[],packs:[pack]
 });
 assert.equal(draws,0);
 assert.equal(a.rows.length,3);
 assert.deepEqual(a.rows.map(x=>x.doc.name),['Shortsword','Gillyweed',"Pixie's Parasol"]);
 assert.equal(a.resultCount,3);
 assert.equal(a.rows[2].fallback,true);
});
test('Roll All consumes every table attached, includes duplicates as stock quantity and preserves prices/history',async()=>{
 const {allMerchantTableItems}=await import('../src/merchant-tables.js');
 const mk=(results,name)=>({documentName:'RollTable',name,results:{contents:results}});
 const docs={
  'RollTable.one':mk([{documentUuid:sword.uuid},{documentUuid:gilly.uuid}],'Items 1'),
  'RollTable.two':mk([{documentUuid:sword.uuid}],'Items 2'),
  [sword.uuid]:sword,[gilly.uuid]:gilly
 };
 const rolls=await allMerchantTableItems([
  {uuid:'RollTable.one',rolls:20},{uuid:'RollTable.two',rolls:10}
 ],{fromUuidFn:async uuid=>docs[uuid]??null,items:[],packs:[]});
 assert.equal(rolls.rows.length,3);
 const state=combineRolled([],rolls.rows,false);
 assert.equal(state.find(x=>x.doc.name==='Shortsword').quantity,2);
 const existing={enabled:true,stock:[{id:'old',item:{name:'Rope'},quantity:7,priceCp:500}],
    ledger:[{kind:'buy'}],tables:[]};
 const next=commitRolledStock(existing,state);
 assert.equal(next.stock.length,3);
 assert.equal(next.stock[0].item.name,'Rope');
 assert.deepEqual(next.ledger,existing.ledger);
 assert.equal(existing.stock.length,1);
});
test('Roll All expands nested RollTable contents without repetition and rejects cycles',async()=>{
 const {allMerchantTableItems}=await import('../src/merchant-tables.js');
 const p1={documentName:'RollTable',name:'Top',results:[{documentCollection:'RollTable',documentId:'inner'}]};
 const p2={documentName:'RollTable',name:'Inner',results:[{documentUuid:sword.uuid}]};
 const m={'RollTable.top':p1,'RollTable.inner':p2,[sword.uuid]:sword};
 const found=await allMerchantTableItems([{uuid:'RollTable.top'}],{fromUuidFn:async uuid=>m[uuid],items:[],packs:[]});
 assert.equal(found.rows.length,1);
 p2.results=[{documentCollection:'RollTable',documentId:'top'}];
 await assert.rejects(allMerchantTableItems([{uuid:'RollTable.top'}],{fromUuidFn:async uuid=>m[uuid],items:[],packs:[]}),/Circular/);
});
test('Roll All stops before exceeding a safe row limit',async()=>{
 const {allMerchantTableItems}=await import('../src/merchant-tables.js');
 const table={documentName:'RollTable',name:'Too large',results:Array.from({length:6},()=>({documentUuid:sword.uuid}))};
 await assert.rejects(allMerchantTableItems([{uuid:'RollTable.large'}],{
   maxRows:5,fromUuidFn:async u=>u==='RollTable.large'?table:sword,items:[],packs:[]
 }),/more than 5/);
});
