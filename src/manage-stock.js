import {gpToCp} from './core.js';

/** Convert every rendered Manage/Stock row into validated changes.
 * Hidden/search-filtered rows remain in the DOM, so Save All includes them.
 * Throws before persistence if ANY row is invalid.
 */
export function collectStockEdits(rows) {
  const changes=new Map();
  for (const row of rows??[]) {
    const id=row?.dataset?.sku;
    if(!id || changes.has(id)) throw new Error('Invalid or duplicated stock row');
    const priceField=row.querySelector?.('[data-field="price"]');
    const stockField=row.querySelector?.('[data-field="stock"]');
    const unlimited=row.querySelector?.('[data-field="unlimited"]');
    if(!priceField||!stockField||!unlimited)throw new Error('Missing stock editor for '+id);
    const priceValue=String(priceField.value??'').trim();
    const amountValue=String(stockField.value??'').trim();
    if(!priceValue || !amountValue)throw new Error('Price and Stock cannot be empty');
    const priceCp=gpToCp(priceValue);
    const quantity=Number(amountValue);
    if(!Number.isSafeInteger(quantity)||quantity<0||quantity>999999)
      throw new Error('Stock must be a whole number from 0 to 999999');
    changes.set(id,{priceCp,quantity,unlimited:!!unlimited.checked});
  }
  return changes;
}
/** Return a new merchant record without altering non-stock properties. */
export function applyStockEdits(shop,changes) {
  const next=structuredClone(shop);
  if(!Array.isArray(next.stock))throw new Error('Merchant stock unavailable');
  const saved=new Set();let changed=0;
  for(const entry of next.stock) {
    const update=changes.get(entry.id);
    if(!update)continue;
    if(entry.priceCp!==update.priceCp || entry.quantity!==update.quantity ||
       Boolean(entry.unlimited)!==update.unlimited) changed++;
    Object.assign(entry,update);
    saved.add(entry.id);
  }
  for(const id of changes.keys()) if(!saved.has(id))
    throw new Error('Stock changed while editing. Reopen Settings and retry.');
  return {shop:next,rows:saved.size,changed};
}

/** A Buy-tab price change only affects a single merchandise entry.
 * GM-only authorization belongs to ShopWindow; price conversions are checked
 * here so the shop and purchase total use the same copper-precision price.
 */
export function setBuyPrice(shop, skuId, priceGp) {
  if(!skuId || typeof skuId!=='string')throw new Error('Select an Item to price');
  const raw=String(priceGp??'').trim();
  if(!raw)throw new Error('Price cannot be empty');
  const priceCp=gpToCp(raw);
  const next=structuredClone(shop);
  const target=next.stock?.find(entry=>entry.id===skuId);
  if(!target || !target.item)throw new Error('Item is no longer in the shop');
  target.priceCp=priceCp;
  return next;
}
