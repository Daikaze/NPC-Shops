/** NPC Shops: optional integration with Foundry RollTables, including 5etools/Plutonium imports.
 * Does not require Plutonium or Item Piles to be installed.
 * Supports v11 text and v14 name/description schemas, direct UUID links, and text-only loot previews.
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

/** v11 uses `text`; v14 uses `name` and HTML `description`. Some 5etools
 * content uses Foundry links, 5etools {@item ...} tags, or HTML anchors.
 */
export function tableResultTexts(result) {
  return [...new Set([result?.text, result?.name, result?.description]
    .filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
}
export function itemReferenceCandidates(result) {
  const refs=[];
  const uuid=str(result?.documentUuid ?? result?.uuid);
  if (uuid) refs.push(uuid);
  const coll=str(result?.documentCollection);
  const id=str(result?.documentId);
  if (coll && id) {
    if (['Item','items'].includes(coll)) refs.push(`Item.${id}`);
    else if (coll.startsWith('Compendium.')) refs.push(`${coll}.${id}`);
    else if (coll.includes('.')) refs.push(`Compendium.${coll}.${id}`);
  }
  for (const raw of tableResultTexts(result)) {
    for (const [,val] of raw.matchAll(/@UUID\[([^\]]+)\]/gi)) refs.push(val);
    for (const [,val] of raw.matchAll(/@Compendium\[([^\]]+)\]/gi)) refs.push(val.startsWith('Compendium.') ? val : `Compendium.${val}`);
    for (const [,val] of raw.matchAll(/@Item\[([^\]]+)\]/gi)) refs.push(val.startsWith('Item.') ? val : `Item.${val}`);
    for (const [,val] of raw.matchAll(/data-(?:uuid|document-uuid)\s*=\s*["']([^"']+)["']/gi)) refs.push(val);
  }
  return [...new Set(refs)].filter(x=>x.length<500);
}
export function resultPlainName(value) {
  return str(value)
    .replace(/@(?:UUID|Compendium|Item)\[[^\]]+\](?:\{([^}]+)\})?/gi,(_,label)=>label??'')
    .replace(/\{@(?:item|object|reward|variantrule)\s+([^}|]+)(?:\|[^}]*)?\}/gi,'$1')
    .replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|#160);/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s+/g,' ').trim();
}
export function nameCandidates(result) {
  const names=[];
  for (const raw of tableResultTexts(result)) {
    const markupLabels=[...raw.matchAll(/@(?:UUID|Compendium|Item)\[[^\]]+\]\{([^}]+)\}/gi)].map(m=>m[1]);
    const toolsLabels=[...raw.matchAll(/\{@item\s+([^}|]+)(?:\|[^}]*)?\}/gi)].map(m=>m[1]);
    for (const candidate of [...markupLabels,...toolsLabels,resultPlainName(raw)]) {
      const clean=str(candidate).replace(/^(?:(?:\d+|\d+d\d+)\s*(?:x|×|of)?\s+)/i,'').replace(/^[-•]\s*/,'').trim();
      if (clean && !names.some(n=>n.toLocaleLowerCase()===clean.toLocaleLowerCase())) names.push(clean);
    }
  }
  return names;
}
export function plainResultLabel(result) {
  const names=nameCandidates(result);
  return names[0] || str(result?.documentId) || 'Unknown table result';
}
const isItem = document => document?.documentName === 'Item' && SALEABLE_TYPES.has(document.type);
async function resolveFromReferences(result, fromUuidFn) {
  for (const ref of itemReferenceCandidates(result)) {
    try {
      const document=await fromUuidFn(ref);
      if (isItem(document)) return document;
    } catch(err) { console.debug('NPC Shops: Unresolved result UUID',ref,err); }
  }
  return null;
}
/** Avoid accidentally importing an unrelated item when two definitions share a name. */
export async function findImportedItemByName(name, {items, packs}) {
  const normalized=str(name).toLocaleLowerCase();
  if (!normalized) return null;
  const world=(items?.contents??[]).filter(item=>isItem(item) && item.name?.toLocaleLowerCase()===normalized);
  if (world.length===1) return world[0];
  if (world.length>1) return null;
  const itemPacks=[...(packs??[])].filter(p=>p.documentName==='Item');
  const relevant=itemPacks.filter(p=>PREFERRED_PACK.test(`${p.collection} ${p.title??''} ${p.metadata?.label??''}`));
  const other=itemPacks.filter(p=>!relevant.includes(p));
  for(const group of [relevant,other]){
    const candidates=[];
    for(const pack of group){
      try{
        const index=await pack.getIndex();
        for(const x of index) if(x.name?.toLocaleLowerCase()===normalized) candidates.push({pack,id:x._id??x.id});
      }catch(err){console.warn(`NPC Shops: Unable to search item pack ${pack.collection}`,err);}
    }
    if(candidates.length>1) return null;
    if(candidates.length===1){
      const doc=await candidates[0].pack.getDocument(candidates[0].id);
      return isItem(doc)?doc:null;
    }
  }
  return null;
}
export async function resolveTableItem(result, {fromUuidFn=globalThis.fromUuid,items=globalThis.game?.items,packs=globalThis.game?.packs}={}) {
  if (typeof fromUuidFn==='function') {
    const direct=await resolveFromReferences(result,fromUuidFn);
    if(direct) return direct;
  }
  for(const name of nameCandidates(result)){
    const match=await findImportedItemByName(name,{items,packs});
    if(match) return match;
  }
  return null;
}
/** Explicit manual conversion only: never fabricate an imported Plutonium item or its price. */
export function textResultAsLoot(text,priceCp=0) {
  const name=resultPlainName(text).slice(0,180);
  if(!name) throw new Error('Cannot create loot from an empty table result');
  const price=assertInt(priceCp,0,Number.MAX_SAFE_INTEGER);
  const data={name,type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:1,price:{value:price/100,denomination:'gp'}},flags:{'npc-shops':{generatedTextLoot:true}}};
  return {documentName:'Item',...data,uuid:`NPCShops.TextLoot.${name}`,toObject:()=>structuredClone(data)};
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
      if (!item) {unresolved.push(plainResultLabel(r));continue;}
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
