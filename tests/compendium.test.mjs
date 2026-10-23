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
