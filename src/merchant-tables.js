/**
 * Item Piles-inspired RollTable stock generation for NPC Shops (v11/v14).
 * All rolling and stock changes are GM-only. Results stay in a preview until
 * explicitly added, avoiding accidental merchant inventory changes.
 * Works independently of Item Piles; no Item Piles assets/code are included.
 */
import {stockCopy,SALEABLE_TYPES,itemPriceCp,assertInt} from './core.js';
const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp);/gi,' ').replace(/\s+/g,' ').trim();
const norm=v=>text(v).toLocaleLowerCase();
const entries=x=>Array.isArray(x)?x:(x?.contents??(typeof x?.values==='function'?[...x.values()]:[]));
export function rollTablePacks(packs=globalThis.game?.packs) {
 return entries(packs).filter(p=>p.documentName==='RollTable'||p.metadata?.type==='RollTable'||p.metadata?.documentName==='RollTable');
}
export function itemPacks(packs=globalThis.game?.packs) {
 return entries(packs).filter(p=>p.documentName==='Item'||p.metadata?.type==='Item'||p.metadata?.documentName==='Item');
}
const indexId=x=>x?._id??x?.id;
export async function listAvailableTables({world=globalThis.game?.tables,packs=globalThis.game?.packs}={}) {
 const result=entries(world).filter(t=>t?.name&&t?.uuid).map(t=>({uuid:t.uuid,name:t.name,source:'World'}));
 for(const pack of rollTablePacks(packs)) {
  try {
   const index=entries(await pack.getIndex({fields:['name']}));
   for(const e of index)if(indexId(e)&&e.name)
    result.push({uuid:'Compendium.'+pack.collection+'.'+indexId(e),name:e.name,source:pack.metadata?.label??pack.title??pack.collection});
  }catch(err){console.warn('NPC Shops: cannot index RollTables',pack.collection,err);}
 }
 return [...new Map(result.map(t=>[t.uuid,t])).values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function tableLink(entry) {
 const uuid=String(entry?.uuid??'').trim();
 if(!uuid||uuid.length>512||!/^(RollTable\.|Compendium\.)/.test(uuid))throw new Error('Invalid RollTable UUID');
 return {uuid,name:String(entry.name??uuid).slice(0,200),rolls:assertInt(entry.rolls??1,1,50)};
}
function resultUUIDs(r) {
 const refs=[r?.documentUuid,r?.uuid].filter(x=>/^(Item\.|Compendium\.)/.test(String(x??'')));
 const collection=String(r?.documentCollection??'');
 if(collection&&r.documentId) refs.push((collection.startsWith('Compendium.')?collection:collection==='Item'?'Item':'Compendium.'+collection)+'.'+r.documentId);
 for(const body of [r?.text,r?.name,r?.description]){
  if(typeof body!=='string')continue;
  for(const m of body.matchAll(/@(?:UUID|Compendium|Item)\[([^\]]+)\]/gi)) {
   const prefix=m[0].match(/^@(\w+)/)?.[1]?.toLowerCase();
   refs.push(prefix==='uuid'?m[1]:prefix==='item'?'Item.'+m[1]:m[1].startsWith('Compendium.')?m[1]:'Compendium.'+m[1]);
  }
 }
 return [...new Set(refs.filter(x=>String(x).length<512))];
}
export function resultName(r,tableName='') {
 const raw=text(r?.name??r?.text??r?.description)
  .replace(/@(?:UUID|Compendium|Item)\[[^\]]+\](?:\{([^}]+)\})?/gi,(_a,name)=>name??'')
  .replace(/\{@item\s+([^}|]+)(?:\|[^}]*)?\}/gi,'$1').trim();
 const prefix=String(tableName).trim();
 if(prefix&&raw.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()+':'))return raw.slice(prefix.length+1).trim();
 return raw.slice(0,180);
}
const isItem=d=>d?.documentName==='Item'&&SALEABLE_TYPES.has(d.type);
function defaultLoot(name) {
 const data={name,type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:1,price:{value:0,denomination:'gp'}},
  flags:{'npc-shops':{textRollResult:true}}};
 return {documentName:'Item',type:'loot',name,img:data.img,uuid:'NPCShops.Text.'+name,
  system:data.system,toObject:()=>structuredClone(data)};
}
export async function resolveRollResult(r,{tableName='',fromUuidFn=globalThis.fromUuid,items=globalThis.game?.items,
 packs=globalThis.game?.packs,indexCache=new Map()}={}) {
 for(const uuid of resultUUIDs(r)){
  try{const doc=await fromUuidFn?.(uuid);if(isItem(doc))return {doc,fallback:false};}
  catch(err){console.debug('NPC Shops: unable to load table result',uuid,err);}
 }
 const name=resultName(r,tableName);
 if(!name)return null;
 const worldMatches=entries(items).filter(i=>isItem(i)&&norm(i.name)===norm(name));
 if(worldMatches.length===1)return {doc:worldMatches[0],fallback:false};
 // Search exact names in available Item compendiums; do not guess near matches.
 for(const pack of itemPacks(packs)){
  try {
   let index=indexCache.get(pack.collection);
   if(!index){index=entries(await pack.getIndex({fields:['name','type']}));indexCache.set(pack.collection,index);}
   const found=index.filter(i=>norm(i.name)===norm(name)&&(i.type===undefined||SALEABLE_TYPES.has(i.type)));
   if(found.length!==1)continue;
   const doc=await pack.getDocument(indexId(found[0]));
   if(isItem(doc))return {doc,fallback:false};
  }catch(err){console.warn('NPC Shops: item compendium lookup failed',pack.collection,err);}
 }
 // The text result is explicitly marked as generic Loot (no made-up stats).
 return {doc:defaultLoot(name),fallback:true};
}
export async function rollMerchantTable(link,{
 fromUuidFn=globalThis.fromUuid,items=globalThis.game?.items,packs=globalThis.game?.packs,
 indexCache=new Map()
}={}) {
 const config=tableLink(link);
 if(typeof fromUuidFn!=='function')throw new Error('Foundry UUID resolution is unavailable');
 const table=await fromUuidFn(config.uuid);
 if(!table||table.documentName!=='RollTable')throw new Error('RollTable not found: '+config.name);
 const rows=[],unresolved=[];
 for(let i=0;i<config.rolls;i++){
  // roll() keeps the table state; draw() fallback never posts results to chat.
  const output=typeof table.roll==='function' ? await table.roll({recursive:true})
    :await table.draw({displayChat:false,recursive:true});
  for(const r of entries(output?.results)){
   const hit=await resolveRollResult(r,{tableName:table.name,fromUuidFn,items,packs,indexCache});
   if(hit)rows.push({doc:hit.doc,quantity:1,fallback:hit.fallback});
   else unresolved.push(String(r?.name??r?.text??'Unnamed result'));
  }
 }
 return {rows,unresolved};
}
export function combineRolled(previous=[],added=[],keep=false) {
 const grouped=new Map();
 for(const row of [...(keep?previous:[]),...added]){
  const doc=row.doc;
  if(!isItem(doc))continue;
  const key=doc.uuid??doc.id??doc.name+':'+doc.type;
  const quantity=assertInt(row.quantity??1,1,999999);
  const existing=grouped.get(key);
  if(existing){existing.quantity=assertInt(existing.quantity+quantity,1,999999);}
  else grouped.set(key,{key,doc,quantity,fallback:!!row.fallback,priceCp:itemPriceCp(doc)});
 }
 return [...grouped.values()];
}
export function commitRolledStock(shop,preview) {
 const next=structuredClone(shop), items=preview??[];
 if(!items.length)throw new Error('Roll first to preview Items');
 next.stock=Array.isArray(next.stock)?next.stock:[];
 for(const entry of items){
  const quantity=assertInt(entry.quantity,1,999999);
  const priceCp=assertInt(entry.priceCp,0,Number.MAX_SAFE_INTEGER);
  const uuid=entry.doc?.uuid??null;
  const existing=next.stock.find(s=>uuid&&s.sourceUuid===uuid&&s.priceCp===priceCp&&!s.unlimited);
  if(existing){existing.quantity=assertInt(existing.quantity+quantity,0,999999);continue;}
  const copy=stockCopy(entry.doc,quantity,priceCp);
  if(uuid)copy.sourceUuid=uuid;
  next.stock.push(copy);
 }
 return next;
}
