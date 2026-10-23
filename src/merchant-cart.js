import {itemPriceCp,SALEABLE_TYPES,moneyTotal} from './core.js';
export function cartEntries(shop,buyer,mode){
 if(mode==='buy')return (shop.stock??[]).filter(s=>s?.item);
 if(mode==='sell')return (buyer?.items?.contents??[]).filter(i=>SALEABLE_TYPES.has(i.type)&&Number(i.system?.quantity??1)>0);
 return [];
}
export function cartLines(cart,shop,buyer,mode){
 const result=[];
 for(const [id,wanted] of cart??[]){
   const s=cartEntries(shop,buyer,mode).find(x=>x.id===id);
   if(!s)continue;
   const max=mode==='buy'?(s.unlimited?9999:Number(s.quantity??0)):Number(s.system?.quantity??1);
   if(!Number.isSafeInteger(max)||max<1)continue;
   const quantity=Math.min(Math.max(1,Math.trunc(wanted)),max,9999);
   const cp=mode==='buy'?Number(s.priceCp):Math.floor(itemPriceCp(s)*Number(shop.sellRate??0));
   if(!Number.isSafeInteger(cp)||cp<0)continue;
   result.push({id,item:mode==='buy'?s.item:s,quantity,max,priceCp:cp});
 }
 return result;
}
export function cartTotal(lines){return lines.reduce((sum,s)=>sum+s.quantity*s.priceCp,0);}
export function adjustCart(cart,id,delta,limit){
 const old=Math.max(0,cart.get(id)??0);
 const next=Math.min(limit,old+delta);
 if(next<1)cart.delete(id);else cart.set(id,next);
 return next;
}
export function canCheckout(cart,shop,buyer,mode){
 const lines=cartLines(cart,shop,buyer,mode);
 if(!shop.open||!buyer||!lines.length||mode==='sell'&&!shop.allowSelling)return false;
 return mode!=='buy'||cartTotal(lines)<=moneyTotal(buyer.system.currency);
}
