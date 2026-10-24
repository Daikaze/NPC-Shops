import {MODULE_ID, publicShop, shopData, itemCopy} from './core.js';
import {dragPayloadFromEvent,dropActorFromEvent} from './shop-item-interaction.js';
import {executeTrade} from './transactions.js';
import {openShop, refreshWindows, showDirectory} from './ui.js';
import {clampButtonPosition} from './layout.js';
import {TokenShopBadges} from './token-badges.js';
import {injectMerchantHudControl, isTokenHudApplication} from './hud-controls.js';
import {isNpcToken} from './merchant-types.js';
import {authorizeSocketMessage} from './socket-auth.js';

const SOCKET = `module.${MODULE_ID}`;
const pending = new Map();
let tokenBadges;
let badgesScheduled = false;
const pinSyncing = new Set();
const primaryGM = () => game.users.filter(u => u.isGM && u.active).sort((a,b) => a.id.localeCompare(b.id))[0];
const requestId = () => globalThis.crypto?.randomUUID?.() ?? `${game.user.id}-${Date.now()}-${Math.random()}`;
const worldActor = id => game.actors.get(id);

function sceneMerchants(sceneId) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return [];
  const result = [];
  for (const doc of scene.tokens) {
    if (doc.hidden || !doc.actorId) continue;
    const actor = worldActor(doc.actorId);
    if (!actor) continue;
    const shop = shopData(actor);
    if (!shop.enabled) continue;
    result.push({actorId:doc.actorId,tokenId:doc.id,name:doc.name || actor.name,img:doc.texture?.src || actor.img,open:shop.open});
  }
  return result;
}
function shopInfo(id,skuId=null) {
  const actor = worldActor(id);
  if (!actor) return {ok:false,message:'Merchant not found'};
  const shop = shopData(actor);
  if (!shop.enabled) return {ok:false,message:'This NPC is not a merchant'};
  if(skuId!==null){
    const stock=shop.stock.find(s=>s.id===skuId);
    if(!stock?.item) return {ok:false,message:'Item no longer exists in this shop'};
    // Return a temporary Item sheet document payload to the requesting player.
    // The item is NOT delivered to their inventory by an inspection.
    return {ok:true,item:itemCopy(stock.item,1)};
  }
  return {ok:true, name:actor.name, img:actor.img, shop:publicShop(shop)};
}
async function dispatch(packet) {
  if (packet.action === 'trade') return await executeTrade(packet.details);
  if (packet.action === 'shop') return shopInfo(packet.merchantId);
  if (packet.action === 'item') return shopInfo(packet.merchantId,packet.skuId);
  if (packet.action === 'directory') return {ok:true,shops:sceneMerchants(packet.sceneId)};
  return {ok:false,message:'Unknown NPC Shops request'};
}
async function queryGM(action, fields) {
  const gm = primaryGM();
  if (!gm) return {ok:false,message:'A GM must be online to use NPC Shops'};
  const payload = {action, ...fields, requestId:requestId(), userId:game.user.id};
  if (gm.id === game.user.id) return dispatch(payload);
  return new Promise(resolve => {
    const timer = setTimeout(() => {pending.delete(payload.requestId); resolve({ok:false,message:'GM did not answer; please try again'});}, 15000);
    pending.set(payload.requestId, result => {clearTimeout(timer); resolve(result);});
    try {
      game.socket.emit(SOCKET, {type:'request', payload});
    } catch (err) {
      const cb = pending.get(payload.requestId);
      if (cb) cb({ok:false,message:`Could not send shop request: ${err.message}`});
    }
  });
}
function submitTrade(details) { return queryGM('trade', {details:{...details, userId:game.user.id, requestId:requestId()}}); }
function info(merchantId,skuId=null) {
  return skuId===null?queryGM('shop',{merchantId}):queryGM('item',{merchantId,skuId});
}
function descriptorFromToken(token) {
  return {actorId:token.document.actorId,name:token.name || token.actor?.name || 'Merchant',img:token.document.texture?.src || token.actor?.img};
}
function open(merchant) {return openShop(merchant,submitTrade,info);}
/** Paid drop into v11/v14 Actor sheets. No native Item copy is ever emitted. */
function installPaidItemDrops(){
  globalThis.document?.addEventListener?.('drop',async event=>{
    const drag=dragPayloadFromEvent(event);
    if(!drag)return;
    if(event.target?.closest?.('.npc-shops-window'))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor=dropActorFromEvent(event);
    if(!actor){
      ui.notifications.warn('NPC Shops: Drop the shop Item onto an open character sheet to purchase it.');
      return;
    }
    try{
      const result=await submitTrade({kind:'buy',merchantId:drag.merchantId,buyerId:actor.id,
        skuId:drag.skuId,quantity:1});
      if(!result.ok)throw new Error(result.message??'Purchase failed');
      ui.notifications.info('NPC Shops: '+result.message);
      refreshWindows(drag.merchantId,true);
      refreshWindows(actor.id);
    }catch(error){ui.notifications.error('NPC Shops: '+error.message);}
  },true);
}
function openSelected() {
  const token = canvas?.tokens?.controlled?.[0];
  if (!isNpcToken(token, worldActor)) return ui.notifications.warn('NPC Shops: Select an NPC token (not a player character) to create or edit a shop');
  open(descriptorFromToken(token));
}
async function openDirectory() {
  const sceneId = canvas?.scene?.id;
  if (!sceneId) return ui.notifications.warn('NPC Shops: Open a scene first');
  await showDirectory(async () => {
    const result = await queryGM('directory', {sceneId});
    if (!result.ok || game.user.isGM) return result;
    // Never reveal hidden or currently unseen NPCs to a player via the directory.
    return {...result, shops: result.shops.filter(s => {
      const token = canvas?.tokens?.get(s.tokenId);
      return !!token && token.visible && !token.document.hidden;
    })};
  }, open, isNpcToken(canvas?.tokens?.controlled?.[0], worldActor) ? () => openSelected() : null);
}

