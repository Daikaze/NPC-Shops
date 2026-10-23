import {MODULE_ID, cpToGp, emptyShop, gpToCp, hasOwnership, itemPriceCp, moneyTotal, shopData, stockCopy, SALEABLE_TYPES} from "./core.js";
import {groupItems} from "./categories.js";
import {isNpcActor} from "./merchant-types.js";
import {captureWindowState,restoreWindowState} from "./window-state.js";
import {renderMerchantView} from "./merchant-view.js";
import {cartEntries,cartLines,adjustCart,canCheckout} from "./merchant-cart.js";
import {collectStockEdits,applyStockEdits} from "./manage-stock.js";

const windows = new Map();
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (action, label, extra = "") => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
const notify = (text, error = false) => (error ? ui.notifications.error(text) : ui.notifications.info(text));
/** Match item names regardless of case; surrounding spaces in the query are ignored. */
export function matchesItemSearch(name, query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase();
  return !needle || String(name ?? "").toLocaleLowerCase().includes(needle);
}
/** Clear this merchant's ledger only, leaving stock, prices and chat messages untouched. */
export async function clearMerchantHistory(actor, confirmAction = globalThis.confirm) {
  if (!globalThis.game?.user?.isGM) throw new Error('Only a GM can clear transaction history');
  if (!actor?.update || !actor?.getFlag) throw new Error('Merchant is unavailable');
  const current = shopData(actor);
  const count = current.ledger.length;
  if (!count) return {cleared: 0, cancelled: false};
  if (typeof confirmAction !== 'function') throw new Error('Confirmation dialog is unavailable');
  const approved = await confirmAction(`NPC Shops — ${actor.name}\n\nDelete ${count} transaction history entries for this shop?\n\nItems, prices, money, stock, and chat messages will not be changed.\nThis action cannot be undone.`);
  if (!approved) return {cleared: 0, cancelled: true};
  // Update just this nested field, not the entire shop object.
  await actor.update({[`flags.${MODULE_ID}.shop.ledger`]: []});
  if (shopData(actor).ledger.length) throw new Error('History was not cleared; please try again');
  return {cleared: count, cancelled: false};
}


