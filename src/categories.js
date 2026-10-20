/** Automatically categorize existing v11/v14 D&D 5e items without changing saved stock. */
export const ITEM_CATEGORIES = Object.freeze([
  {id:"weapons",label:"Weapons",icon:"fa-khanda"},
  {id:"armor",label:"Armor & Shields",icon:"fa-shield-alt"},
  {id:"equipment",label:"Equipment",icon:"fa-suitcase"},
  {id:"consumables",label:"Consumables",icon:"fa-flask"},
  {id:"tools",label:"Tools",icon:"fa-tools"},
  {id:"containers",label:"Containers",icon:"fa-box"},
  {id:"loot",label:"Loot & Materials",icon:"fa-gem"},
  {id:"other",label:"Other Items",icon:"fa-box-open"}
]);
const valid = new Set(ITEM_CATEGORIES.map(x=>x.id));
export function itemCategory(item) {
  if (valid.has(item?.category)) return item.category;
  const type=String(item?.type??"").toLowerCase();
  if(type==="weapon") return "weapons";
  if(type==="equipment"){
    const subtype=String(item?.system?.type?.value??item?.system?.type??item?.system?.armor?.type??"").toLowerCase();
    return /^(light|medium|heavy|shield|armor|natural)$/.test(subtype)?"armor":"equipment";
  }
  return ({consumable:"consumables",tool:"tools",container:"containers",loot:"loot"})[type]??"other";
}
export function groupItems(entries,getItem=x=>x){
  const map=new Map(ITEM_CATEGORIES.map(c=>[c.id,{...c,entries:[]}]));
  for(const entry of entries??[])map.get(itemCategory(getItem(entry))).entries.push(entry);
  for(const group of map.values())group.entries.sort((a,b)=>
    String(getItem(a)?.name??"").localeCompare(String(getItem(b)?.name??""),"en",{sensitivity:"base"}));
  return [...map.values()].filter(g=>g.entries.length);
}
