import {priceToCp,priceCoin,assertInt,priceCoinsTotal,legacyPriceCoins,priceCoinsForEntry} from './core.js';
import {readCoinEditor} from './coin-inputs.js';

/** Convert every rendered Manage/Stock row into validated changes.
 * Hidden/search-filtered rows remain in the DOM, so Save All includes them.
 * Throws before persistence if ANY row is invalid.
 */
export function collectStockEdits(rows) {
  const changes=new Map();
  for (const row of rows??[]) {
    const id=row?.dataset?.sku;
    if(!id || changes.has(id)) throw new Error('Invalid or duplicated stock row');
    const coinPrices=readCoinEditor(row,'price',{allowLegacy:true});
    const priceField=row.querySelector?.('[data-field="price"]');
    const stockField=row.querySelector?.('[data-field="stock"]');
    const denomination=row.querySelector?.('[data-field="price-denomination"]')?.value ?? 'gp';
    const unlimited=row.querySelector?.('[data-field="unlimited"]');
    if(!coinPrices && !priceField || !stockField || !unlimited)throw new Error('Missing stock editor for '+id);
    const priceValue=String(priceField?.value??'').trim();
    const amountValue=String(stockField.value??'').trim();
    if((coinPrices.legacy && !priceValue) || !amountValue)throw new Error('Price and Stock cannot be empty');
    const priceCp=coinPrices.legacy ? priceToCp(priceValue,denomination):coinPrices.totalCp;
    const quantity=Number(amountValue);
    if(!Number.isSafeInteger(quantity)||quantity<0||quantity>999999)
      throw new Error('Stock must be a whole number from 0 to 999999');
    changes.set(id,{priceCp,priceDenomination:denomination,quantity,unlimited:!!unlimited.checked,
      ...(coinPrices.parts ? {priceCoins: coinPrices.parts} : {})});
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
    if(entry.priceCp!==update.priceCp || priceCoin(entry)!==update.priceDenomination ||
       (update.priceCoins && JSON.stringify(priceCoinsForEntry(entry))!==JSON.stringify(update.priceCoins)) ||
       entry.quantity!==update.quantity ||
       Boolean(entry.unlimited)!==update.unlimited) changed++;
    Object.assign(entry,update);
    if(!update.priceCoins)entry.priceCoins=legacyPriceCoins(update.priceCp,update.priceDenomination);
    saved.add(entry.id);
  }
  for(const id of changes.keys()) if(!saved.has(id))
    throw new Error('Stock changed while editing. Reopen Settings and retry.');
  return {shop:next,rows:saved.size,changed};
}

/** Bulk toggle every merchant SKU, including search-hidden stock rows.
 * Pending stock/price edits are saved alongside the unlimited toggle.
 * Quantities are preserved even while inventory is unlimited.
 */
export function setUnlimitedForAll(shop,enabled,edits=null) {
 if(typeof enabled!=="boolean")throw new Error("Unlimited state must be boolean");
 const base=edits ? applyStockEdits(shop,edits).shop : structuredClone(shop);
 if(!Array.isArray(base.stock))throw new Error("Merchant stock unavailable");
 for(const entry of base.stock)entry.unlimited=enabled;
 return base;
}

/** A Buy-tab price change only affects a single merchandise entry.
 * GM-only authorization belongs to ShopWindow; price conversions are checked
 * here so the shop and purchase total use the same copper-precision price.
 */
export function setBuyPrice(shop, skuId, priceValue, denomination = 'gp') {
  if(!skuId || typeof skuId!=='string')throw new Error('Select an Item to price');
  const priced=priceValue && typeof priceValue==='object' && 'totalCp' in priceValue;
  const priceCp=priced
    ? assertInt(priceValue.totalCp,0,Number.MAX_SAFE_INTEGER)
    : priceToCp(priceValue,denomination);
  const parts=priced && priceValue.parts
    ? Object.fromEntries(Object.keys(legacyPriceCoins(0)).map(coin=>[coin,assertInt(priceValue.parts[coin]??0,0,Number.MAX_SAFE_INTEGER)]))
    : legacyPriceCoins(priceCp,denomination);
  if(priceCoinsTotal(parts)!==priceCp)throw new Error('Price coins do not match total');
  const next=structuredClone(shop);
  const target=next.stock?.find(entry=>entry.id===skuId);
  if(!target || !target.item)throw new Error('Item is no longer in the shop');
  target.priceCp=priceCp;
  target.priceDenomination=typeof priceValue==='object'?'gp':denomination;
  target.priceCoins=parts;
  return next;
}
