/** Compendium browser: shared Foundry v11/v14 Item and RollTable document APIs.
 * Works with standard and Plutonium/5etools compendium packs.
 */
import {SALEABLE_TYPES,stockCopy} from './core.js';

export const PACK_SEARCH_LIMIT = 100;
export function collectionValues(values) {
  if (Array.isArray(values)) return values;
  if (values?.contents) return values.contents;
  if (typeof values?.values === 'function') return Array.from(values.values());
  return values && typeof values[Symbol.iterator] === 'function' ? Array.from(values) : [];
}
export function isPackType(pack, type) {
  return pack?.documentName === type || pack?.metadata?.type === type ||
    pack?.metadata?.documentName === type;
}
export function compendiumPacks(packs, type) {
  return collectionValues(packs).filter(p=>isPackType(p,type))
    .sort((a,b)=>String(a.metadata?.label??a.title??a.collection).localeCompare(String(b.metadata?.label??b.title??b.collection)));
}
export function packTitle(pack) {return pack?.metadata?.label ?? pack?.title ?? pack?.collection ?? 'Compendium';}
export function packIndexItems(index) {return collectionValues(index);}
export function indexEntryId(entry) {return String(entry?._id??entry?.id??'');}

export async function browseItemPack(pack, search='', limit=PACK_SEARCH_LIMIT) {
  if (!isPackType(pack,'Item')) throw new Error('Select an Item Compendium');
  const index=packIndexItems(await pack.getIndex({fields:['name','type','img']}));
  const query=String(search).trim().toLocaleLowerCase();
  const matching=index.filter(i=>
    i?.name && (!query||String(i.name).toLocaleLowerCase().includes(query)) &&
    (!i.type || SALEABLE_TYPES.has(i.type))
  ).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return {total:matching.length,entries:matching.slice(0,limit).map(i=>({
    id:indexEntryId(i),name:String(i.name),img:String(i.img??'icons/svg/item-bag.svg'),
    type:String(i.type??'')
  })).filter(i=>i.id)};
}

/** Import a real Item's data into merchant stock; do not import the whole pack
 * or create a new world Item. The existing merchant price/stock editor can
 * then adjust this copy without mutating the compendium source.
 */
export async function importCompendiumItem(pack, itemId, {quantity=1}={}) {
  if (!isPackType(pack,'Item')||typeof pack?.getDocument!=='function') throw new Error('Item Compendium unavailable');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(itemId))) throw new Error('Invalid compendium Item ID');
  const item=await pack.getDocument(itemId);
  if (!item || item.documentName!=='Item' || !SALEABLE_TYPES.has(item.type)) {
    throw new Error('Only physical Item documents can be imported');
  }
  const entry=stockCopy(item,quantity);
  entry.sourceUuid=item.uuid??('Compendium.'+pack.collection+'.'+itemId);
  return entry;
}
export async function listRollTableChoices({tables,packs}) {
  const rows=[];
  for (const table of collectionValues(tables)) {
    if (table?.documentName==='RollTable' && table?.uuid)
      rows.push({uuid:table.uuid,name:table.name,source:'World'});
  }
  for (const pack of compendiumPacks(packs,'RollTable')) {
    try {
      const index=packIndexItems(await pack.getIndex({fields:['name']}));
      for (const e of index) if (indexEntryId(e)&&e.name)
        rows.push({uuid:'Compendium.'+pack.collection+'.'+indexEntryId(e),name:String(e.name),source:packTitle(pack)});
    } catch(err){console.warn('NPC Shops: RollTable compendium unavailable',pack.collection,err);}
  }
  return [...new Map(rows.map(t=>[t.uuid,t])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name));
}
