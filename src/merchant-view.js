import {groupItems} from './categories.js';
import {cpToGp,moneyTotal,itemPriceCp} from './core.js';
import {cartEntries,cartLines,cartTotal,canCheckout} from './merchant-cart.js';
import {renderMerchantTables} from './merchant-tables-ui.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const button=(a,t,extra='')=>`<button type="button" data-action="${a}" ${extra}>${t}</button>`;
const coin=cp=>`<span class="ns-mp-money"><b>${cpToGp(Math.round(Math.max(0,cp)))}</b><span class="ns-coin" title="Gold pieces" aria-label="gold pieces"><i class="fas fa-coins" aria-hidden="true"></i></span></span>`;
const describeItem=item=>{
 const kind=String(item?.system?.type?.value??item?.type??'Item');
 const type=kind ? kind.charAt(0).toUpperCase()+kind.slice(1) : 'Item';
 const rarity=String(item?.system?.rarity??'').trim();
 const rawWeight=item?.system?.weight?.value??item?.system?.weight;
 const weight=Number(rawWeight);
 return [type,rarity&&rarity.toLowerCase()!=='common'?rarity:'',rawWeight!==undefined&&Number.isFinite(weight)&&weight>0?weight+' lb':'']
   .filter(Boolean).join(' · ');
};
const itemOf=(w,e)=>w.mode==='buy'?e.item:e;
function hero(w,shop,buyer,label,avatar){
 const bal=buyer?.system?.currency?moneyTotal(buyer.system.currency):0;
 return `<header class="ns-mp-top"><span>${esc(label)}</span>${button('close','×','class="ns-close" aria-label="Close"')}</header>
 <div class="ns-mp-hero"><img src="${esc(avatar)}" alt="" class="ns-mp-avatar"/>
 <div class="ns-mp-intro"><h2>${esc(label)}</h2>
 <p class="ns-mp-description">Step inside and browse the wares. Every item has a story; perhaps one of them will become part of yours.</p>
 <div class="ns-mp-meta"><span class="${shop.open?'open':'closed'}"><i class="ns-mp-dot"></i>${shop.open?'Open':'Closed for trade'}</span>
 <span><i class="fas fa-store" aria-hidden="true"></i> Merchant</span>
 <span><i class="fas fa-balance-scale" aria-hidden="true"></i> Sells at list · Buys at ${Math.round(Number(shop.sellRate)*100)}%</span></div></div>
 <div class="ns-mp-purse"><small>BUYING AS</small>
 <div class="ns-mp-picker"><span class="ns-mp-player-initial">${esc((buyer?.name??'?').charAt(0).toUpperCase())}</span>
 <select data-field="buyer" aria-label="Choose trading character"><option value="">Choose character</option>${w.eligibleBuyers.map(a=>`<option value="${esc(a.id)}" ${buyer?.id===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
 <strong>${coin(bal)}</strong></div></div>`;
}
function tabs(w){
 return `<nav class="ns-mp-tabs">${button('tab-buy','<i class="fas fa-shopping-bag"></i> Buy',`class="${w.mode==='buy'?'active':''}"`)}
 ${button('tab-sell','<i class="fas fa-hand-holding-usd"></i> Sell',`class="${w.mode==='sell'?'active':''}"`)}
 ${w.gm?button('tab-manage','<i class="fas fa-sliders-h"></i> Settings <small>GM</small>',`class="${w.mode==='manage'?'active':''}"`):''}</nav>`;
}
function sidebar(w,entries){
 if(w.mode==='manage')return `<aside class="ns-mp-sidebar" data-scroll-key="categories"><small>MERCHANT</small>
 ${[['stock','Stock'],['tables','Rollable Tables'],['terms','Terms'],['history','History']].map(([k,v])=>
 button('settings-page',esc(v),`class="ns-mp-side-btn ${w.settingsPage===k?'active':''}" data-page="${k}"`)).join('')}</aside>`;
 const current=w.categoryFilter[w.mode]??'all';
 const groups=groupItems(entries,e=>itemOf(w,e));
 return `<aside class="ns-mp-sidebar" data-scroll-key="categories"><small>${w.mode==='buy'?'SHELVES':'YOUR PACK'}</small>
 ${button('filter-category',`<i class="fas fa-th-large"></i> All goods <b>${entries.length}</b>`,`data-category="all" class="ns-mp-side-btn ${current==='all'?'active':''}"`)}
 ${groups.map(g=>button('filter-category',`<i class="fas ${g.icon}"></i> ${esc(g.label)} <b>${g.entries.length}</b>`,
 `data-category="${g.id}" class="ns-mp-side-btn ${current===g.id?'active':''}"`)).join('')}
 </aside>`;
}
function catalog(w,shop,buyer,entries){
 const blocked=!shop.open?'Shop is closed.':
   w.mode==='sell'&&!shop.allowSelling?'Merchant is not buying items.':
   w.mode==='sell'&&!buyer?'Choose a character to sell items.':'';
 const groups=groupItems(entries,e=>itemOf(w,e));
 const visible=(w.categoryFilter[w.mode]??'all')==='all'?groups:groups.filter(g=>g.id===w.categoryFilter[w.mode]);
 return `<div class="ns-mp-catalog-head"><strong>${w.mode==='buy'?'Browse the shelves':'Offer your items'}</strong>
 <label class="ns-mp-search"><i class="fas fa-search"></i><input type="search" data-field="item-search" placeholder="Search items..." value="${esc(w.searchQueries[w.mode]??'')}"/></label></div>
 <div class="ns-items ns-mp-stock">${blocked?`<div class="ns-mp-empty">${esc(blocked)}</div>`:visible.map(g=>`<section class="ns-category" data-view="${w.mode}" data-category="${g.id}">
  <h3>${esc(g.label)}</h3>${g.entries.map(entry=>{
  const item=itemOf(w,entry),price=w.mode==='buy'?entry.priceCp:Math.floor(itemPriceCp(entry)*shop.sellRate);
  const stock=w.mode==='buy'?(entry.unlimited?'∞':entry.quantity):(entry.system?.quantity??1);
  const low=stock!== '∞'&&Number(stock)===1;
  const missing=stock!== '∞'&&Number(stock)<1;
  return `<div class="ns-item ns-mp-item" data-entry-id="${esc(entry.id)}">
    <img src="${esc(item.img??'icons/svg/item-bag.svg')}" alt=""/>
    <div class="ns-itemtext"><strong>${esc(item.name)}</strong><small>${esc(describeItem(item))}</small></div>
    <span class="ns-mp-stock-label ${low?'low':''}">${esc(stock==='∞'?'Unlimited':low?'Last one':w.mode==='buy'?stock+' left':'×'+stock)}</span>
    <span class="ns-mp-price">${coin(price)}</span>
    ${button('cart-add','+',`class="ns-mp-add" data-entry-id="${esc(entry.id)}" aria-label="Add to bill" ${missing||!buyer||w.busy?'disabled':''}`)}
  </div>`}).join('')}</section>`).join('')||'<div class="ns-mp-empty">No items in this category.</div>'}</div>`;
}
function settings(w,shop){
 if(w.settingsPage==='tables')return renderMerchantTables(w,shop);
 if(w.settingsPage==='history')return `<div class="ns-mp-settings"><h3>History</h3>
 ${button('clear-history','Clear History',shop.ledger?.length?'':'disabled')}
 ${(shop.ledger??[]).slice().reverse().map(e=>`<p>${esc(e.actorName)} · ${esc(e.kind)} ${esc(e.quantity)} × ${esc(e.itemName)} · ${coin(e.totalCp)}</p>`).join('')||'<p>No transactions yet.</p>'}</div>`;
 if(w.settingsPage==='terms')return `<div class="ns-mp-settings"><h3>Terms</h3><p>Configure this merchant’s terms of trade.</p>
 <div class="ns-mp-terms"><label>Buys at (%) <input data-field="rate" type="number" min="0" max="100" step="1" value="${Math.round(shop.sellRate*100)}"/></label>
 ${button('save-rate','Save Terms')}</div>
 <div class="ns-mp-terms"><span>Shop: ${shop.open?'Open':'Closed'}</span>${button('toggle-open',shop.open?'Close Shop':'Open Shop')}</div>
 <div class="ns-mp-terms"><span>Buy from players: ${shop.allowSelling?'Yes':'No'}</span>${button('toggle-sell',shop.allowSelling?'Disable Selling':'Enable Selling')}</div>
 <div class="ns-mp-danger"><h4>Remove Merchant</h4><p>Deactivate this NPC's shop and hide the merchant icon. Inventory and history are kept for later reactivation.</p>
 ${button('deactivate-merchant','<i class="fas fa-store-slash"></i> Remove Merchant','class="ns-remove-merchant"')}</div></div>`;
 return `<div class="ns-mp-settings"><h3>Merchant Stock</h3><p>Edit quantities and prices below. Saving updates the Buy tab.</p>
 <label class="ns-mp-search"><i class="fas fa-search"></i><input type="search" data-field="item-search" placeholder="Search items..." value="${esc(w.searchQueries.manage??'')}"/></label>
 ${w.renderManage(shop)}
 <div class="ns-mp-danger"><h4>Remove Merchant</h4><p>Stop selling from this NPC without deleting its stock or history.</p>
 ${button('deactivate-merchant','<i class="fas fa-store-slash"></i> Remove Merchant','class="ns-remove-merchant"')}</div></div>`;
}
function bill(w,shop,buyer){
 if(w.mode==='manage')return `<aside class="ns-mp-bill" data-scroll-key="bill"><div class="ns-mp-bill-card"><small>THE MERCHANT</small><h3>${esc(w.name)}</h3><hr/>
 <p>Only the GM can edit merchant prices, stock and rules.</p>
 <div class="ns-mp-bill-total">Items <strong>${shop.stock.length}</strong></div></div></aside>`;
 const lines=cartLines(w.cart[w.mode],shop,buyer,w.mode);
 const total=cartTotal(lines);
 const funds=buyer?.system?.currency?moneyTotal(buyer.system.currency):0;
 return `<aside class="ns-mp-bill" data-scroll-key="bill"><div class="ns-mp-bill-card">
 <small>BILL OF SALE</small><h3>${esc(w.name)}</h3>
 <div class="ns-mp-bill-date">${w.mode==='buy'?'Buying from the merchant':'Selling to the merchant'}</div><hr/>
 <div class="ns-mp-bill-lines">${lines.length?lines.map(l=>`<div class="ns-mp-bill-line"><div>${l.quantity} × ${esc(l.item.name)}<b>${coin(l.quantity*l.priceCp)}</b></div>
 <small>${coin(l.priceCp)} each</small>
 <div class="ns-mp-qty">${button('cart-minus','−',`data-entry-id="${esc(l.id)}"`)}<span>${l.quantity}</span>
 ${button('cart-plus','+',`data-entry-id="${esc(l.id)}"`)}</div></div>`).join(''):'<p class="ns-mp-bill-empty">Choose goods from the shelves to build your bill.</p>'}</div>
 <hr class="ns-mp-double-rule"/><div class="ns-mp-bill-total"><span>${w.mode==='buy'?'SUM OWED':'YOU RECEIVE'}</span><strong>${coin(total)}</strong></div>
 <p class="ns-mp-after">${buyer?esc(buyer.name)+`’s purse after trade: ${coin(w.mode==='buy'?Math.max(0,funds-total):funds+total)}`:'Select a character.'}</p>
 ${button('cart-checkout',`<span class="ns-mp-seal"><i class="fas fa-stamp"></i></span><span>${w.mode==='buy'?'Seal it':'Sell it'} · ${cpToGp(total)} gp</span>`,
 `class="ns-mp-checkout" ${!canCheckout(w.cart[w.mode],shop,buyer,w.mode)||w.busy?'disabled':''}`)}
 ${lines.length?button('cart-clear','Clear bill','class="ns-mp-clear"'):''}
 </div></aside>`;
}
export function renderMerchantView(w,shop,buyer,label,avatar){
 const entries=cartEntries(shop,buyer,w.mode);
 return hero(w,shop,buyer,label,avatar)+tabs(w)+`<main class="ns-content ns-mp-body"><div class="ns-mp-grid">
 ${sidebar(w,entries)}<section class="ns-mp-main" data-scroll-key="catalog">${w.mode==='manage'?settings(w,shop):catalog(w,shop,buyer,entries)}
 <div class="ns-empty ns-no-results" hidden>No items match your search.</div></section>${bill(w,shop,buyer)}
 </div></main><footer>NPC Shops · Foundry v${esc(game.version||game.release?.generation)} · v0.3.4</footer>`;
}
