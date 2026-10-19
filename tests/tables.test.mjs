import test from 'node:test';
import assert from 'node:assert/strict';
import {itemReferenceCandidates,resultPlainName,resolveTableItem,rollLinkedTable,aggregatePreview,addPreviewToStock,makeTableLink,normalizeTableLink} from '../src/tables.js';
const item=(name='Potion',uuid='Compendium.plutonium.items.abc')=>({documentName:'Item',type:'consumable',name,uuid,img:'p.png',system:{quantity:1,price:{value:50,denomination:'gp'}},toObject(){return {name:this.name,type:this.type,img:this.img,system:this.system};}});
const table={documentName:'RollTable',name:'Treasures',uuid:'RollTable.abc',async roll(){return {results:[{type:'document',documentCollection:'plutonium.items',documentId:'abc'}]};}};
test('rollable table records stay stable and validate number of rolls',()=>{
  assert.deepEqual(makeTableLink(table),{uuid:'RollTable.abc',name:'Treasures',rolls:1,enabled:true});
  assert.throws(()=>normalizeTableLink({uuid:'RollTable.abc',rolls:1000}),/Invalid quantity/);
});
test('supports world and Plutonium compendium item table references',()=>{
  assert.deepEqual(itemReferenceCandidates({documentCollection:'Item',documentId:'123'}),['Item.123']);
  assert.deepEqual(itemReferenceCandidates({documentCollection:'plutonium.items',documentId:'abc'}),['Compendium.plutonium.items.abc']);
  assert.deepEqual(itemReferenceCandidates({text:'@UUID[Compendium.plutonium.items.abc]{Healing Potion}'}),['Compendium.plutonium.items.abc']);
  assert.equal(resultPlainName('@UUID[Compendium.foo.bar.abc]{Potion}'), 'Potion');
});
test('linked RollTable generates imported items from Plutonium-style document links',async()=>{
  const potion=item();
  const fromUuidFn=async uuid=>({'RollTable.abc':table,'Compendium.plutonium.items.abc':potion}[uuid]);
  const draw=await rollLinkedTable({...makeTableLink(table),rolls:3},{fromUuidFn,items:{contents:[]},packs:[]});
  const preview=aggregatePreview([draw]);
  assert.equal(preview.items[0].quantity,3);
  assert.equal(preview.items[0].priceCp,5000);
  assert.equal(preview.skipped.length,0);
  const next=addPreviewToStock([],preview);
  assert.equal(next[0].quantity,3);
  assert.equal(next[0].sourceUuid,potion.uuid);
  assert.equal(addPreviewToStock(next,preview)[0].quantity,6);
});
test('ambiguous name-only results do not silently choose a wrong item',async()=>{
  const result=await resolveTableItem({text:'Potion'},{fromUuidFn:async()=>null,items:{contents:[item('Potion','a'),item('Potion','b')]},packs:[]});
  assert.equal(result,null);
});
test('name-only Plutonium results resolve from unique indexed Item pack',async()=>{
  const p=item();
  const pack={documentName:'Item',collection:'plutonium.imported-items',getIndex:async()=>[{name:'Potion',_id:'abc'}],getDocument:async id=>id==='abc'?p:null};
  const result=await resolveTableItem({text:'Potion'},{fromUuidFn:async()=>null,items:{contents:[]},packs:[pack]});
  assert.equal(result,p);
});
test('plain text results do not create free or phantom items',async()=>{
  const badTable={documentName:'RollTable',name:'Random events',roll:async()=>({results:[{text:'An ogre attacks!'}]})};
  const rolled=await rollLinkedTable({uuid:'RollTable.evt',rolls:1,name:'Random events'},{fromUuidFn:async()=>badTable,items:{contents:[]},packs:[]});
  assert.deepEqual(rolled.resolved,[]);
  assert.deepEqual(rolled.unresolved,['An ogre attacks!']);
});

test('custom-named Item compendium is searched after Plutonium packs',async()=>{
  const p=item();
  const pack={documentName:'Item',collection:'world.custom-items',getIndex:async()=>[{name:'Potion',_id:'p'}],getDocument:async()=>p};
  const result=await resolveTableItem({text:'Potion'},{fromUuidFn:async()=>null,items:{contents:[]},packs:[pack]});
  assert.equal(result,p);
});
