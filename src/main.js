import {MODULE_ID, shopData} from './core.js';
import {executeTrade} from './transactions.js';
import {openShop, refreshWindows} from './ui.js';

const SOCKET = `module.${MODULE_ID}`;
const pending = new Map();
function primaryGM() {
  return game.users.filter(u => u.isGM && u.active).sort((a,b) => a.id.localeCompare(b.id))[0];
}
function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${game.user.id}-${Date.now()}-${Math.random()}`;
}
async function submitTrade(details) {
  const gm = primaryGM();
  if (!gm) return {ok:false, message:'A GM must be online to trade'};
  const packet = {...details, requestId:makeRequestId(), userId:game.user.id};
  if (gm.id === game.user.id) return await executeTrade(packet);
  return await new Promise(resolve => {
    const timer = setTimeout(() => {pending.delete(packet.requestId); resolve({ok:false, message:'GM did not answer the transaction request'});}, 15000);
    pending.set(packet.requestId, result => {clearTimeout(timer); resolve(result);});
    game.socket.emit(SOCKET, {type:'trade', packet});
  });
}
function open(actor) {openShop(actor, submitTrade);}
function selectedActor() {return canvas?.tokens?.controlled?.[0]?.actor ?? null;}
function showFromToken() {
  const actor = selectedActor();
  if (!actor) return ui.notifications.warn('NPC Shops: Select one merchant token first');
  open(actor);
}
function registerTokenHud() {
  Hooks.on('renderTokenHUD', (_app, html) => {
    const actor = canvas?.tokens?.controlled?.[0]?.actor;
    if (!actor || (!game.user.isGM && !shopData(actor).enabled)) return;
    const root = html?.[0] ?? html;
    if (!root?.querySelector || root.querySelector('.npc-shop-hud')) return;
    const btn = document.createElement('button');
    btn.className = 'npc-shop-hud';
    btn.type = 'button';
    btn.title = game.user.isGM ? 'NPC Shops: open / create shop' : 'Open shop';
    btn.innerHTML = '<i class="fas fa-store"></i>';
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); open(actor); });
    (root.querySelector('.col.right') || root.querySelector('.right') || root).appendChild(btn);
  });
}
Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'hotkeyEnabled', {name:'Enable Alt+S shop shortcut', hint:'Select an NPC token, then press Alt+S to open its shop.', scope:'client', config:true, type:Boolean, default:true});
});
Hooks.once('ready', () => {
  if (game.system?.id !== 'dnd5e') {ui.notifications.warn('NPC Shops requires the dnd5e game system'); return;}
  const gen = Number(game.release?.generation ?? String(game.version).split('.')[0]);
  if (![11,14].includes(gen)) console.warn('NPC Shops is currently targeted at v11 and v14; other versions are untested');
  registerTokenHud();
  window.addEventListener('keydown', e => {
    if (!game.settings.get(MODULE_ID,'hotkeyEnabled') || !e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyS') return;
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    e.preventDefault(); showFromToken();
  });
  game.socket.on(SOCKET, async data => {
    if (data?.type === 'result') {
      if (data.userId !== game.user.id) return;
      const callback = pending.get(data.requestId);
      if (callback) {pending.delete(data.requestId); callback(data.result);}
      return;
    }
    if (data?.type !== 'trade' || !game.user.isGM || primaryGM()?.id !== game.user.id) return;
    const packet = data.packet;
    if (!packet || typeof packet.userId !== 'string' || !game.users.get(packet.userId)) return;
    const result = await executeTrade(packet);
    game.socket.emit(SOCKET, {type:'result', userId:packet.userId, requestId:packet.requestId, result});
  });
  Hooks.on('updateActor', actor => refreshWindows(actor.id));
  Hooks.on('createItem', item => {if (item.parent?.documentName === 'Actor') refreshWindows(item.parent.id);});
  Hooks.on('deleteItem', item => {if (item.parent?.documentName === 'Actor') refreshWindows(item.parent.id);});
  Hooks.on('updateItem', item => {if (item.parent?.documentName === 'Actor') refreshWindows(item.parent.id);});
  game.modules.get(MODULE_ID).api = {open, openSelected:showFromToken};
  console.info('NPC Shops 0.1.0 alpha ready; select a token and press Alt+S');
});
