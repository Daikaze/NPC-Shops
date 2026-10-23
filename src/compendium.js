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

/** Import *every physical Item* in the selected Compendium in safe batches.
 * - Existing stock is never deleted or overwritten.
 * - Identical sourceUuid values are skipped to prevent accidental duplicates.
 * - Each batch is committed before continuing; failures report partial progress.
 * - Index types may be missing on v11 packs: verify each actual document.
 */
export async function importAllCompendiumItems(pack,{
  existingStock=[],
  batchSize=25,
  onBatch,
  onProgress=()=>{}
}={}) {
  if(!isPackType(pack,'Item')||typeof pack?.getDocument!=='function')
    throw new Error('Choose an Item Compendium first');
  if(typeof onBatch!=='function')throw new Error('Missing stock save callback');
  if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>100)throw new Error('Invalid import batch size');
  const index=packIndexItems(await pack.getIndex({fields:['name','type']}));
  const candidates=[...new Set(index.filter(e=>e?.name && (!e.type||SALEABLE_TYPES.has(e.type)))
    .map(e=>indexEntryId(e)).filter(Boolean))];
  const existing=new Set((existingStock??[]).map(s=>s.sourceUuid).filter(Boolean));
  const report={total:candidates.length,added:0,skippedExisting:0,skippedUnsupported:0,failed:0,failedNames:[]};
  let staged=[];
  const flush=async()=>{
    if(!staged.length)return;
    await onBatch(staged);
    report.added+=staged.length;
    staged=[];
    onProgress({...report});
  };
  for(const id of candidates){
    const uuid='Compendium.'+pack.collection+'.'+id;
    if(existing.has(uuid)){report.skippedExisting++;continue;}
    try {
      const item=await pack.getDocument(id);
      if(item?.documentName!=='Item'||!SALEABLE_TYPES.has(item.type)){
        report.skippedUnsupported++;continue;
      }
      const entry=stockCopy(item,1);
      entry.sourceUuid=uuid;
      staged.push(entry);existing.add(uuid);
    } catch(err){
      report.failed++;if(report.failedNames.length<10)report.failedNames.push(id);
      console.warn('NPC Shops: Item Compendium entry could not be loaded',pack.collection,id,err);
    }
    // A failed stock save is fatal, never misreported as a failed Item.
    // Previous batches remain committed; this batch is not counted as added.
    if(staged.length>=batchSize)await flush();
  }
  await flush();
  return report;
}
