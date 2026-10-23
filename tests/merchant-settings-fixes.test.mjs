import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopWindow} from '../src/ui.js';
import {tableAction} from '../src/merchant-tables-ui.js';
import {readFileSync} from 'node:fs';

test('Buyback Percentage saves independently with empty stock and keeps draft on rerenders',async()=>{
 let saved={enabled:true,open:true,allowSelling:true,sellRate:.5,stock:[],ledger:[],tables:[]};
 let writes=0;
 const npc={id:'npc',name:'Mura',type:'npc',img:'npc.png',
   getFlag:()=>saved,async setFlag(_mod,_key,v){writes++;saved=structuredClone(v)}};
 globalThis.game={user:{isGM:true,id:'gm'},version:'14',actors:{get:()=>npc,contents:[npc]},socket:{emit:()=>{}}};
 const notices=[];
 globalThis.ui={notifications:{info:s=>notices.push(s),error:s=>notices.push('ERR '+s)}};
 const win=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 const handlers={};
 const rate={value:'75',matches:s=>s==='[data-field="rate"]'};
 win.element={innerHTML:'',addEventListener:(k,f)=>handlers[k]=f,
   querySelector:s=>s==='[data-field="rate"]'?rate:null,
   querySelectorAll:()=>[]};
 win.mode='manage';win.settingsPage='stock';win.bindEvents(win.element);win.render();
 handlers.input({target:rate});
 win.render();
 assert.match(win.element.innerHTML,/value="75"/);
 const button={dataset:{action:'save-rate'},closest:s=>s==='.ns-config,.ns-mp-terms'?{querySelector:()=>rate}:null};
 await handlers.click({target:{closest:s=>s==='button[data-action]'?button:null}});
 assert.equal(writes,1);
 assert.equal(saved.sellRate,.75);
 assert.equal(win.buybackDraft,null);
 assert.ok(notices.some(x=>x.includes('75%')));
 win.render();assert.match(win.element.innerHTML,/value="75"/);
});
test('Roll All Tables previews EVERY linked result; Add All saves with a single write',async()=>{
 const sword={documentName:'Item',type:'weapon',name:'Sword',uuid:'Item.sword',img:'a.png',
   system:{price:{value:3,denomination:'gp'}},
   toObject(){return {type:this.type,name:this.name,img:this.img,system:structuredClone(this.system)}}};
 const herb={...sword,name:'Herb',uuid:'Item.herb'};
 const docs={
  'RollTable.one':{documentName:'RollTable',name:'Village 1',results:{contents:[{documentUuid:'Item.sword'},{documentUuid:'Item.herb'}]},
   roll:async()=>{throw Error('random draw was incorrectly called')}},
  'RollTable.two':{documentName:'RollTable',name:'Village 2',results:{contents:[{documentUuid:'Item.sword'}]}},
  'Item.sword':sword,'Item.herb':herb
 };
 globalThis.fromUuid=async uri=>docs[uri]??null;
 let saved={enabled:true,open:true,allowSelling:true,sellRate:.5,
  stock:[{id:'existing',item:{name:'Rope'},quantity:3,priceCp:200}],ledger:[],
  tables:[{uuid:'RollTable.one',name:'Village 1',rolls:1},{uuid:'RollTable.two',name:'Village 2',rolls:1}]};
 let writes=0;
 const npc={id:'npc',name:'Village Shop',type:'npc',img:'npc.png',
   getFlag:()=>saved,setFlag:async(_mod,_key,value)=>{writes++;saved=structuredClone(value)}};
 globalThis.game={user:{isGM:true,id:'gm'},version:'14',actors:{get:()=>npc,contents:[npc]},
   socket:{emit:()=>{}},items:{contents:[]},packs:{contents:[]}};
 globalThis.ui={notifications:{info:()=>{},error:()=>{}}};
 const win=new ShopWindow({actorId:'npc'},()=>{},()=>{});
 win.element={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
 win.mode='manage';win.settingsPage='tables';win.render();
 assert.equal(await tableAction(win,'roll-all-tables',{closest:()=>null}),true);
 assert.equal(writes,0); // Clicking Roll All never saves anything.
 assert.deepEqual(saved.stock.map(s=>s.item.name),['Rope']);
 assert.match(win.tableUI.status,/Preview ready: 3 entries/);
 assert.equal(win.tableUI.preview.length,2);
 assert.match(win.element.innerHTML,/Add All Items/);
 assert.equal(await tableAction(win,'add-all-rolled',{closest:()=>null}),true);
 assert.equal(writes,1);
 assert.deepEqual(saved.stock.map(s=>s.item.name),['Rope','Sword','Herb']);
 assert.equal(saved.stock.find(s=>s.item.name==='Sword').quantity,2);
 assert.equal(win.tableUI.preview.length,0);
});
test('Keep rolled checkbox uses a single custom styled square, and HUD tiles match native gray',()=>{
 const css=readFileSync(new URL('../styles/merchant-tables.css',import.meta.url),'utf8');
 assert.match(css,/ns-populate-keep/);
 assert.match(css,/appearance:none!important/);
 assert.match(css,/background:#252525!important/);
 assert.match(css,/width:38px!important/);
 const ui=readFileSync(new URL('../src/merchant-tables-ui.js',import.meta.url),'utf8');
 assert.match(ui,/class="ns-populate-keep"/);
 assert.match(ui,/press Add All Items to save/);
});
