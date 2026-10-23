import test from 'node:test';
import assert from 'node:assert/strict';
import {compendiumPacks,browseItemPack,importCompendiumItem,listRollTableChoices,isPackType} from '../src/compendium.js';

const ITEM=(id,name,type='loot')=>({id,_id:id,name,type,img:'item.png',
 documentName:'Item',system:{quantity:1,price:{value:4,denomination:'gp'}},
 toObject(){return {name:this.name,type:this.type,img:this.img,system:structuredClone(this.system)}}});
function pack(type,index,docs={},collection='test.items'){
 return {collection,documentName:type,metadata:{label:'Test Pack',type},
   getIndex:async()=>index, getDocument:async id=>docs[id]??null};
}
test('browse selected Item pack by name and only physical items',async()=>{
 const p=pack('Item',[ITEM('1','Longsword','weapon'),ITEM('2','Arcana','spell'),ITEM('3','Healing Potion','consumable')]);
 const result=await browseItemPack(p,'PoTioN');
 assert.equal(result.total,1);assert.equal(result.entries[0].name,'Healing Potion');
 assert.equal(result.entries[0].id,'3');
});
test('single compendium Item is copied to merchant stock, pack data untouched',async()=>{
 const potion=ITEM('potion','Potion of Healing','consumable');
 const p=pack('Item',[potion],{potion});
 const item=await importCompendiumItem(p,'potion');
 assert.equal(item.item.name,potion.name);assert.equal(item.quantity,1);
 assert.equal(item.priceCp,400);assert.equal(item.item._id,undefined);
 assert.equal(potion.system.quantity,1);
 assert.equal(item.sourceUuid,'Compendium.test.items.potion');
});
test('non-item compendiums or unsafe IDs cannot be imported',async()=>{
 await assert.rejects(importCompendiumItem(pack('RollTable',[]),'abc'),/Item Compendium/);
 await assert.rejects(importCompendiumItem(pack('Item',[]),'../../'),/Invalid/);
});
test('v11 and v14 pack metadata filtering and table list',async()=>{
 const p={metadata:{type:'RollTable',label:'Tables'},collection:'p.tables',getIndex:async()=>[{_id:'a',name:'Gathering: Coast'}]};
 assert.equal(isPackType(p,'RollTable'),true);
 assert.equal(compendiumPacks([p],'Item').length,0);
 const choices=await listRollTableChoices({tables:[{uuid:'RollTable.world',name:'Mountain',documentName:'RollTable'}],packs:[p]});
 assert.equal(choices.length,2);
 assert.ok(choices.some(c=>c.uuid==='Compendium.p.tables.a'));
});

test('Import All copies every physical item, including entries past the browser 100-item limit',async()=>{
 const {importAllCompendiumItems}=await import('../src/compendium.js');
 const rows=Array.from({length:135},(_,i)=>({id:'ID'+i,_id:'ID'+i,name:'Item '+i,type:'loot'}));
 const p=pack('Item',rows,Object.fromEntries(rows.map(i=>[i.id,ITEM(i.id,i.name)])),'demo.large');
 const committed=[],batchSizes=[];
 const result=await importAllCompendiumItems(p,{
  existingStock:[],
  batchSize:20,
  onBatch:async entries=>{committed.push(...entries);batchSizes.push(entries.length);}
 });
 assert.equal(result.total,135);
 assert.equal(result.added,135);
 assert.equal(committed.length,135);
 assert.equal(batchSizes.at(-1),15);
 assert.ok(batchSizes.every(n=>n<=20));
 assert.equal(committed[0].sourceUuid,'Compendium.demo.large.ID0');
 assert.equal(committed[134].sourceUuid,'Compendium.demo.large.ID134');
});
test('Import All skips already imported source UUIDs, unsupported Items and broken entries',async()=>{
 const {importAllCompendiumItems}=await import('../src/compendium.js');
 const a=ITEM('a','Herb'),b=ITEM('b','Potion','consumable'),c=ITEM('c','Spell','spell');
 const p=pack('Item',[a,b,c,{id:'d',name:'Failed',type:'loot'}],{a,b,c},'demo.loot');
 p.getDocument=async id=>{if(id==='d')throw Error('unavailable');return {a,b,c}[id];};
 const saved=[];
 const result=await importAllCompendiumItems(p,{
  existingStock:[{sourceUuid:'Compendium.demo.loot.a'}],
  batchSize:2,onBatch:async x=>saved.push(...x)
 });
 assert.equal(result.added,1);
 assert.equal(result.skippedExisting,1);
 assert.equal(result.failed,1);
 assert.equal(saved[0].item.name,'Potion');
});
test('Failed batch save aborts mass import, never claims unsaved items were added',async()=>{
 const {importAllCompendiumItems}=await import('../src/compendium.js');
 const a=ITEM('a','A'),b=ITEM('b','B');
 const p=pack('Item',[a,b],{a,b},'demo.items');
 let calls=0;
 await assert.rejects(importAllCompendiumItems(p,{batchSize:1,onBatch:async()=>{calls++;throw Error('DB save failed');}}),/DB save failed/);
 assert.equal(calls,1);
});