// GM-only merchant control: support both the legacy v11 HUD and the v14 ApplicationV2 HUD.
function registerTokenHud() {
  const inject = (app, html) => {
    if (!game.user.isGM) return;
    injectMerchantHudControl({
      app, html, isGM: game.user.isGM,
      fallbackToken: () => canvas?.tokens?.controlled?.[0],
      onOpen: token => open(descriptorFromToken(token))
    });
  };
  Hooks.on('renderTokenHUD', inject);
  // v14 may render the token HUD through the generic ApplicationV2 lifecycle.
  Hooks.on('renderApplicationV2', (app, element) => {
    if (!game.user.isGM || !isTokenHudApplication(app, canvas?.tokens?.hud)) return;
    inject(app, element);
  });
}
async function syncTokenFlags(scene = canvas?.scene) {
  if (!game.user.isGM || !scene || pinSyncing.has(scene.id)) return;
  pinSyncing.add(scene.id);
  try {
    const changes = [];
    for (const doc of scene.tokens) {
      if (!doc.actorId) continue;
      const actor = worldActor(doc.actorId);
      if (!actor) continue;
      const enabled = !!shopData(actor).enabled;
      const previous = doc.getFlag(MODULE_ID, 'merchant');
      const update = {_id:doc.id};
      let changed = false;
      if (previous !== enabled) {update[`flags.${MODULE_ID}.merchant`] = enabled; changed = true;}
      // v0.1.3: icon is a PIXI Token child, so it follows the NPC without persisted coordinates.
      if (changed) changes.push(update);
    }
    if (changes.length) await scene.updateEmbeddedDocuments('Token', changes);
  } catch (err) {
    console.warn('NPC Shops: merchant marker synchronization failed', err);
  } finally {pinSyncing.delete(scene.id); refreshBadges();}
}
function updateBadges() {
  badgesScheduled = false;
  if (!canvas?.ready) {
    tokenBadges?.clear();
    return;
  }
  if (!tokenBadges) tokenBadges = new TokenShopBadges({
    pixi: PIXI,
    open: token => open(descriptorFromToken(token)),
    isMerchant: token => {
      const actor = worldActor(token.document.actorId);
      return actor ? Boolean(shopData(actor).enabled) : Boolean(token.document.getFlag(MODULE_ID,'merchant'));
    }
  });
  try { tokenBadges.sync(canvas.tokens?.placeables); }
  catch (err) { console.error('NPC Shops: unable to draw shop token badges', err); }
}
function refreshBadges() {
  if (badgesScheduled) return;
  badgesScheduled = true;
  requestAnimationFrame(updateBadges);
}
function installAccessButton() {
  if (!game.user.isGM) return; // Only the GM gets the floating Shops directory.
  if (document.getElementById('npc-shops-access')) return;
  const btn = document.createElement('button');
  btn.id = 'npc-shops-access';
  btn.className = 'npc-shops-access';
  btn.type = 'button';
  btn.title = 'Drag to move Shops · Click to browse · Right-click to reset position';
  btn.innerHTML = '<i class="fas fa-store"></i> Shops <i class="fas fa-grip-vertical ns-drag-grip"></i>';
  const getSaved = () => game.settings.get(MODULE_ID, 'buttonPosition');
  const positionButton = position => {
    const next = clampButtonPosition(position, window.innerWidth, window.innerHeight, btn.offsetWidth || 110, btn.offsetHeight || 36);
    btn.style.left = `${next.x}px`;
    btn.style.top = `${next.y}px`;
    return next;
  };
  document.body.appendChild(btn);
  positionButton(getSaved());
  let drag = null;
  let ignoreClick = false;
  btn.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag = {pointerId:e.pointerId, startX:e.clientX, startY:e.clientY, x:btn.offsetLeft, y:btn.offsetTop, moved:false};
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove', e => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaX = e.clientX-drag.startX, deltaY = e.clientY-drag.startY;
    if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true;
    if (drag.moved) {e.preventDefault(); positionButton({x:drag.x+deltaX,y:drag.y+deltaY});}
  });
  btn.addEventListener('pointerup', e => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) {
      ignoreClick = true;
      const saved = {x:btn.offsetLeft,y:btn.offsetTop};
      game.settings.set(MODULE_ID, 'buttonPosition', saved).catch(err => console.warn('NPC Shops: cannot save button position', err));
    }
    drag = null;
  });
  btn.addEventListener('pointercancel', () => {drag=null;});
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (ignoreClick) {e.preventDefault(); ignoreClick=false;return;}
    openDirectory();
  });
  btn.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    const position=positionButton({x:window.innerWidth-340,y:115});
    game.settings.set(MODULE_ID,'buttonPosition',position);
    ui.notifications.info('NPC Shops: Button position reset');
  });
  window.addEventListener('resize', () => positionButton({x:btn.offsetLeft,y:btn.offsetTop}));
}

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'buttonPosition', {name:'Shops button position', scope:'client', config:false, type:Object, default:{}});
  game.settings.register(MODULE_ID, 'hotkeyEnabled', {name:'Enable Alt+S shop shortcut', hint:'GM only: select an NPC token and press Alt+S. Players open shops from the merchant badge on the token.', scope:'client', config:!!game.user?.isGM, type:Boolean, default:true});
});
Hooks.once('ready', () => {
  if (game.system?.id !== 'dnd5e') {ui.notifications.warn('NPC Shops requires the dnd5e game system'); return;}
  const gen = Number(game.release?.generation ?? String(game.version).split('.')[0]);
  if (![11,14].includes(gen)) console.warn('NPC Shops is currently targeted at v11 and v14; other versions are untested');
  registerTokenHud();
  installAccessButton();
  installPaidItemDrops();
  refreshBadges();
  syncTokenFlags();
  window.addEventListener('keydown', e => {
    if (!game.user.isGM) return; // Never intercept a player's Alt+S shortcut.
    if (!game.settings.get(MODULE_ID,'hotkeyEnabled') || !e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyS') return;
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    e.preventDefault();
    openSelected();
  });
  // The second socket argument is attached by the Foundry server: it is not
  // player-controlled payload data. Ignore messages when that proof is absent.
  game.socket.on(SOCKET, async (incoming, senderId) => {
    const data = authorizeSocketMessage(incoming, senderId, primaryGM()?.id);
    if (!data) return;
    if (data.type === 'shop-changed') {
      if (!game.user.isGM) refreshWindows(data.merchantId, true);
      return;
    }
    if (data.type === 'response') {
      if (data.to !== game.user.id) return;
      const callback = pending.get(data.requestId);
      if (callback) {pending.delete(data.requestId); callback(data.result);}
      return;
    }
    if (!game.user.isGM || primaryGM()?.id !== game.user.id) return;
    // A forged claim is rejected above; use the server-authenticated sender in
    // every GM-side permission and ownership check.
    const payload = {...data.payload, userId: senderId};
    if (!game.users.get(senderId)?.active) return;
    if (payload.action === 'trade') {
      payload.details = {...payload.details, userId: senderId};
    }
    let result;
    try { result = await dispatch(payload); }
    catch (err) {
      console.error('NPC Shops: GM socket request failed', err);
      result = {ok:false, message:`GM could not process ${payload.action}: ${err?.message || 'unknown error'}`};
    }
    try { game.socket.emit(SOCKET, {type:'response',to:senderId,requestId:payload.requestId,result}); }
    catch (err) { console.error('NPC Shops: unable to send shop response', err); }
  });
  Hooks.on('canvasReady', () => {tokenBadges?.clear(); refreshBadges(); syncTokenFlags();});
  Hooks.on('canvasTearDown', () => tokenBadges?.clear());
  Hooks.on('drawToken', refreshBadges);
  Hooks.on('canvasPan', refreshBadges);
  Hooks.on('refreshToken', refreshBadges);
  Hooks.on('createToken', () => {refreshBadges(); syncTokenFlags();});
  Hooks.on('deleteToken', refreshBadges);
  Hooks.on('updateToken', refreshBadges);
  Hooks.on('updateActor', (actor, changes) => {
    const shopChanged=Object.hasOwn(changes.flags?.[MODULE_ID] ?? {},'shop');
    refreshWindows(actor.id,shopChanged);
    if (game.user.isGM && shopChanged) {
      // Merchant settings are also reflected on placed TokenDocuments, visible to players.
      for (const scene of game.scenes) syncTokenFlags(scene);
    }
    refreshBadges();
  });
  for (const action of ['createItem','deleteItem','updateItem']) Hooks.on(action, item => {
    if (item.parent?.documentName === 'Actor') refreshWindows(item.parent.id);
  });
  game.modules.get(MODULE_ID).api = game.user.isGM ? {open, openSelected, openDirectory} : {open};
  console.info(`NPC Shops v${game.modules.get(MODULE_ID)?.version ?? '0.5.0'} ready. GM: Alt+S. Players: click the token shop badge.`);
});
