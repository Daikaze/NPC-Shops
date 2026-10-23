/** GM-only Item Piles-inspired Rollable Table panel in NPC Shops Settings. */
import {cpToGp,gpToCp} from './core.js';
import {listAvailableTables,tableLink,rollMerchantTable,combineRolled,commitRolledStock} from './merchant-tables.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#39;'}[c]));
const btn=(action,label,more='')=>`<button type="button" data-action="${action}" ${more}>${label}</button>`;
export function initMerchantTables(win){
 win.tableUI={available:[],selection:'',preview:[],unresolved:[],keepRolled:false,status:'',working:false};
}
export function renderMerchantTables(win,shop){
 if(!win.gm)return '';
 const state=win.tableUI, links=shop.tables??[];
 return `<section class="ns-populate">
 <header class="ns-populate-header"><h3><i class="fas fa-dice-d20"></i> Rollable Tables</h3>
  ${btn('roll-all-tables','<i class="fas fa-dice-d20"></i> Roll All Tables',!links.length?'disabled':'')}</header>
 <p class="ns-populate-note">Populate shop stock from World or Compendium RollTables. Rolled results are a preview until you add them.</p>
 <div class="ns-populate-select">
  <select data-field="table-select" aria-label="Choose RollTable">
   <option value="">Choose a RollTable</option>
   ${state.available.filter(t=>!links.some(link=>link.uuid===t.uuid)).map(t=>
    `<option value="${esc(t.uuid)}" ${t.uuid===state.selection?'selected':''}>${esc(t.name)} (${esc(t.source)})</option>`).join('')}
  </select>
  ${btn('find-tables','Refresh Tables')}
  ${btn('link-table','Add Table')}
 </div>
 ${links.map(link=>`<div class="ns-populate-table" data-table-uuid="${esc(link.uuid)}">
    <strong><i class="fas fa-list-ol"></i> ${esc(link.name)}</strong>
    <label>Rolls <input type="number" min="1" max="50" step="1" data-field="table-count" value="${Number(link.rolls)||1}"/></label>
    ${btn('save-table-count','Save', 'title="Save number of rolls"')}
    ${btn('roll-one-table','<i class="fas fa-dice-d20"></i> Roll','title="Roll this table"')}
    ${btn('unlink-table','<i class="fas fa-trash"></i>','title="Remove table" aria-label="Remove table"')}
 </div>`).join('')}
 <div class="ns-populate-rule"></div>
 <div class="ns-populate-rollbar"><span>${state.preview.length ? state.preview.reduce((s,e)=>s+e.quantity,0)+' items rolled' : 'Click roll to start'}</span>
  <label>Keep rolled <input type="checkbox" data-field="keep-rolled" ${state.keepRolled?'checked':''}/></label>
 </div>
 ${state.status?`<p class="ns-populate-status" role="status">${esc(state.status)}</p>`:''}
 ${state.preview.length?`<div class="ns-populate-preview" data-scroll-key="rolled-preview">
 <div class="ns-populate-preview-toolbar">
  ${btn('add-all-rolled','<i class="fas fa-arrow-left"></i> Add All Items')}
  ${btn('clear-rolled','<i class="fas fa-trash"></i> Discard Preview')}
 </div>
 ${state.preview.map((entry,i)=>`<div class="ns-populate-preview-row" data-preview-index="${i}">
   <img src="${esc(entry.doc.img??'icons/svg/item-bag.svg')}" alt=""/>
   <div class="ns-populate-itemname"><strong>${esc(entry.doc.name)}</strong><small>${entry.fallback?'Text result → basic Loot':'Resolved Item document'}</small></div>
   <label>Qty<input type="number" min="1" max="999999" data-field="preview-quantity" value="${entry.quantity}"/></label>
   <label>GP<input type="number" min="0" step=".01" data-field="preview-price" value="${cpToGp(entry.priceCp)}"/></label>
   ${btn('add-one-rolled','<i class="fas fa-arrow-left"></i>', 'title="Add item"')}
   ${btn('remove-one-rolled','<i class="fas fa-times"></i>', 'title="Discard result"')}
 </div>`).join('')}
 </div>`:''}
 ${state.unresolved.length?`<details class="ns-populate-unresolved"><summary>Unresolved table results (${state.unresolved.length})</summary>
  ${state.unresolved.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`:''}
 </section>`;
}
function onlyGM(win){if(!win.gm||win.actor?.type!=='npc')throw new Error('NPC GM merchant required');}
function capturePreview(win){
 for(const row of win.element?.querySelectorAll?.('[data-preview-index]')??[]){
  const i=Number(row.dataset.previewIndex),entry=win.tableUI.preview[i];
  if(!entry)continue;
  const q=Number(row.querySelector('[data-field="preview-quantity"]')?.value);
  const gp=row.querySelector('[data-field="preview-price"]')?.value;
  if(!Number.isSafeInteger(q)||q<1||q>999999)throw new Error('Invalid rolled Item quantity');
  entry.quantity=q;entry.priceCp=gpToCp(gp);
 }
}
async function roll(win,links){
 const state=win.tableUI;
 if(!links.length)throw new Error('Link a RollTable first');
 state.working=true;
 try{
  const rolled=[],unresolved=[],errors=[],cache=new Map();
  for(const link of links){
   try {
    const data=await rollMerchantTable(link,{indexCache:cache});
    rolled.push(...data.rows);
    unresolved.push(...data.unresolved.map(u=>link.name+': '+u));
   }catch(err){errors.push(link.name+': '+err.message);}
  }
  state.preview=combineRolled(state.preview,rolled,state.keepRolled);
  state.unresolved=state.keepRolled?[...state.unresolved,...unresolved]:unresolved;
  state.status=`${state.preview.length} distinct Items rolled. ${errors.length?'Errors: '+errors.join('; '):''}`;
  if(errors.length)globalThis.ui?.notifications?.warn?.('NPC Shops: '+errors.join('; '));
  win.render();
 } finally{state.working=false;}
}
async function addPreview(win,all,index){
 capturePreview(win);
 const selected=all?win.tableUI.preview:win.tableUI.preview.slice(index,index+1);
 if(!selected.length)throw new Error('Roll items first');
 await win.saveShop(commitRolledStock(win.shop,selected));
 if(all)win.tableUI.preview=[];else win.tableUI.preview.splice(index,1);
 win.tableUI.status='Added '+selected.length+' result(s) to merchant Stock.';
 win.render();
}
export function tableFieldChange(win,event){
 if(event.target.matches?.('[data-field="table-select"]')){win.tableUI.selection=event.target.value;return true;}
 if(event.target.matches?.('[data-field="keep-rolled"]')){win.tableUI.keepRolled=!!event.target.checked;return true;}
 return false;
}
export async function tableAction(win,action,target){
 const actions=['find-tables','link-table','roll-one-table','roll-all-tables','save-table-count',
  'unlink-table','clear-rolled','add-one-rolled','add-all-rolled','remove-one-rolled'];
 if(!actions.includes(action))return false;
 onlyGM(win);
 const state=win.tableUI;
 if(state.working)throw new Error('A table roll is already running');
 if(action==='find-tables'){
  state.available=await listAvailableTables();
  state.selection=state.available.find(t=>!win.shop.tables?.some(x=>x.uuid===t.uuid))?.uuid??'';
  win.render();return true;
 }
 if(action==='link-table'){
  const table=state.available.find(t=>t.uuid===state.selection);
  if(!table)throw new Error('Select a RollTable first');
  const next=structuredClone(win.shop),link=tableLink({...table,rolls:1});
  next.tables=next.tables??[];
  if(next.tables.some(t=>t.uuid===link.uuid))throw new Error('Table already linked');
  next.tables.push(link);await win.saveShop(next);return true;
 }
 const row=target.closest?.('[data-table-uuid]');
 const id=row?.dataset?.tableUuid;
 const link=(win.shop.tables??[]).find(x=>x.uuid===id);
 if(action==='save-table-count'){
  if(!link)throw new Error('Linked table not found');
  const n=Number(row.querySelector('[data-field="table-count"]')?.value);
  const next=structuredClone(win.shop);
  const targetLink=next.tables.find(x=>x.uuid===id);
  targetLink.rolls=tableLink({...targetLink,rolls:n}).rolls;
  await win.saveShop(next);return true;
 }
 if(action==='unlink-table'){
  if(!link)throw new Error('Linked table not found');
  if(!await globalThis.confirm?.('Remove '+link.name+' from this shop’s Rollable Tables? Existing merchant stock will not be deleted.'))return true;
  const next=structuredClone(win.shop);next.tables=next.tables.filter(x=>x.uuid!==id);
  await win.saveShop(next);return true;
 }
 if(action==='roll-one-table'||action==='roll-all-tables'){
  const links=action==='roll-one-table'?(link?[link]:[]):(win.shop.tables??[]);
  // Read changed roll-count fields before rolling without forcing a full save.
  const updated=links.map(v=>{
   const el=win.element?.querySelector?.('[data-table-uuid="'+v.uuid+'"]');
   const n=Number(el?.querySelector?.('[data-field="table-count"]')?.value??v.rolls);
   return tableLink({...v,rolls:n});
  });
  return await roll(win,updated),true;
 }
 if(action==='clear-rolled'){state.preview=[];state.unresolved=[];state.status='';win.render();return true;}
 if(action==='add-all-rolled'){await addPreview(win,true,0);return true;}
 const p=Number(target.closest?.('[data-preview-index]')?.dataset.previewIndex);
 if(!Number.isSafeInteger(p)||p<0||p>=state.preview.length)throw new Error('Rolled Item no longer exists');
 if(action==='remove-one-rolled'){
  capturePreview(win);state.preview.splice(p,1);win.render();return true;
 }
 if(action==='add-one-rolled'){await addPreview(win,false,p);return true;}
 return false;
}
