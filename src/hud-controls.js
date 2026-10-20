/** Compatibility layer for GM-only NPC shop control in Foundry v11 and v14 Token HUD. */
export function isTokenHudApplication(app, knownHud = null) {
  return !!app && ((knownHud && app === knownHud) || app.constructor?.name === 'TokenHUD');
}
export function hudElement(app, html) {
  const possibilities = [html, html?.[0], app?.element, app?.element?.[0]];
  return possibilities.find(el => el?.querySelector && el?.appendChild) ?? null;
}
export function currentHudToken(app, fallbackToken) {
  const options = [app?.object, app?.token, fallbackToken?.()];
  return options.find(token => token?.document?.actorId) ?? null;
}
export function injectMerchantHudControl({app, html, isGM, fallbackToken, onOpen}) {
  if (!isGM || typeof onOpen !== 'function') return false;
  const token = currentHudToken(app, fallbackToken);
  if (!token) return false;
  const root = hudElement(app, html);
  if (!root || root.querySelector('.npc-shop-hud')) return false;
  const doc = root.ownerDocument ?? globalThis.document;
  if (!doc?.createElement) return false;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'control-icon npc-shop-hud';
  button.title = 'NPC Shops — Make Merchant / Open Shop';
  button.setAttribute('aria-label', 'Make Merchant or Open Shop');
  button.innerHTML = '<i class="fas fa-store"></i>';
  // v11 Token HUD has columns; v14 HUD uses ApplicationV2 and its own markup.
  const classicColumn = root.querySelector('.col.right') || root.querySelector('.hud-column.right');
  if (classicColumn) classicColumn.appendChild(button);
  else {
    button.classList.add('ns-hud-floating');
    // The custom floating button is contained in the TokenHUD element, NOT the
    // global body. It disappears automatically when Foundry closes the HUD.
    if (!root.style) return false;
    if (!root.style.position) root.style.position = 'relative';
    root.appendChild(button);
  }
  button.addEventListener('pointerdown', event => event.stopPropagation());
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const selected = currentHudToken(app, fallbackToken);
    if (selected) onOpen(selected);
  });
  return true;
}
