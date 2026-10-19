import {MODULE_ID, cpToGp, emptyShop, gpToCp, hasOwnership, itemPriceCp, moneyTotal, shopData, stockCopy, SALEABLE_TYPES} from "./core.js";
import {addPreviewToStock, aggregatePreview, indexTableCompendiums, makeTableLink, normalizeTableLink, rollLinkedTable, tableChoices, textResultAsLoot} from "./tables.js";

const windows = new Map();
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (action, label, extra = "") => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
const notify = (text, error = false) => (error ? ui.notifications.error(text) : ui.notifications.info(text));

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
    this.preview = null; // GM-only ephemeral result previews; never sent to players.
    this.compendiumTables = [];
    this.browsedCompendiums = false;
  }
  get actor() { return game.actors.get(this.actorId); }
  get shop() { return this.gm ? shopData(this.actor) : (this.remoteShop ?? emptyShop()); }
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
      if (!e.target.closest(".ns-header") || e.target.closest("button")) return;
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
    this.element.innerHTML = `
      <header class="ns-header"><div class="ns-identity"><img src="${esc(avatar)}" alt="" /><div><b>${esc(label)}</b><small>NPC Shops · ${this.loading ? 'Loading' : (shop.enabled ? (shop.open ? 'Open' : 'Closed') : 'Not a shop')}</small></div></div>${button('close', '×', 'class="ns-close" aria-label="Close"')}</header>
      <main class="ns-content">
      ${this.gm ? `<div class="ns-gmbar">${!shop.enabled ? button('enable', 'Make Merchant') : `${button('toggle-open', shop.open ? 'Close Shop' : 'Open Shop')}${button('toggle-sell', shop.allowSelling ? 'Disable Selling' : 'Enable Selling')}`}</div>` : ''}
      ${shop.enabled ? `
        <div class="ns-wallet"><label>Shopping as <select data-field="buyer"><option value="">Select character</option>${buyers.map(a => `<option value="${esc(a.id)}" ${buyer?.id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label><div>${buyer ? `${esc(buyer.name)} · ${(moneyTotal(buyer.system.currency) / 100).toFixed(2)} GP` : 'No owned characters'}</div></div>
        <nav class="ns-tabs">${button('tab-buy', 'Buy', `class="${this.mode === 'buy' ? 'active' : ''}"`)}${button('tab-sell', 'Sell', `class="${this.mode === 'sell' ? 'active' : ''}"`)}${this.gm ? `${button('tab-manage', 'Manage', `class="${this.mode === 'manage' ? 'active' : ''}"`)}${button('tab-tables', 'Rollable Tables', `class="${this.mode === 'tables' ? 'active' : ''}"`)}` : ''}</nav>
        ${this.mode === 'buy' ? this.renderBuy(shop, buyer) : this.mode === 'sell' ? this.renderSell(shop, buyer) : this.mode === 'tables' && this.gm ? this.renderTables(shop) : this.renderManage(shop)}
      ` : `<div class="ns-empty">${this.loading ? 'Loading shop items…' : this.gm ? 'Click Make Merchant to enable this NPC as a shop.' : 'Merchant information not available. A GM must be online.'}</div>`}
      </main><footer>Foundry v${esc(game.version || game.release?.generation)} · NPC Shops v0.1.5 alpha</footer>`;
  }
  renderBuy(shop, buyer) {
    if (!shop.open) return '<div class="ns-empty">Shop is currently closed.</div>';
    return `<div class="ns-items">${shop.stock.length ? shop.stock.map(s => `
      <div class="ns-item" data-sku="${esc(s.id)}"><img src="${esc(s.item.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(s.item.name)}</strong><small>${cpToGp(s.priceCp)} GP · ${s.unlimited ? '∞' : esc(s.quantity)} in stock</small></div><input type="number" class="ns-qty" min="1" max="9999" value="1" aria-label="Quantity"/>${button('buy', 'Buy', !buyer || this.busy || (!s.unlimited && s.quantity < 1) ? 'disabled' : '')}</div>
    `).join('') : '<div class="ns-empty">No items for sale. GM: use Manage to add items.</div>'}</div>`;
  }
  renderSell(shop, buyer) {
    if (!shop.open || !shop.allowSelling) return '<div class="ns-empty">Merchant is not buying items.</div>';
    if (!buyer) return '<div class="ns-empty">Select a character you control.</div>';
    const inv = buyer.items.contents.filter(i => SALEABLE_TYPES.has(i.type) && Number(i.system?.quantity ?? 1) > 0);
    return `<div class="ns-items">${inv.length ? inv.map(item => `
      <div class="ns-item" data-item="${esc(item.id)}"><img src="${esc(item.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(item.name)}</strong><small>${cpToGp(Math.floor(itemPriceCp(item) * shop.sellRate))} GP each · Owned: ${esc(item.system?.quantity ?? 1)}</small></div><input type="number" class="ns-qty" min="1" max="9999" value="1" aria-label="Quantity"/>${button('sell', 'Sell', this.busy ? 'disabled' : '')}</div>
    `).join('') : '<div class="ns-empty">No saleable physical items.</div>'}</div>`;
  }
  renderManage(shop) {
    if (!this.gm) return '';
    return `<div class="ns-config"><label>Buyback percentage <input data-field="rate" type="number" min="0" max="100" step="1" value="${Math.round(shop.sellRate * 100)}"/></label>${button('save-rate', 'Save Rate')}</div>
      <div class="ns-drop" data-drop="items">Drag & drop items here from Items, Compendiums or Actor sheets</div>
      <div class="ns-items">${shop.stock.map(s => `<div class="ns-item ns-manage-item" data-sku="${esc(s.id)}"><img src="${esc(s.item.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(s.item.name)}</strong><small>Price GP <input data-field="price" type="number" min="0" step="0.01" value="${cpToGp(s.priceCp)}"/> Stock <input data-field="stock" type="number" min="0" step="1" value="${esc(s.quantity)}"/> <label><input type="checkbox" data-field="unlimited" ${s.unlimited ? 'checked' : ''}/> ∞</label></small></div>${button('save-item', 'Save')}${button('remove', '×')}</div>`).join('')}</div>
      <details class="ns-ledger"><summary>Transaction History (${shop.ledger.length})</summary>${shop.ledger.slice().reverse().map(l => `<div>${esc(l.at?.slice(0,16))}: ${esc(l.actorName)} ${esc(l.kind)} ${esc(l.quantity)} × ${esc(l.itemName)} (${cpToGp(l.totalCp)} GP)</div>`).join('') || 'No transactions yet'}</details>`;
  }
  renderTables(shop) {
    if (!this.gm) return '';
    const tables = Array.isArray(shop.tables) ? shop.tables : [];
    const candidates = tableChoices([
      ...(game.tables?.contents ?? []).map(t => ({uuid:t.uuid,name:t.name}))
    ], this.compendiumTables).filter(t => !tables.some(link => link.uuid === t.uuid));
    const preview = this.preview;
    return `<section class="ns-tables">
      <div class="ns-table-toolbar"><b><i class="fas fa-dice-d20"></i> Rollable Tables</b>
        ${button('roll-all-tables', '<i class="fas fa-dice-d20"></i> Roll All Tables', (!tables.some(t => t.enabled !== false) || this.busy) ? 'disabled' : '')}</div>
      <p class="ns-table-info">Import RollTables and Items through Plutonium, then link tables here. Results with Item document links add real item data to the shop.</p>
      <div class="ns-drop" data-drop="tables">Drag a RollTable here from Roll Tables or a compendium.</div>
      <div class="ns-table-add"><select data-field="table-choice"><option value="">Choose an imported/world RollTable</option>${candidates.map(t => `<option value="${esc(t.uuid)}">${esc(t.name)}</option>`).join('')}</select>
      ${button('add-table', '<i class="fas fa-plus"></i> Add Table')}
      ${button('browse-tables', this.browsedCompendiums ? 'Refresh Compendium Tables' : 'Browse Compendium Tables')}</div>
      <div class="ns-items">${tables.length ? tables.map((t,index) => `<div class="ns-item ns-linked-table" data-table-index="${index}">
      <div class="ns-table-icon"><i class="fas fa-table-list"></i></div>
      <div class="ns-itemtext"><strong>${esc(t.name)}</strong><small title="${esc(t.uuid)}">${esc(t.uuid)}</small><label>Rolls <input data-field="table-rolls" type="number" min="1" max="50" step="1" value="${esc(t.rolls ?? 1)}"/></label>
      <label><input type="checkbox" data-field="table-enabled" ${t.enabled !== false ? 'checked' : ''}/> Include in Roll All</label></div>
      ${button('roll-table', 'Roll')}${button('save-table', 'Save')}${button('remove-table', '×', 'title="Remove table"')}</div>`).join('') : '<div class="ns-empty">No linked RollTables. Drop a table above, or select one from the list.</div>'}</div>
      ${preview ? `<div class="ns-preview"><div class="ns-preview-head"><b>Rolled Items (${preview.items.length})</b><div>${button('add-all-rolled', 'Add All Items', preview.items.length ? '' : 'disabled')}${button('clear-rolled', 'Clear Preview')}</div></div>
      ${preview.items.length ? preview.items.map((x,i)=>`<div class="ns-item" data-preview-index="${i}"><img src="${esc(x.img || 'icons/svg/item-bag.svg')}" alt=""/><div class="ns-itemtext"><strong>${esc(x.name)}</strong><small>× ${x.quantity} · ${cpToGp(x.priceCp)} GP</small></div>${button('add-rolled', 'Add')}</div>`).join('') : '<p class="ns-table-info">No items were resolved from this roll.</p>'}
      ${preview.skipped.length ? `<details class="ns-table-skipped" open><summary>Text-only / Unresolved results (${preview.skipped.length})</summary><p class="ns-table-info">These results are not Item documents. Drag a matching Item from Plutonium/Compendiums onto a row, or explicitly convert a text result into generic Loot (0 GP default; set its price first).</p>${preview.skipped.map((x,i)=>`<div class="ns-unresolved-item" data-unresolved-index="${i}" data-drop="unresolved"><strong>${esc(x.table)}:</strong> ${esc(x.text)}<div class="ns-unresolved-actions"><label>Price (GP) <input type="number" data-field="unresolved-price" step="0.01" min="0" value="0"/></label>${button('convert-text-loot','Convert to Loot')}</div><small>Drop imported Item here to use the actual Item instead.</small></div>`).join('')}</details>` : ''}</div>` : ''}
    </section>`;
  }
  async addLinkedTable(doc) {
    if (!this.gm) throw new Error('GM only');
    const table = makeTableLink(doc);
    const next = structuredClone(this.shop);
    next.tables = Array.isArray(next.tables) ? next.tables : [];
    if (next.tables.some(t=>t.uuid === table.uuid)) throw new Error('This RollTable is already linked to this shop');
    next.tables.push(table);
    await this.saveShop(next);
    notify(`Linked ${table.name} to ${this.actor?.name ?? this.name}`);
  }
  tableConfigFromRow(row) {
    const table = this.shop.tables?.[Number(row?.dataset.tableIndex)];
    if (!table) throw new Error('RollTable entry was not found');
    return normalizeTableLink({...table,rolls:row.querySelector('[data-field="table-rolls"]')?.value ?? table.rolls,enabled:row.querySelector('[data-field="table-enabled"]')?.checked ?? table.enabled});
  }
  async rollTables(links) {
    if (!this.gm) throw new Error('Only a GM can roll shop inventory');
    const active = links.map(normalizeTableLink).filter(t=>t.enabled);
    if (!active.length) throw new Error('Choose at least one enabled RollTable');
    this.preview = null;
    const draws=[];
    for (const table of active) draws.push(await rollLinkedTable(table));
    this.preview = aggregatePreview(draws);
    const found = this.preview.items.reduce((n,x)=>n+x.quantity,0);
    notify(`Rolled ${active.length} table(s): ${found} item(s); ${this.preview.skipped.length} unresolved result(s).`);
  }
  /** Resolve one text-only result to a real imported Item or a manually-created loot item. */
  stageUnresolvedItem(index, item) {
    if (!this.gm || !this.preview?.skipped?.[index]) throw new Error('Unresolved preview row is no longer available');
    if (!item || item.documentName !== 'Item' || !SALEABLE_TYPES.has(item.type)) throw new Error('Drop a supported Item document here');
    const next = aggregatePreview([{table:this.preview.skipped[index].table,resolved:[{document:item,quantity:1}],unresolved:[]}]);
    const entry=next.items[0];
    if(!entry) throw new Error('The dropped item could not be read');
    const existing=this.preview.items.find(i=>i.uuid===entry.uuid && i.priceCp===entry.priceCp);
    if(existing) existing.quantity+=entry.quantity;
    else this.preview.items.push(entry);
    this.preview.skipped.splice(index,1);
    this.render();
  }
  async commitPreview(oneIndex = null) {
    if (!this.gm) throw new Error('Only the GM can add rolled items');
    const items = oneIndex === null ? this.preview?.items ?? [] : [this.preview?.items?.[oneIndex]].filter(Boolean);
    if (!items.length) throw new Error('No rolled items to add');
    const next = structuredClone(this.shop);
    next.stock = addPreviewToStock(next.stock,{items});
    await this.saveShop(next);
    if (oneIndex === null) this.preview = null;
    else this.preview.items.splice(oneIndex,1);
    notify(`Added ${items.reduce((n,x)=>n+x.quantity,0)} item(s) to merchant stock.`);
  }
  bindEvents(el) {
    el.addEventListener("change", e => {
      if (e.target.matches('[data-field="buyer"]')) { this.buyerId = e.target.value; this.render(); }
    });
    el.addEventListener("dragover", e => { if (this.gm && e.target.closest('[data-drop="items"], [data-drop="tables"], [data-drop="unresolved"]')) {e.preventDefault(); e.dataTransfer.dropEffect = 'copy';} });
    el.addEventListener("drop", async e => {
      if (!this.gm) return;
      const tableDrop=!!e.target.closest('[data-drop="tables"]');
      const unresolved=e.target.closest('[data-unresolved-index]');
      if (!tableDrop && !unresolved && !e.target.closest('[data-drop="items"]')) return;
      e.preventDefault();
      try {
        if (unresolved) {
          const item=await this.itemFromDrop(e);
          this.stageUnresolvedItem(Number(unresolved.dataset.unresolvedIndex),item);
        } else if (tableDrop) await this.handleTableDrop(e);
        else await this.handleDrop(e);
      } catch (err) { notify(err.message,true); }
    });
    el.addEventListener("click", async e => {
      const target = e.target.closest("button[data-action]");
      if (!target || this.busy) return;
      const action = target.dataset.action;
      const sku = target.closest("[data-sku]")?.dataset.sku;
      const itemId = target.closest("[data-item]")?.dataset.item;
      try {
        if (action === 'close') return this.close();
        if (action.startsWith('tab-')) {this.mode = action.slice(4); return this.render();}
        if (action === 'convert-text-loot') {
          if(!this.gm) return;
          const row=target.closest('[data-unresolved-index]');
          const index=Number(row?.dataset.unresolvedIndex);
          const skipped=this.preview?.skipped?.[index];
          if(!skipped) throw new Error('Text result is no longer available');
          const priceCp=gpToCp(row.querySelector('[data-field="unresolved-price"]')?.value ?? 0);
          this.stageUnresolvedItem(index,textResultAsLoot(skipped.text,priceCp));
          notify('Text result converted into generic Loot for preview. Review its price before adding to stock.');
          return;
        }
        if (action === 'add-table') {
          if (!this.gm) return;
          const uuid=el.querySelector('[data-field="table-choice"]')?.value;
          if (!uuid) throw new Error('Select a RollTable first');
          const doc=await fromUuid(uuid);
          return await this.addLinkedTable(doc);
        }
        if (action === 'browse-tables') {
          if (!this.gm) return;
          this.busy=true;
          this.compendiumTables=await indexTableCompendiums(game.packs);
          this.browsedCompendiums=true;
          notify(`Found ${this.compendiumTables.length} compendium RollTables`);
          return;
        }
        if (['save-table','remove-table','roll-table','roll-all-tables','add-all-rolled','clear-rolled','add-rolled'].includes(action)) {
          if (!this.gm) return;
          if (action==='clear-rolled') {this.preview=null;return;}
          if (action==='add-all-rolled') {this.busy=true;return await this.commitPreview();}
          if (action==='add-rolled') {this.busy=true;return await this.commitPreview(Number(target.closest('[data-preview-index]')?.dataset.previewIndex));}
          if (action==='roll-all-tables') {
            this.busy=true;
            // Respect unsaved roll counts displayed in each row for this immediate roll.
            const links=[...el.querySelectorAll('[data-table-index]')].map(row=>this.tableConfigFromRow(row));
            return await this.rollTables(links);
          }
          const row=target.closest('[data-table-index]');
          const link=this.tableConfigFromRow(row);
          if (action==='roll-table') {this.busy=true;return await this.rollTables([{...link,enabled:true}]);}
          const next=structuredClone(this.shop);
          if (action==='remove-table') next.tables.splice(Number(row.dataset.tableIndex),1);
          else next.tables[Number(row.dataset.tableIndex)]=link;
          this.preview=null;
          return await this.saveShop(next);
        }
        if (action === 'enable') return await this.saveShop({...emptyShop(), enabled: true});
        if (action === 'toggle-open') return await this.saveShop({...this.shop, open: !this.shop.open});
        if (action === 'toggle-sell') return await this.saveShop({...this.shop, allowSelling: !this.shop.allowSelling});
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
  async saveShop(data) {
    if (!this.gm) throw new Error('GM only');
    if (!this.actor) throw new Error('Could not locate world Actor for merchant');
    await this.actor.setFlag(MODULE_ID, 'shop', data);
    this.render();
  }
  async handleTableDrop(event) {
    const raw=event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('application/json');
    if (!raw) throw new Error('No Foundry RollTable drag data');
    const data=JSON.parse(raw);
    if (data.type !== 'RollTable' && !String(data.uuid ?? '').startsWith('RollTable.') && !String(data.uuid ?? '').startsWith('Compendium.')) throw new Error('Drag a RollTable document here');
    let document=data.uuid ? await fromUuid(data.uuid) : null;
    if (!document && data.type === 'RollTable' && data.pack && data.id) document=await game.packs.get(data.pack)?.getDocument(data.id);
    if (!document && data.type === 'RollTable' && data.id) document=game.tables.get(data.id);
    await this.addLinkedTable(document);
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
export function refreshWindows(actorId) { windows.forEach(win => {if (win.actorId === actorId || win.buyer?.id === actorId) win.refresh();}); }

/** Opened by the persistent Shop button; available even for players who cannot control NPC tokens. */
export async function showDirectory(getDirectory, openMerchant) {
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
  el.innerHTML = `<header class="ns-header"><b><i class="fas fa-store"></i> NPC Shops · Current Scene</b>${button('close-directory', '×', 'class="ns-close"')}</header><main class="ns-content">${data.length ? data.map(s => `<button class="ns-directory-item" type="button" data-id="${esc(s.actorId)}" data-name="${esc(s.name)}" data-img="${esc(s.img)}"><img src="${esc(s.img)}" alt=""/><span>${esc(s.name)}<small>${s.open ? 'Open' : 'Closed'}</small></span></button>`).join('') : '<div class="ns-empty">No available merchant NPCs on this scene. GM: select an NPC and press Alt+S to create a shop.</div>'}</main>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-action="close-directory"]')) return el.remove();
    const btn = e.target.closest('button[data-id]');
    if (btn) {openMerchant({actorId:btn.dataset.id,name:btn.dataset.name,img:btn.dataset.img}); el.remove();}
  });
}
