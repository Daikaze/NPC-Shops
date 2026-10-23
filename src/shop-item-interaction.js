/** Native v11/v14 NPC Shops item preview + paid drag/drop helpers.
 * Never advertise a free "Item" drag payload to an ActorSheet. Only the GM
 * validated trade endpoint can deliver inventory after charging the buyer.
 */
export const SHOP_ITEM_DRAG_TYPE="NPCShopsPurchase";
export function shopDragPayload(merchantId,skuId){
 if(typeof merchantId!=="string"||!merchantId||typeof skuId!=="string"||!skuId)
   throw new Error("Invalid merchant Item drag");
 return JSON.stringify({type:SHOP_ITEM_DRAG_TYPE,merchantId,skuId,quantity:1});
}
export function parseShopDrag(text){
 try{
  if(typeof text!=="string"||text.length>4096)return null;
  const d=JSON.parse(text);
  if(d?.type!==SHOP_ITEM_DRAG_TYPE||typeof d.merchantId!=="string"||
     typeof d.skuId!=="string"||!d.merchantId||!d.skuId||
     d.merchantId.length>256||d.skuId.length>256||d.quantity!==1)return null;
  return {merchantId:d.merchantId,skuId:d.skuId,quantity:1};
 }catch{return null;}
}
export function dragPayloadFromEvent(event){
 for(const type of ["application/x-npc-shops","text/plain","application/json"]){
  const value=event?.dataTransfer?.getData?.(type);
  const match=parseShopDrag(value);
  if(match)return match;
 }
 return null;
}
export function dropActorFromEvent(event,{
 actors=globalThis.game?.actors,
 apps=globalThis.ui?.windows,
 instanceApps=globalThis.foundry?.applications?.instances
}={}){
 const root=event?.target?.closest?.(
  '[data-actor-id],[data-document-id],[data-document-uuid],[data-uuid],[data-appid],[data-application-id]'
 );
 if(!root)return null;
 const d=root.dataset??{};
 for(const id of [d.actorId,d.documentId,d.documentUuid,d.uuid]){
  if(!id)continue;
  const key=String(id).startsWith('Actor.')?String(id).slice(6):String(id);
  const actor=actors?.get?.(key);
  if(actor?.documentName==='Actor'||actor?.type==="character"||actor?.type==="npc")
    return actor;
 }
 const id=d.appid??d.applicationId;
 const app=(apps?.[id]??apps?.get?.(id))??(instanceApps?.[id]??instanceApps?.get?.(id));
 const actor=app?.actor??app?.document;
 return actor?.documentName==='Actor'||actor?.type==="character"||actor?.type==="npc"?actor:null;
}
/** Item preview is a temporary Foundry Item document; never stored or sold. */
export function openShopItemSheet(data,{
 itemClass=globalThis.CONFIG?.Item?.documentClass
}={}){
 if(typeof itemClass!=='function')throw new Error("Foundry Item document class is unavailable");
 if(!data||typeof data!=="object"||typeof data.name!=="string")
   throw new Error("Merchant Item data is invalid");
 const doc=new itemClass(data,{parent:null});
 if(typeof doc.sheet?.render!=='function')throw new Error("Foundry Item sheet is unavailable");
 doc.sheet.render(true);
 return doc;
}
