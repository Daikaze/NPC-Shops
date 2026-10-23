/** GM-only Compendium Item picker and Rollable Tables workspace. */
import {compendiumPacks,packTitle,browseItemPack,importCompendiumItem,listRollTableChoices} from './compendium.js';
import {normalizeTableLink,rollShopTable,makeRollPreview,stockFromRollPreview} from './tables.js';
import {gpToCp,cpToGp} from './core.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(name,label,extra='')=>`<button type="button" data-action="${name}" ${extra}>${label}</button>`;
const notify=(message,bad=false)=>bad?globalThis.ui?.notifications?.error?.(message):globalThis.ui?.notifications?.info?.(message);
const needsGM=w=>{if(!w.gm)throw new Error('GM only');};
export function initExtras(w) {
  w.compendiumPackId='';w.compendiumQuery='';w.compendiumEntries=[];
  w.compendiumTotal=0;w.compendiumLoadedPack='';
  w.tableChoices=[];w.tableChoiceId='';
  w.rollPreview={items:[],unresolved:[]};w.tableStatus='';
}
const packs=()=>compendiumPacks(game.packs,'Item');
const selectedPack=w=>packs().find(p=>p.collection===w.compendiumPackId);

export function renderCompendiumBrowser(w){
  if(!w.gm)return '';
  return `<details class="ns-compendium" open>
    <summary><i class="fas fa-book"></i> Import from Item Compendium</summary>
    <div class="ns-extra-content">
      <div class="ns-extras-controls">
        <select data-field="compendium-pack" aria-label="Item Compendium">
          <option value="">Select Item Compendium</option>
          ${packs().map(p=>`<option value="${esc(p.collection)}" ${p.collection===w.compendiumPackId?'selected':''}>${esc(packTitle(p))}</option>`).join('')}
        </select>
        <input data-field="compendium-query" type="search" placeholder="Search items..." value="${esc(w.compendiumQuery)}"/>
        ${btn('browse-compendium','Find Items')}
      </div>
      <p class="ns-extras-note">Choose a pack, then add individual items without copying the whole compendium.</p>
      ${w.compendiumEntries.length?`
        <p class="ns-extras-note">${w.compendiumTotal} matches, showing up to 100</p>
        <div class="ns-compendium-items">
          ${w.compendiumEntries.map(e=>`<div class="ns-item" data-compendium-id="${esc(e.id)}">
            <img src="${esc(e.img)}" alt=""/>
            <div class="ns-itemtext"><strong>${esc(e.name)}</strong><small>${esc(e.type||'Item')}</small></div>
            ${btn('import-compendium','Add to Shop')}
          </div>`).join('')}
        </div>`:`<div class="ns-extras-note">${w.compendiumLoadedPack?'No matching physical items.':'Choose an Item Compendium and click Find Items.'}</div>`}
    </div>
  </details>`;
}
export function renderTables(w,shop){
  if(!w.gm)return '';
  const linked=shop.tables??[];
  const previews=w.rollPreview?.items??[],skipped=w.rollPreview?.unresolved??[];
  return `<div class="ns-table-panel">
    <h3>Rollable Tables <small>GM only</small></h3>
    <p class="ns-extras-note">Link world or Compendium RollTables. Roll results are only added to stock when you choose Add All Items.</p>
    <div class="ns-extras-controls">
      <select data-field="table-choice" aria-label="Choose a RollTable">
        <option value="">Select RollTable</option>
        ${w.tableChoices.map(t=>`<option value="${esc(t.uuid)}" ${w.tableChoiceId===t.uuid?'selected':''}>${esc(t.name)} — ${esc(t.source)}</option>`).join('')}
      </select>
      ${btn('browse-tables','Browse Tables')}
      ${btn('add-table','Add Table')}
    </div>
    <div class="ns-drop" data-drop="table">Or drag a RollTable here from Tables or a Compendium</div>
    ${linked.length ? linked.map(raw=>{
      const t=normalizeTableLink(raw);
      return `<div class="ns-table-entry" data-table-uuid="${esc(t.uuid)}">
        <div class="ns-itemtext"><strong>${esc(t.name)}</strong><small>${esc(t.uuid)}</small></div>
        <label>Rolls <input data-field="table-rolls" type="number" min="1" max="50" value="${t.rolls}"/></label>
        <label><input data-field="table-enabled" type="checkbox" ${t.enabled?'checked':''}/> Roll All</label>
        ${btn('roll-one-table','Roll') + btn('save-table','Save') + btn('remove-table','×')}
      </div>`;
    }).join(''):'<div class="ns-extras-note">No linked RollTables yet.</div>'}
    <div class="ns-table-settings">
      <label><input type="checkbox" data-field="auto-text-loot" ${shop.autoTextLoot!==false?'checked':''}/>
        Generate basic Loot from text-only results</label>
      <label>Fallback Loot Price (GP) <input data-field="text-loot-price" type="number" min="0" step="0.01" value="${cpToGp(shop.textLootPriceCp??0)}"/></label>
      ${btn('save-table-settings','Save Settings')}
    </div>
    <div class="ns-extras-controls">
      ${btn('roll-all-tables','Roll All Tables',!linked.some(t=>t.enabled!==false)?'disabled':'')}
      ${btn('clear-table-preview','Clear Preview')}
    </div>
    ${w.tableStatus?`<p class="ns-extras-note">${esc(w.tableStatus)}</p>`:''}
    <h3>Rolled Items (${previews.length})</h3>
    ${previews.length?`<div class="ns-rolled-items">
      ${previews.map((entry,i)=>`<div class="ns-item ns-preview-item" data-preview-index="${i}">
        <img src="${esc(entry.img??'icons/svg/item-bag.svg')}" alt=""/>
        <div class="ns-itemtext"><strong>${esc(entry.name)}</strong><small>${entry.generated?'Basic Loot — text result':'Real Item from Compendium/World'}</small></div>
        <label>Qty <input data-field="preview-qty" type="number" min="1" max="999999" value="${entry.quantity}"/></label>
        <label>GP <input data-field="preview-price" type="number" min="0" step=".01" value="${cpToGp(entry.priceCp)}"/></label>
      </div>`).join('')}
    </div>`:'<div class="ns-extras-note">Nothing rolled yet.</div>'}
    ${btn('add-preview-items','Add All Items',!previews.length?'disabled':'')}
    ${skipped.length?`<details class="ns-unresolved"><summary>Unresolved results (${skipped.length})</summary>
      ${skipped.map(e=>`<div>${esc(e.table)}: ${esc(e.name)}</div>`).join('')}</details>`:''}
  </div>`;
}
export function extraInput(w,event){
  if(event.target.matches?.('[data-field="compendium-query"]')) {w.compendiumQuery=event.target.value;return true;}
  return false;
}
export function extraChange(w,event){
  if(event.target.matches?.('[data-field="compendium-pack"]')){
    w.compendiumPackId=event.target.value;
    w.compendiumEntries=[];w.compendiumTotal=0;w.compendiumLoadedPack='';
    w.render();return true;
  }
  if(event.target.matches?.('[data-field="table-choice"]')){
    w.tableChoiceId=event.target.value;return true;
  }
  return false;
}
export async function extraDrop(w,event){
  needsGM(w);
  const raw=event.dataTransfer.getData('text/plain')||event.dataTransfer.getData('application/json');
  if(!raw)throw new Error('Drop a RollTable from Tables or Compendium');
  const data=JSON.parse(raw);
  let table=data.uuid?await globalThis.fromUuid?.(data.uuid):null;
  if(!table && data.type==='RollTable' && data.id)
    table=data.pack?await game.packs.get(data.pack)?.getDocument(data.id):game.tables?.get(data.id);
  if(table?.documentName!=='RollTable'||!table.uuid)throw new Error('Drop a RollTable document, not an Item');
  await addLinked(w,{uuid:table.uuid,name:table.name,rolls:1,enabled:true});
}
async function addLinked(w,entry){
  const link=normalizeTableLink(entry);
  const next=structuredClone(w.shop);next.tables=next.tables??[];
  if(next.tables.some(t=>t.uuid===link.uuid))throw new Error('RollTable already added');
  next.tables.push(link);
  await w.saveShop(next);
}
async function rollLinks(w,links){
  if(!links.length)throw new Error('Add a RollTable first');
  w.busy=true;
  try{
    const draws=[],errors=[],cache=new Map();
    for(const link of links){
      try{draws.push(await rollShopTable(link,{selectedPackId:w.compendiumPackId,
        autoTextLoot:w.shop.autoTextLoot!==false,textLootPriceCp:w.shop.textLootPriceCp??0,indexCache:cache}));}
      catch(e){errors.push(`${link.name}: ${e.message}`);}
    }
    w.rollPreview=makeRollPreview(draws);
    w.tableStatus=`Rolled ${draws.length}/${links.length} tables. ${w.rollPreview.items.length} distinct items. ${errors.join('; ')}`;
    w.render();
    if(errors.length)notify('NPC Shops: '+errors.join('; '),true);
  }finally{w.busy=false;}
}
async function addAllPreview(w){
  if(!w.rollPreview?.items?.length)throw new Error('Roll Tables first');
  const entries=w.rollPreview.items.map((entry,i)=>{
    const row=w.element?.querySelector?.(`[data-preview-index="${i}"]`);
    if(!row)throw new Error('Missing preview row');
    const quantity=Number(row.querySelector('[data-field="preview-qty"]').value);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>999999)throw new Error('Invalid quantity');
    const priceCp=gpToCp(row.querySelector('[data-field="preview-price"]').value);
    return {...entry,quantity,priceCp};
  });
  const next=structuredClone(w.shop);
  next.stock=stockFromRollPreview(next.stock,{items:entries});
  await w.saveShop(next);
  w.rollPreview={items:[],unresolved:[]};
  w.tableStatus=`Added ${entries.length} different Items to merchant stock.`;
  w.render();
}
/** Returns true when handled (false lets core Buy/Sell/Manage handler continue). */
export async function extraClick(w,action,target){
  const ours=['browse-compendium','import-compendium','browse-tables','add-table',
    'clear-table-preview','save-table-settings','roll-one-table','roll-all-tables',
    'save-table','remove-table','add-preview-items'];
  if(!ours.includes(action))return false;
  needsGM(w);
  if(action==='browse-compendium'){
    const pack=selectedPack(w);if(!pack)throw new Error('Select an Item Compendium');
    const result=await browseItemPack(pack,w.compendiumQuery);
    w.compendiumEntries=result.entries;w.compendiumTotal=result.total;w.compendiumLoadedPack=pack.collection;
    w.render();return true;
  }
  if(action==='import-compendium'){
    const pack=selectedPack(w);if(!pack)throw new Error('Select an Item Compendium');
    const id=target.closest('[data-compendium-id]')?.dataset.compendiumId;
    const entry=await importCompendiumItem(pack,id);
    const next=structuredClone(w.shop);next.stock.push(entry);
    await w.saveShop(next);
    notify('Added '+entry.item.name+' to shop.');
    return true;
  }
  if(action==='browse-tables'){
    w.tableChoices=await listRollTableChoices({tables:game.tables,packs:game.packs});
    w.tableChoiceId=w.tableChoices[0]?.uuid??'';
    w.render();return true;
  }
  if(action==='add-table'){
    const table=w.tableChoices.find(t=>t.uuid===w.tableChoiceId);
    if(!table)throw new Error('Choose a RollTable first');
    await addLinked(w,table);return true;
  }
  if(action==='clear-table-preview'){
    w.rollPreview={items:[],unresolved:[]};w.tableStatus='';w.render();return true;
  }
  if(action==='add-preview-items'){await addAllPreview(w);return true;}
  if(action==='save-table-settings'){
    const next=structuredClone(w.shop);
    next.autoTextLoot=!!w.element.querySelector('[data-field="auto-text-loot"]')?.checked;
    next.textLootPriceCp=gpToCp(w.element.querySelector('[data-field="text-loot-price"]').value);
    await w.saveShop(next);return true;
  }
  const next=structuredClone(w.shop);next.tables=next.tables??[];
  const row=target.closest('[data-table-uuid]');
  const uuid=row?.dataset.tableUuid;
  const found=next.tables.find(t=>t.uuid===uuid);
  if(action==='remove-table'){
    next.tables=next.tables.filter(t=>t.uuid!==uuid);
    await w.saveShop(next);return true;
  }
  if(action==='save-table'){
    if(!found)throw new Error('RollTable no longer linked');
    found.rolls=Number(row.querySelector('[data-field="table-rolls"]').value);
    found.enabled=row.querySelector('[data-field="table-enabled"]').checked;
    normalizeTableLink(found);
    await w.saveShop(next);return true;
  }
  if(action==='roll-one-table'){await rollLinks(w,[found].filter(Boolean));return true;}
  if(action==='roll-all-tables'){await rollLinks(w,next.tables.filter(t=>t.enabled!==false));return true;}
  return false;
}