export class ShopWindow {
  constructor(merchant, submit, info) {
    this.actorId = merchant?.actorId ?? merchant?.id;
    this.name = merchant?.name ?? "Merchant";
    this.img = merchant?.img ?? "icons/svg/mystery-man.svg";
    this.submit = submit;
    this.info = info;
    this.mode = "buy";
    this.element = null;
    this.busy = false;
    this.loading = false;
    this.buyerId = null;
    this.remoteShop = null;
    this.categoryState = new Map();
    this.windowState = new Map();
    this.renderedMode = null;
    this.localShop = null;
    this.cart = {buy:new Map(),sell:new Map()};
    this.categoryFilter = {buy:'all',sell:'all'};
    this.settingsPage = 'stock';
    this.searchQueries = {buy: "", sell: "", manage: ""};
  }
  get actor() { return game.actors.get(this.actorId); }
  get shop() { return this.gm ? (this.localShop ?? shopData(this.actor)) : (this.remoteShop ?? emptyShop()); }
  get gm() { return game.user.isGM; }
  get eligibleBuyers() {
    return game.actors.contents.filter(a => hasOwnership(a, game.user) && a.id !== this.actorId && a.system?.currency && ["character", "npc"].includes(a.type));
  }
  get buyer() { return this.eligibleBuyers.find(a => a.id === this.buyerId) ?? this.eligibleBuyers[0]; }
  open() {
    if (!this.element) {
      const el = document.createElement("section");
      el.className = "npc-shops-window";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-label", "NPC Shops");
      document.body.appendChild(el);
      this.element = el;
      this.bindEvents(el);
      this.makeDraggable(el);
    }
    this.element.style.display = "flex";
    this.element.style.zIndex = String(10000 + Math.floor(Math.random() * 500));
    this.render();
    if (!this.gm) this.load();
  }
  async load() {
    if (this.gm || this.loading) return;
    this.loading = true;
    this.render();
    try {
      const result = await this.info(this.actorId);
      if (!result.ok) throw new Error(result.message ?? "Unable to open shop");
      this.remoteShop = result.shop;
      this.name = result.name ?? this.name;
      this.img = result.img ?? this.img;
    } catch (err) { notify(`NPC Shops: ${err.message}`, true); }
    finally { this.loading = false; this.render(); }
  }
  close() { this.element?.remove(); this.element = null; windows.delete(this.actorId); }
  refresh() { if (this.element) this.render(); }
  makeDraggable(el) {
    let origin;
    el.addEventListener("pointerdown", e => {
      if (!e.target.closest(".ns-header,.ns-mp-top") || e.target.closest("button")) return;
      origin = {x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop};
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (!origin) return;
      el.style.left = `${Math.max(0, Math.min(window.innerWidth - 120, origin.left + e.clientX - origin.x))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - 80, origin.top + e.clientY - origin.y))}px`;
      el.style.transform = "none";
    });
    const stop = () => { origin = null; };
    el.addEventListener("pointerup", stop); el.addEventListener("pointercancel", stop);
  }
  render() {
    if (!this.element) return;
    const shop = this.shop;
    const buyers = this.eligibleBuyers;
    if (!buyers.some(a => a.id === this.buyerId)) this.buyerId = buyers[0]?.id ?? null;
    const buyer = this.buyer;
    const actor = this.actor;
    const label = this.gm ? actor?.name ?? this.name : this.name;
    const avatar = this.gm ? actor?.img ?? this.img : this.img;
    captureWindowState(this.element, this.renderedMode, this.windowState);
    // Preserve accordion state across purchases, updates and tab changes.
    for (const section of this.element.querySelectorAll?.(".ns-category[data-category]") ?? []) {
      this.categoryState.set(`${section.dataset.view}:${section.dataset.category}`, section.open);
    }
    this.element.innerHTML = shop.enabled
      ? renderMerchantView(this,shop,buyer,label,avatar)
      : `<header class="ns-mp-top"><span>${esc(label)}</span>${button('close','×','class="ns-close"')}</header>
        <div class="ns-mp-hero"><img src="${esc(avatar)}" class="ns-mp-avatar" alt=""/>
          <div class="ns-mp-intro"><h2>${esc(label)}</h2><p>No merchant shop has been configured.</p></div></div>
        <div class="ns-mp-init">${this.gm && isNpcActor(actor)
          ? button('enable','Make Merchant')
          : 'Only NPC actors may be made merchants.'}</div>`;
    this.renderedMode = this.mode;
    restoreWindowState(this.element, this.renderedMode, this.windowState);
    this.applySearchFilter();
  }
  /** Search stays mounted while filtering so unsaved Manage edits and quantities are preserved. */
  renderSearchInput() {
    return `<label class="ns-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" data-field="item-search" aria-label="Search items" placeholder="Search items..." autocomplete="off" spellcheck="false" value="${esc(this.searchQueries[this.mode] ?? "")}"/></label>`;
  }
  applySearchFilter() {
    if (!this.element?.querySelectorAll) return;
    const query = this.searchQueries[this.mode] ?? "";
    const categories = this.element.querySelectorAll(".ns-items .ns-category");
    let found = false;
    for (const category of categories) {
      let visibleCount = 0;
      for (const row of category.querySelectorAll(".ns-item")) {
        const name = row.querySelector(".ns-itemtext strong")?.textContent ?? "";
        const visible = matchesItemSearch(name, query);
        row.hidden = !visible;
        if (visible) visibleCount++;
      }
      category.hidden = visibleCount === 0;
      if (visibleCount) found = true;
      const count = category.querySelector(".ns-category-count");
      if (count) count.textContent = `${visibleCount} item${visibleCount === 1 ? "" : "s"}`;
    }
    const noResults = this.element.querySelector?.(".ns-no-results");
    if (noResults) noResults.hidden = !String(query).trim() || !categories.length || found;
  }
  /** Collapsible, alphabetically sorted categories. No item data is changed. */
  renderCategories(entries, itemFor, renderRow) {
    return groupItems(entries, itemFor).map(group => {
      const key = `${this.mode}:${group.id}`;
      const isOpen = this.categoryState.get(key) !== false;
      return `<details class="ns-category" data-view="${esc(this.mode)}" data-category="${esc(group.id)}" ${isOpen ? "open" : ""}>
        <summary><span class="ns-category-title"><i class="fas ${group.icon}"></i> ${esc(group.label)}</span><span class="ns-category-count">${group.entries.length} item${group.entries.length===1 ? "" : "s"}</span></summary>
        <div class="ns-category-items">${group.entries.map(renderRow).join("")}</div>
      </details>`;
    }).join("");
  }
  renderBuy(shop, buyer) {
    if (!shop.open) return '<div class="ns-empty">Shop is currently closed.</div>';
    return `<div class="ns-items">${shop.stock.length ? this.renderCategories(shop.stock, s => s.item, s => `
      <div class="ns-item" data-sku="${esc(s.id)}"><img src="${esc(s.item.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(s.item.name)}</strong><small>${cpToGp(s.priceCp)} GP · ${s.unlimited ? '∞' : esc(s.quantity)} in stock</small></div><input type="number" class="ns-qty" min="1" max="9999" value="1" aria-label="Quantity"/>${button('buy', 'Buy', !buyer || this.busy || (!s.unlimited && s.quantity < 1) ? 'disabled' : '')}</div>
    `) : '<div class="ns-empty">No items for sale. GM: use Manage to add items.</div>'}</div>`;
  }
  renderSell(shop, buyer) {
    if (!shop.open || !shop.allowSelling) return '<div class="ns-empty">Merchant is not buying items.</div>';
    if (!buyer) return '<div class="ns-empty">Select a character you control.</div>';
    const inv = buyer.items.contents.filter(i => SALEABLE_TYPES.has(i.type) && Number(i.system?.quantity ?? 1) > 0);
    return `<div class="ns-items">${inv.length ? this.renderCategories(inv, item => item, item => `
      <div class="ns-item" data-item="${esc(item.id)}"><img src="${esc(item.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(item.name)}</strong><small>${cpToGp(Math.floor(itemPriceCp(item) * shop.sellRate))} GP each · Owned: ${esc(item.system?.quantity ?? 1)}</small></div><input type="number" class="ns-qty" min="1" max="9999" value="1" aria-label="Quantity"/>${button('sell', 'Sell', this.busy ? 'disabled' : '')}</div>
    `) : '<div class="ns-empty">No saleable physical items.</div>'}</div>`;
  }
  renderManage(shop) {
    if (!this.gm) return '';
    return `<div class="ns-config"><label>Buyback percentage <input data-field="rate" type="number" min="0" max="100" step="1" value="${Math.round(shop.sellRate * 100)}"/></label>${button('save-rate', 'Save Rate')}</div>
      <div class="ns-save-all-bar">
        <span><i class="fas fa-layer-group"></i> Edit any number of items, then save them together.</span>
        ${button('save-all-stock', '<i class="fas fa-save"></i> Save All', !shop.stock.length ? 'disabled class="ns-save-all"' : 'class="ns-save-all"')}
      </div>
      <div class="ns-drop" data-drop="items">Drag & drop items here from Items, Compendiums or Actor sheets</div>
      <div class="ns-items">${this.renderCategories(shop.stock, s => s.item, s => `<div class="ns-item ns-manage-item" data-sku="${esc(s.id)}"><img src="${esc(s.item.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(s.item.name)}</strong><small>Price GP <input data-field="price" type="number" min="0" step="0.01" value="${cpToGp(s.priceCp)}"/> Stock <input data-field="stock" type="number" min="0" step="1" value="${esc(s.quantity)}"/> <label><input type="checkbox" data-field="unlimited" ${s.unlimited ? 'checked' : ''}/> ∞</label></small></div>${button('save-item', 'Save')}${button('remove', '×')}</div>`)}</div>
      <div class="ns-save-all-bar ns-save-all-bottom">
        <span>Save quantities, prices and unlimited stock for all items.</span>
        ${button('save-all-stock', '<i class="fas fa-save"></i> Save All', !shop.stock.length ? 'disabled class="ns-save-all"' : 'class="ns-save-all"')}
      </div>
      <details class="ns-ledger" data-persist="ledger"><summary>Transaction History (${shop.ledger.length})</summary><div class="ns-ledger-toolbar">${button("clear-history", "Clear History", !shop.ledger.length ? "disabled" : "")}</div>${shop.ledger.slice().reverse().map(l => `<div>${esc(l.at?.slice(0,16))}: ${esc(l.actorName)} ${esc(l.kind)} ${esc(l.quantity)} × ${esc(l.itemName)} (${cpToGp(l.totalCp)} GP)</div>`).join('') || 'No transactions yet'}</details>`;
  }
  bindEvents(el) {
    el.addEventListener("input", e => {
      if (!e.target.matches?.('[data-field="item-search"]')) return;
      this.searchQueries[this.mode] = e.target.value;
      this.applySearchFilter();
    });
    el.addEventListener("change", e => {
      if (e.target.matches('[data-field="buyer"]')) { this.buyerId = e.target.value; this.render(); }
    });
    el.addEventListener("dragover", e => {
      if (this.gm && e.target.closest('[data-drop="items"]')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    el.addEventListener("drop", async e => {
      if (!this.gm || !e.target.closest('[data-drop="items"]')) return;
      e.preventDefault();
      try { await this.handleDrop(e); }
      catch (err) { notify(err.message, true); }
    });
    el.addEventListener("click", async e => {
      const target = e.target.closest("button[data-action]");
      if (!target || this.busy) return;
      const action = target.dataset.action;
      const sku = target.closest("[data-sku]")?.dataset.sku;
      const itemId = target.closest("[data-item]")?.dataset.item;
      try {
        if (action === 'close') return this.close();
        if (action === 'filter-category') {
          this.categoryFilter[this.mode]=target.dataset.category||'all'; return this.render();
        }
        if (action === 'settings-page') {
          if(!this.gm)throw new Error('GM only');
          this.settingsPage=target.dataset.page||'stock';return this.render();
        }
        if (['cart-add','cart-plus','cart-minus','cart-clear','cart-checkout'].includes(action)) {
          if (action==='cart-checkout')return await this.checkoutCart();
          if (action==='cart-clear'){this.cart[this.mode]?.clear();return this.render();}
          if (this.busy || !['buy','sell'].includes(this.mode))return;
          const id=target.dataset.entryId;
          const entry=cartEntries(this.shop,this.buyer,this.mode).find(x=>x.id===id);
          if(!entry)return;
          const cap=this.mode==='buy'?(entry.unlimited?9999:Number(entry.quantity??0)):Number(entry.system?.quantity??1);
          adjustCart(this.cart[this.mode],id,action==='cart-minus'?-1:1,Math.max(0,Math.min(9999,cap)));
          return this.render();
        }
        if (action.startsWith('tab-')) {this.mode = action.slice(4); return this.render();}
        if (action === 'clear-history') {
          if (!this.gm) throw new Error('GM only');
          const result = await clearMerchantHistory(this.actor);
          if (result.cleared) notify(`NPC Shops: Cleared ${result.cleared} transaction(s) for ${this.actor.name}.`);
          return;
        }
        if (action === 'enable') {
          if (!this.gm || !isNpcActor(this.actor)) throw new Error('Only NPC actors can be made merchants');
          return await this.saveShop({...emptyShop(), enabled: true});
        }
        if (action === 'toggle-open') return await this.saveShop({...this.shop, open: !this.shop.open});
        if (action === 'toggle-sell') return await this.saveShop({...this.shop, allowSelling: !this.shop.allowSelling});
        if (action === 'save-all-stock') {
          if (!this.gm || this.mode !== 'manage' || this.settingsPage !== 'stock')
            throw new Error('Only GMs can edit merchant stock');
          const rows = el.querySelectorAll('.ns-manage-item[data-sku]');
          const edits = collectStockEdits(rows);
          if (!edits.size) throw new Error('No items to save');
          const result = applyStockEdits(this.shop, edits);
          // The stock editor also exposes buyback percentage. Save All includes
          // it, rather than leaving a nearby unsaved field behind.
          const rateField=el.querySelector('[data-field="rate"]');
          if (rateField) {
            const n=Number(rateField.value);
            if (!Number.isInteger(n)||n<0||n>100)throw new Error('Buyback must be 0–100%');
            result.shop.sellRate=n/100;
          }
          this.busy=true;
          try {
            await this.saveShop(result.shop); // exactly one persistent shop update
            notify(`NPC Shops: Saved ${result.rows} items (${result.changed} changed).`);
          } finally {this.busy=false;}
          return;
        }
        if (action === 'save-rate') {
          const n = Number(el.querySelector('[data-field="rate"]')?.value);
          if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error('Enter a whole number from 0 to 100');
          return await this.saveShop({...this.shop, sellRate: n / 100});
        }
        if (action === 'save-item' || action === 'remove') {
          if (!this.gm) return;
          const copy = structuredClone(this.shop);
          const entry = copy.stock.find(s => s.id === sku);
          if (!entry) return;
          if (action === 'remove') copy.stock = copy.stock.filter(s => s.id !== sku);
          else {
            const tr = target.closest('.ns-item');
            entry.priceCp = gpToCp(tr.querySelector('[data-field="price"]').value);
            entry.quantity = Number(tr.querySelector('[data-field="stock"]').value);
            if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 0 || entry.quantity > 999999) throw new Error('Invalid stock');
            entry.unlimited = tr.querySelector('[data-field="unlimited"]').checked;
          }
          return await this.saveShop(copy);
        }
        if (action === 'buy' || action === 'sell') {
          if (!this.buyer) throw new Error('Select a character first');
          const quantity = Number(target.closest('.ns-item').querySelector('.ns-qty').value);
          if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) throw new Error('Invalid quantity');
          this.busy = true; target.disabled = true;
          const res = await this.submit({kind: action, merchantId: this.actorId, buyerId: this.buyer.id, skuId: sku, itemId, quantity});
          if (!res.ok) throw new Error(res.message);
          notify(res.message);
          if (!this.gm) await this.load();
        }
      } catch (err) { notify(err.message, true); }
      finally { this.busy = false; this.refresh(); }
    });
  }
  async checkoutCart() {
    if(!['buy','sell'].includes(this.mode) || !canCheckout(this.cart[this.mode],this.shop,this.buyer,this.mode))
      throw new Error('Bill cannot be completed. Check stock, opening status and character funds.');
    if(this.busy)return;
    this.busy=true;
    const mode=this.mode, buyerId=this.buyer.id;
    const lines=cartLines(this.cart[mode],this.shop,this.buyer,mode);
    try {
      for(const entry of lines) {
        const details={kind:mode,merchantId:this.actorId,buyerId,quantity:entry.quantity};
        if(mode==='buy')details.skuId=entry.id;else details.itemId=entry.id;
        const res=await this.submit(details);
        if(!res?.ok)throw new Error(res?.message||'Trade failed');
        this.cart[mode].delete(entry.id);
        notify(res.message);
      }
      if(!this.gm)await this.load();
    } finally {this.busy=false;this.render();}
  }
  async saveShop(data) {
    if (!this.gm) throw new Error('GM only');
    const actor=this.actor;
    if (!actor) throw new Error('Could not locate world Actor for merchant');
    if (!isNpcActor(actor)) throw new Error('Only NPC actors can be managed as merchants');
    const snapshot=structuredClone(data);
    await actor.setFlag(MODULE_ID,'shop',snapshot);
    // Maintain the saved stock as an immediate local snapshot while Foundry
    // propagates Actor updates and while the Buy tab is being opened.
    this.localShop=snapshot;
    this.render();
    try {game.socket?.emit?.(`module.${MODULE_ID}`,{type:'shop-changed',merchantId:this.actorId});}
    catch(err){console.warn('NPC Shops: player refresh notification failed',err);}
  }
  async itemFromDrop(event) {
    const raw=event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('application/json');
    if (!raw) throw new Error('No Foundry Item drag data');
    const data=JSON.parse(raw);
    let document=data.uuid ? await fromUuid(data.uuid) : null;
    if(!document && data.type==='Item' && data.id) document=game.items.get(data.id);
    if(!document && data.type==='Item' && data.pack && data.id) document=await game.packs.get(data.pack)?.getDocument(data.id);
    if(!document && data.type==='Item' && data.data) document=data.data;
    if (!document || !SALEABLE_TYPES.has(document.type)) throw new Error('Drag a physical Item from Items or an Item Compendium');
    if (document.documentName==='Item') return document;
    return { ...document, documentName:'Item', uuid:document.uuid??`NPCShops.Dropped.${document.name}`, toObject:()=>structuredClone(document) };
  }
  async handleDrop(event) {
    const document=await this.itemFromDrop(event);
    const next=structuredClone(this.shop);
    next.stock.push(stockCopy(document,1));
    await this.saveShop(next);
    notify(`Added ${document.name} to shop; edit stock and price in Manage.`);
  }
}

export function openShop(merchant, submit, info) {
  const actorId = merchant?.actorId ?? merchant?.id;
  if (!actorId) return notify('NPC Shops: Missing merchant Actor ID', true);
  let win = windows.get(actorId);
  if (!win) {win = new ShopWindow(merchant, submit, info); windows.set(actorId, win);}
  win.open();
  return win;
}
export function refreshWindows(actorId, reloadRemote = false) {
  windows.forEach(win => {
    if (win.actorId === actorId) {
      if(win.gm)win.localShop=null;
      if(!win.gm && reloadRemote)void win.load();
      else win.refresh();
    } else if(win.buyer?.id === actorId)win.refresh();
  });
}

/** Opened by the persistent Shop button; available even for players who cannot control NPC tokens. */
export async function showDirectory(getDirectory, openMerchant, manageSelected = null) {
  let data;
  try {
    const result = await getDirectory();
    if (!result.ok) throw new Error(result.message);
    data = result.shops;
  } catch (err) {return notify(`NPC Shops: ${err.message}`, true);}
  document.getElementById('npc-shops-directory')?.remove();
  const el = document.createElement('section');
  el.id = 'npc-shops-directory';
  el.className = 'npc-shops-window ns-directory';
  el.innerHTML = `<header class="ns-header"><b><i class="fas fa-store"></i> NPC Shops · Current Scene</b>${button('close-directory', '×', 'class="ns-close"')}</header><main class="ns-content">${manageSelected ? `<div class="ns-directory-manage">${button("manage-selected", '<i class="fas fa-store"></i> Create / Edit Selected Shop')}</div>` : ""}${data.length ? data.map(s => `<button class="ns-directory-item" type="button" data-id="${esc(s.actorId)}" data-name="${esc(s.name)}" data-img="${esc(s.img)}"><img src="${esc(s.img)}" alt=""/><span>${esc(s.name)}<small>${s.open ? 'Open' : 'Closed'}</small></span></button>`).join('') : '<div class="ns-empty">No available merchant NPCs on this scene. GM: select an NPC and press Alt+S to create a shop.</div>'}</main>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-action="close-directory"]')) return el.remove();
    if (e.target.closest('[data-action="manage-selected"]') && manageSelected) { manageSelected(); el.remove(); return; }
    const btn = e.target.closest('button[data-id]');
    if (btn) {openMerchant({actorId:btn.dataset.id,name:btn.dataset.name,img:btn.dataset.img}); el.remove();}
  });
}
