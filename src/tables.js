/** NPC Shops: optional integration with Foundry RollTables, including 5etools/Plutonium imports.
 * Does not require Plutonium or Item Piles to be installed.
 * Table results must reference an Item, or have an unambiguous exact Item name.
 */
import {assertInt, itemPriceCp, SALEABLE_TYPES, stockCopy} from './core.js';

const PREFERRED_PACK = /plutonium|5etools|5e\.tools/i;
const str = value => String(value ?? '').trim();
const unique = (list, key) => [...new Map(list.map(x => [key(x), x])).values()];

export function makeTableLink(table) {
  if (!table || table.documentName !== 'RollTable' || !table.uuid) throw new Error('Drop a RollTable, not an Item or Actor');
  return {uuid:table.uuid, name:table.name, rolls:1, enabled:true};
}
export function normalizeTableLink(value) {
  const uuid = str(value?.uuid);
  if (!uuid || uuid.length > 400) throw new Error('RollTable UUID is missing or invalid');
  return {uuid, name:str(value.name).slice(0,200) || 'RollTable', rolls:assertInt(value.rolls ?? 1,1,50),enabled:value.enabled !== false};
}
export function tableChoices(worldTables = [], indexedPacks = []) {
  return unique([...worldTables,...indexedPacks].filter(t => t?.uuid && t?.name),t=>t.uuid)
    .sort((a,b)=>a.name.localeCompare(b.name));
}
export async function indexTableCompendiums(packs) {
  const result=[];
  for (const pack of packs ?? []) {
    if (pack.documentName !== 'RollTable') continue;
    try {
      const index = await pack.getIndex();
      for (const entry of index) result.push({uuid:`Compendium.${pack.collection}.${entry._id ?? entry.id}`,name:`${entry.name} (${pack.metadata?.label ?? pack.title ?? pack.collection})`});
    } catch(err) {console.warn(`NPC Shops: Cannot index table compendium ${pack.collection}`,err);}
  }
  return result;
}

export function itemReferenceCandidates(result) {
  const refs=[];
  const uuid=str(result?.documentUuid ?? result?.uuid);
  if (uuid) refs.push(uuid);
  const coll = str(result?.documentCollection);
  const id = str(result?.documentId);
  if (coll && id) {
    if (coll === 'Item' || coll === 'items') refs.push(`Item.${id}`);
    else if (coll.startsWith('Compendium.')) refs.push(`${coll}.${id}`);
    else if (coll.includes('.')) refs.push(`Compendium.${coll}.${id}`);
  }
  const raw=str(result?.text);
  // Core / Plutonium entries can link an item in text markup rather than a document result.
  for (const [,val] of raw.matchAll(/@UUID\[([^\]]+)\]/g)) refs.push(val);
  for (const [,val] of raw.matchAll(/@Compendium\[([^\]]+)\]/g)) refs.push(val.startsWith('Compendium.') ? val : `Compendium.${val}`);
  for (const [,val] of raw.matchAll(/data-uuid\s*=\s*["']([^"']+)["']/gi)) refs.push(val);
  return [...new Set(refs)].filter(x => x.length < 500);
}
export function resultPlainName(value) {
  return str(value).replace(/@(?:UUID|Compendium)\[[^\]]+\](?:\{([^}]+)\})?/g, (_,label) => label ?? '')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
const isItem = document => document?.documentName === 'Item' && SALEABLE_TYPES.has(document.type);
async function resolveFromReferences(result, fromUuidFn) {
  for (const ref of itemReferenceCandidates(result)) {
    try {
      const document = await fromUuidFn(ref);
      if (isItem(document)) return document;
    } catch (err) { console.debug('NPC Shops: Unresolved table result reference', ref, err); }
  }
  return null;
}

/** Exact name fallback: prefer a unique world Item, then a unique Plutonium/5etools compendium Item.
 * Avoid silently choosing among multiple matches with different item definitions.
 */
