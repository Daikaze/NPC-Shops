import {MODULE_ID, SALEABLE_TYPES, assertInt, changeWallet, hasOwnership, itemCopy, itemPriceCp, moneyTotal, recordTransaction, shopData, stockCopy, walletCoins} from "./core.js";
import {publishTradeReceipt} from './chat.js';

const locks = new Set();
const processed = new Map();
const ERROR_PREFIX = "NPC Shops: ";
function ensure(condition, msg) { if (!condition) throw new Error(ERROR_PREFIX + msg); }
function currency(actor) { return walletCoins(actor.system?.currency ?? {}); }

/** dnd5e v11 & v14: explicitly update every denomination, then verify the persisted system values. */
export async function setCurrency(actor, next) {
  const target = walletCoins(next);
  const paths = Object.fromEntries(Object.entries(target).map(([coin, value]) => [`system.currency.${coin}`, value]));
  await actor.update(paths);
  const actual = currency(actor);
  if (Object.keys(target).some(coin => actual[coin] !== target[coin])) {
    throw new Error(ERROR_PREFIX + "Currency update did not persist on the character sheet");
  }
}
async function setShop(actor, shop) { await actor.setFlag(MODULE_ID, "shop", shop); }
function logEntry(user, buyer, kind, itemName, quantity, priceCp) {
  return {at: new Date().toISOString(), userId: user.id, actorId: buyer.id, actorName: buyer.name, kind, itemName, quantity, totalCp: priceCp};
}
function validateActors(request) {
  const user = game.users.get(request.userId);
  const merchant = game.actors.get(request.merchantId);
  const buyer = game.actors.get(request.buyerId);
  ensure(user && user.active, "Requester is not connected");
  ensure(merchant && buyer && merchant.id !== buyer.id, "Invalid merchant or character");
  ensure(hasOwnership(buyer, user), "You do not own this character");
  const shop = shopData(merchant);
  ensure(shop.enabled && shop.open, "This shop is closed");
  return {user, merchant, buyer, shop};
}
async function buy({user, merchant, buyer, shop}, request, qty) {
  const sku = shop.stock.find(s => s.id === request.skuId);
  ensure(sku && sku.item, "Item is no longer available");
  ensure(sku.unlimited || (Number.isInteger(sku.quantity) && sku.quantity >= qty), "Not enough stock");
  const priceCp = assertInt(sku.priceCp) * qty;
  ensure(Number.isSafeInteger(priceCp), "Invalid total");
  const before = currency(buyer);
  ensure(moneyTotal(before) >= priceCp, "Not enough coins");
  const nextWallet = changeWallet(before, -priceCp);
  let created = [];
  let moneyAttempted = false;
  try {
    // Debit first. Never deliver a free item if currency update fails or is ignored.
    moneyAttempted = true;
    await setCurrency(buyer, nextWallet);
    created = await buyer.createEmbeddedDocuments("Item", [itemCopy(sku.item, qty)]);
    ensure(created?.length === 1, "Item delivery failed");
    const next = structuredClone(shop);
    const target = next.stock.find(s => s.id === sku.id);
    if (!target.unlimited) target.quantity -= qty;
    await setShop(merchant, recordTransaction(next, logEntry(user, buyer, "buy", sku.item.name, qty, priceCp)));
    return {message: `${buyer.name} bought ${qty} × ${sku.item.name} for ${(priceCp / 100).toFixed(2)} GP`,
      receipt:{kind:'buy',buyerName:buyer.name,userName:user.name,merchantName:merchant.name,itemName:sku.item.name,quantity:qty,totalCp:priceCp}};
  } catch (err) {
    if (created.length) await buyer.deleteEmbeddedDocuments("Item", created.map(i => i.id)).catch(e => console.error("NPC Shops rollback item error", e));
    if (moneyAttempted) await setCurrency(buyer, before).catch(e => console.error("NPC Shops refund error", e));
    throw err;
  }
}
async function sell({user, merchant, buyer, shop}, request, qty) {
  ensure(shop.allowSelling, "This merchant does not buy items");
  const source = buyer.items.get(request.itemId);
  ensure(source && SALEABLE_TYPES.has(source.type), "Item cannot be sold");
  const existingQty = assertInt(source.system?.quantity ?? 1, 0);
  ensure(existingQty >= qty, "Not enough items");
  const rate = Number(shop.sellRate);
  ensure(Number.isFinite(rate) && rate >= 0 && rate <= 1, "Invalid shop selling rate");
  const priceCp = Math.floor(itemPriceCp(source) * rate) * qty;
  ensure(Number.isSafeInteger(priceCp), "Invalid sale total");
  const before = currency(buyer);
  const savedItem = source.toObject();
  let changedInventory = false;
  let moneyAttempted = false;
  try {
    if (existingQty === qty) await buyer.deleteEmbeddedDocuments("Item", [source.id]);
    else await buyer.updateEmbeddedDocuments("Item", [{_id: source.id, "system.quantity": existingQty - qty}]);
    changedInventory = true;
    moneyAttempted = true;
    await setCurrency(buyer, changeWallet(before, priceCp));
    const next = structuredClone(shop);
    const matching = next.stock.find(s => s.item?.name === source.name && s.item?.type === source.type && s.priceCp === itemPriceCp(source) && !s.unlimited);
    if (matching) matching.quantity += qty;
    else next.stock.push(stockCopy(source, qty));
    await setShop(merchant, recordTransaction(next, logEntry(user, buyer, "sell", source.name, qty, priceCp)));
    return {message: `${buyer.name} sold ${qty} × ${source.name} for ${(priceCp / 100).toFixed(2)} GP`,
      receipt:{kind:'sell',buyerName:buyer.name,userName:user.name,merchantName:merchant.name,itemName:source.name,quantity:qty,totalCp:priceCp}};
  } catch (err) {
    if (moneyAttempted) await setCurrency(buyer, before).catch(e => console.error("NPC Shops refund error", e));
    if (changedInventory) {
      const current = buyer.items.get(source.id);
      if (current) await buyer.updateEmbeddedDocuments("Item", [{_id: source.id, "system.quantity": existingQty}]).catch(e => console.error("NPC Shops restore error", e));
      else await buyer.createEmbeddedDocuments("Item", [savedItem], {keepId: true}).catch(e => console.error("NPC Shops restore error", e));
    }
    throw err;
  }
}
export async function executeTrade(request) {
  let key;
  try {
    ensure(game.user.isGM, "Only the GM can process transactions");
    ensure(request && typeof request.requestId === "string" && request.requestId.length <= 100, "Invalid request");
    if (processed.has(request.requestId)) return processed.get(request.requestId);
    key = `${request.merchantId}:${request.buyerId}`;
    ensure(!locks.has(key) && ![...locks].some(k => k.startsWith(`${request.merchantId}:`) || k.endsWith(`:${request.buyerId}`)), "Another transaction is in progress; retry");
    locks.add(key);
    const context = validateActors(request);
    const qty = assertInt(request.quantity, 1, 9999);
    const result = request.kind === "buy" ? await buy(context, request, qty)
      : request.kind === "sell" ? await sell(context, request, qty)
      : (() => {throw new Error("Unknown transaction type")})();
    // Commit success before posting chat to avoid duplicate/failed-chat reruns.
    const response={ok:true,message:result.message};
    processed.set(request.requestId,response);
    if(processed.size>300) processed.delete(processed.keys().next().value);
    try {await publishTradeReceipt(result.receipt);}
    catch(err){console.warn('NPC Shops: Trade completed, but public chat receipt failed',err);}
    return response;
  } catch (err) {
    return {ok: false, message: String(err?.message ?? err)};
  } finally { if (key) locks.delete(key); }
}
