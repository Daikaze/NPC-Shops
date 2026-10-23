import test from 'node:test';
import assert from 'node:assert/strict';
import {plainItemName,resultRefs,rollShopTable,makeRollPreview,stockFromRollPreview,resolveResultItem,normalizeTableLink} from '../src/tables.js';
const item=(id,name,price=5)=>({documentName:'Item',id,name,type:'loot',img:'i.png',
 uuid:'Compendium.plutonium.items.'+id,system:{price:{value:price,denomination:'gp'},quantity:1},
 toObject(){return {name:this.name,type:this.type,img:this.img,system:structuredClone(this.system)}}});
const gilly=item('g','Gillyweed',7);
const pack={collection:'plutonium.items',documentName:'Item',metadata:{label:'Plutonium Items'},
 getIndex:async()=>[{_id:'g',name:'Gillyweed',type:'loot'}],getDocument:async id=>id==='g'?gilly:null};
test('v11/v14 UUID and legacy references are detected',()=>{
 assert.deepEqual(resultRefs({documentCollection:'plutonium.items',documentId:'g'}),['Compendium.plutonium.items.g']);
 assert.deepEqual(resultRefs({documentUuid:'Compendium.plutonium.items.g'}),['Compendium.plutonium.items.g']);
 assert.equal(plainItemName('<p>Gathering: Coast: Gillyweed</p>','Gathering: Coast'),'Gillyweed');
});
test('Plutonium Gathering text is matched to the real Item in Compendium',async()=>{
 const hit=await resolveResultItem({name:'Gathering: Coast: Gillyweed'},{
   fromUuidFn:async()=>null,items:{contents:[]},packs:[pack],tableName:'Gathering: Coast'});
 assert.equal(hit,gilly);
});
test('v11 result direct item resolves without needing Compendium scan',async()=>{
 const hit=await resolveResultItem({documentCollection:'plutonium.items',documentId:'g'},{
 fromUuidFn:async ref=>ref==='Compendium.plutonium.items.g'?gilly:null,items:{contents:[]},packs:[]});
 assert.equal(hit,gilly);
});
test('Table roll creates preview real item plus text-only generic loot',async()=>{
 const table={documentName:'RollTable',name:'Gathering: Coast',
   roll:async()=>({results:[{name:'Gathering: Coast: Gillyweed'},{text:"Gathering: Coast: Pixie's Parasol"}]})};
 const draw=await rollShopTable({uuid:'RollTable.coast',name:'Gathering: Coast',rolls:1},{
   fromUuidFn:async uuid=>uuid==='RollTable.coast'?table:null,
   items:{contents:[]},packs:[pack],selectedPackId:'plutonium.items',autoTextLoot:true,textLootPriceCp:300});
 assert.equal(draw.resolved.length,2);
 assert.equal(draw.resolved[0].document.name,'Gillyweed');
 assert.equal(draw.resolved[0].generated,false);
 assert.equal(draw.resolved[1].document.name,"Pixie's Parasol");
 assert.equal(draw.resolved[1].generated,true);
 assert.equal(draw.resolved[1].document.system.price.value,3);
 const preview=makeRollPreview([draw]);
 assert.equal(preview.items.length,2);
 const stock=stockFromRollPreview([],preview);
 assert.equal(stock.length,2);assert.equal(stock[1].priceCp,300);
});
test('unmatched texts can be left unresolved if GM disables fallback',async()=>{
 const table={documentName:'RollTable',name:'Gathering: Swamp',roll:async()=>({results:[{text:'Unknown Herb'}]})};
 const draw=await rollShopTable({uuid:'RollTable.x',name:table.name},{
   fromUuidFn:async()=>table,items:{contents:[]},packs:[],autoTextLoot:false});
 assert.equal(draw.resolved.length,0);assert.deepEqual(draw.unresolved,['Unknown Herb']);
});
test('duplicate table results consolidate and adding stock does not mutate original',()=>{
 const preview=makeRollPreview([{resolved:[{document:gilly,quantity:1},{document:gilly,quantity:1}]}]);
 assert.equal(preview.items.length,1);assert.equal(preview.items[0].quantity,2);
 const old=[{id:'existing',sourceUuid:gilly.uuid,item:{name:'Gillyweed'},priceCp:700,quantity:3,unlimited:false}];
 const updated=stockFromRollPreview(old,preview);
 assert.equal(updated.length,1);assert.equal(updated[0].quantity,5);assert.equal(old[0].quantity,3);
});
test('RollTable link validation rejects invalid roll counts',()=>{
 assert.throws(()=>normalizeTableLink({uuid:'RollTable.x',rolls:51}),/Invalid quantity/);
 assert.equal(normalizeTableLink({uuid:'RollTable.x',enabled:false}).enabled,false);
});
