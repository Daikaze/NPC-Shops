/** Shop RollTables with real Item resolution and explicit text-to-Loot fallback.
 * v11: TableResult text/documentCollection/documentId.
 * v14: name/description/documentUuid.
 */
import {SALEABLE_TYPES,assertInt,itemPriceCp,stockCopy} from './core.js';
import {compendiumPacks,packIndexItems,indexEntryId} from './compendium.js';

const clean=v=>String(v??'').trim();
const normalize=v=>clean(v).toLocaleLowerCase();
export function normalizeTableLink(link) {
  const uuid=clean(link?.uuid);
  if(!uuid || uuid.length>500) throw new Error('Invalid RollTable reference');
  return {uuid,name:clean(link.name)||'RollTable',rolls:assertInt(link.rolls??1,1,50),enabled:link.enabled!==false};
}
export function textOfResult(result) {
  return [result?.name,result?.text,result?.description].filter(v=>typeof v==='string'&&v.trim());
}
export function plainItemName(text,tableName='') {
  let name=clean(text)
    .replace(/@(?:UUID|Compendium|Item)\[[^\]]+\](?:\{([^}]+)\})?/gi,(_,n)=>n??'')
    .replace(/\{@(?:item|object|reward)\s+([^}|]+)(?:\|[^}]*)?\}/gi,'$1')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s+/g,' ').trim();
  if(tableName && name.toLocaleLowerCase().startsWith(tableName.toLocaleLowerCase())){
    const suffix=name.slice(tableName.length).replace(/^\s*[:\-–—]\s*/,'').trim();
    if(suffix)name=suffix;
  }
  name=name.replace(/^\s*(?:\d+\s*[x×]\s*)/i,'').trim();
  return name.slice(0,180);
}
export function resultRefs(result) {
  const refs=[];
  const id=clean(result?.documentId), coll=clean(result?.documentCollection);
  if(result?.documentUuid) refs.push(clean(result.documentUuid));
  if(result?.uuid && /^(?:Item|Compendium)\./.test(result.uuid))refs.push(clean(result.uuid));
  if(id && coll) {
    if(coll==='Item'||coll==='items')refs.push('Item.'+id);
    else if(coll.startsWith('Compendium.'))refs.push(coll+'.'+id);
    else if(coll.includes('.'))refs.push('Compendium.'+coll+'.'+id);
  }
  for(const text of textOfResult(result)) {
    for(const [,uuid] of text.matchAll(/@UUID\[([^\]]+)\]/gi))refs.push(uuid);
    for(const [,uuid] of text.matchAll(/@Compendium\[([^\]]+)\]/gi))
      refs.push(uuid.startsWith('Compendium.')?uuid:'Compendium.'+uuid);
    for(const [,uuid] of text.matchAll(/@Item\[([^\]]+)\]/gi))
      refs.push(uuid.startsWith('Item.')?uuid:'Item.'+uuid);
    for(const [,uuid] of text.matchAll(/data-(?:uuid|document-uuid)\s*=\s*["']([^"']+)["']/gi))refs.push(uuid);
  }
  return [...new Set(refs.filter(r=>r.length<500))];
}
const isItem=doc=>doc?.documentName==='Item' && SALEABLE_TYPES.has(doc.type);
export function genericLoot(name,priceCp=0) {
  const text=plainItemName(name);
  if(!text)throw new Error('Empty table text result');
  const data={name:text,type:'loot',img:'icons/svg/item-bag.svg',
    system:{quantity:1,price:{value:priceCp/100,denomination:'gp'}},
    flags:{'npc-shops':{generatedTextLoot:true}}};
  return {documentName:'Item',...data,uuid:'NPCShops.TextLoot.'+text,
    toObject:()=>structuredClone(data)};
}
export function itemNamesForResult(result,tableName='') {
  const names=[];
  for(const text of textOfResult(result)) {
    const links=[...text.matchAll(/@(?:UUID|Compendium|Item)\[[^\]]+\]\{([^}]+)\}/gi)].map(x=>x[1]);
    const tags=[...text.matchAll(/\{@item\s+([^}|]+)(?:\|[^}]*)?\}/gi)].map(x=>x[1]);
    for(const s of [...links,...tags,text]) {
      const stripped=plainItemName(s,tableName), whole=plainItemName(s);
      for(const name of [stripped,whole]) {
        if(name && !names.some(n=>normalize(n)===normalize(name)))names.push(name);
      }
    }
  }
  return names;
}
function preferred(pack,selectedId) {
  if(selectedId && pack.collection===selectedId)return 0;
  return /plutonium|5etools|5e\.tools/i.test([pack.collection,pack.title,pack.metadata?.label].join(' '))?1:2;
}
export async function resolveResultItem(result, {
 fromUuidFn=globalThis.fromUuid,items=globalThis.game?.items,packs=globalThis.game?.packs,
 tableName='',selectedPackId='',indexCache=new Map()
}={}) {
  for(const ref of resultRefs(result)) {
    try {const doc=await fromUuidFn?.(ref);if(isItem(doc))return doc;}
    catch(err){console.debug('NPC Shops: unresolvable table item UUID',ref,err);}
  }
  const names=itemNamesForResult(result,tableName);
  for(const name of names) {
    const matches=(items?.contents??[]).filter(i=>isItem(i)&&normalize(i.name)===normalize(name));
    if(matches.length===1)return matches[0];
  }
  const allPacks=compendiumPacks(packs,'Item').sort((a,b)=>preferred(a,selectedPackId)-preferred(b,selectedPackId));
  // A single exact match from the preferred source wins. Ambiguous matches in
  // the same priority tier are rejected; never award a random item.
  for(const tier of [0,1,2]) {
    const matches=[];
    for(const pack of allPacks.filter(p=>preferred(p,selectedPackId)===tier)) {
      try{
        let index=indexCache.get(pack.collection);
        if(!index){index=packIndexItems(await pack.getIndex({fields:['name','type']}));indexCache.set(pack.collection,index);}
        for(const entry of index) if(names.some(n=>normalize(n)===normalize(entry.name))&&indexEntryId(entry))
          matches.push({pack,id:indexEntryId(entry)});
      }catch(err){console.warn('NPC Shops: cannot search Item compendium',pack.collection,err);}
    }
    if(matches.length>1)return null;
    if(matches.length===1){
      try{const doc=await matches[0].pack.getDocument(matches[0].id);if(isItem(doc))return doc;}
      catch(err){console.warn('NPC Shops: compendium Item failed to load',err);}
    }
  }
  return null;
}
export async function rollShopTable(link,{
 fromUuidFn=globalThis.fromUuid,items=globalThis.game?.items,packs=globalThis.game?.packs,
 selectedPackId='',autoTextLoot=true,textLootPriceCp=0,indexCache=new Map()
}={}) {
  const conf=normalizeTableLink(link);
  if(typeof fromUuidFn!=='function')throw new Error('Foundry fromUuid API is unavailable');
  const table=await fromUuidFn(conf.uuid);
  if(!table || table.documentName!=='RollTable')throw new Error('RollTable not found: '+conf.name);
  const resolved=[],unresolved=[];
  for(let n=0;n<conf.rolls;n++){
    // table.roll() does not consume drawn entries and never posts unexpected
    // loot results to player chat. Avoid draw() unless roll is unavailable.
    const draw=typeof table.roll==='function'?await table.roll({recursive:true})
      :await table.draw({displayChat:false,recursive:true});
    for(const result of draw?.results??[]){
      const doc=await resolveResultItem(result,{fromUuidFn,items,packs,tableName:table.name,
        selectedPackId,indexCache});
      if(doc){resolved.push({document:doc,quantity:1,generated:false});continue;}
      const name=itemNamesForResult(result,table.name)[0];
      if(name && autoTextLoot){resolved.push({document:genericLoot(name,textLootPriceCp),quantity:1,generated:true});}
      else unresolved.push(name||'(Empty / unsupported result)');
    }
  }
  return {table:table.name,resolved,unresolved};
}
export function makeRollPreview(draws) {
  const grouped=new Map(),unresolved=[];
  for(const draw of draws??[]){
    for(const name of draw.unresolved??[])unresolved.push({table:draw.table,name});
    for(const {document,quantity=1,generated=false} of draw.resolved??[]){
      if(!isItem(document))continue;
      const uuid=document.uuid??(document.type+':'+document.name);
      const priceCp=itemPriceCp(document);
      const key=uuid+'|'+priceCp;
      if(grouped.has(key)){grouped.get(key).quantity=assertInt(grouped.get(key).quantity+quantity,1,999999);continue;}
      grouped.set(key,{uuid,document,name:document.name,img:document.img,
        quantity:assertInt(quantity,1,999999),priceCp,generated});
    }
  }
  return {items:[...grouped.values()],unresolved};
}
export function stockFromRollPreview(oldStock,preview) {
  const updated=structuredClone(oldStock??[]);
  for(const entry of preview?.items??[]){
    const quantity=assertInt(entry.quantity,1,999999),priceCp=assertInt(entry.priceCp,0,Number.MAX_SAFE_INTEGER);
    const found=updated.find(s=>s.sourceUuid===entry.uuid&&s.priceCp===priceCp&&!s.unlimited);
    if(found){found.quantity=assertInt(found.quantity+quantity,0,999999);continue;}
    const copy=stockCopy(entry.document,quantity,priceCp);
    copy.sourceUuid=entry.uuid;
    updated.push(copy);
  }
  return updated;
}