export async function findImportedItemByName(name, {items, packs}) {
  const normalized = str(name).toLocaleLowerCase();
  if (!normalized) return null;
  const world = (items?.contents ?? []).filter(item => isItem(item) && item.name?.toLocaleLowerCase() === normalized);
  if (world.length === 1) return world[0];
  if (world.length > 1) return null;
  const itemPacks=[...(packs ?? [])].filter(p => p.documentName === 'Item');
  // Prefer known Plutonium/5etools compendiums, but permit custom-named packs.
  const relevant=itemPacks.filter(p=>PREFERRED_PACK.test(`${p.collection} ${p.title ?? ''} ${p.metadata?.label ?? ''}`));
  const other=itemPacks.filter(p=>!relevant.includes(p));
  for (const group of [relevant,other]) {
    const candidates=[];
    for (const pack of group) {
      try {
        const index = await pack.getIndex();
        for (const x of index) if (x.name?.toLocaleLowerCase() === normalized) candidates.push({pack,id:x._id ?? x.id});
      } catch(err) {console.warn(`NPC Shops: Unable to search item pack ${pack.collection}`,err);}
    }
    if (candidates.length > 1) return null;
    if (candidates.length === 1) {
      const document=await candidates[0].pack.getDocument(candidates[0].id);
      return isItem(document) ? document : null;
    }
  }
  return null;
}
export async function resolveTableItem(result, {fromUuidFn=globalThis.fromUuid, items=globalThis.game?.items,packs=globalThis.game?.packs}={}) {
  if (typeof fromUuidFn === 'function') {
    const direct = await resolveFromReferences(result,fromUuidFn);
    if (direct) return direct;
  }
  const name=resultPlainName(result?.text);
  if (!name) return null;
  return findImportedItemByName(name,{items,packs});
}
export async function rollLinkedTable(link,{fromUuidFn=globalThis.fromUuid,items=globalThis.game?.items,packs=globalThis.game?.packs}={}) {
  const conf=normalizeTableLink(link);
  if (typeof fromUuidFn !== 'function') throw new Error('Foundry fromUuid API is missing');
  const table=await fromUuidFn(conf.uuid);
  if (!table || table.documentName !== 'RollTable') throw new Error(`RollTable unavailable: ${conf.name}`);
  const resolved=[],unresolved=[];
  for (let n=0;n<conf.rolls;n++) {
    // .roll is a non-consuming roll and never posts secret GM results to player chat.
    const draw=await table.roll({recursive:true});
    for (const r of draw.results ?? []) {
      const item=await resolveTableItem(r,{fromUuidFn,items,packs});
      if (!item) {unresolved.push(resultPlainName(r.text) || r.documentId || 'Unknown table result');continue;}
      const qty=Number(item.system?.quantity ?? 1);
      const quantity=Number.isSafeInteger(qty) && qty>0 && qty<=9999 ? qty : 1;
      resolved.push({document:item,quantity});
    }
  }
  return {table:table.name,resolved,unresolved};
}
export function aggregatePreview(draws) {
  const grouped=new Map(), skipped=[];
  for (const draw of draws) {
    skipped.push(...(draw.unresolved??[]).map(text=>({table:draw.table, text:String(text)})));
    for (const entry of draw.resolved??[]) {
      const doc=entry.document;
      const uuid=doc.uuid || `${doc.type}:${doc.name}`;
      const key=`${uuid}|${itemPriceCp(doc)}`;
      const old=grouped.get(key);
      if (old) old.quantity=assertInt(old.quantity+entry.quantity,1,999999);
      else grouped.set(key,{uuid,name:doc.name,img:doc.img,type:doc.type,quantity:entry.quantity,priceCp:itemPriceCp(doc),document:doc});
    }
  }
  return {items:[...grouped.values()],skipped};
}
export function addPreviewToStock(stock,preview) {
  const next=structuredClone(stock ?? []);
  for (const entry of preview?.items ?? []) {
    const existing=next.find(s=>s.sourceUuid === entry.uuid && !s.unlimited && s.priceCp === entry.priceCp);
    if (existing) existing.quantity=assertInt(existing.quantity+entry.quantity,0,999999);
    else {
      const newEntry=stockCopy(entry.document, entry.quantity, entry.priceCp);
      newEntry.sourceUuid=entry.uuid;
      next.push(newEntry);
    }
  }
  return next;
}
