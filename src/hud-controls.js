import {isNpcToken} from './merchant-types.js';
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
export function findElevationControl(root) {
  if(!root?.querySelector)return null;
  for(const selector of [
    '[data-action="elevation"]','[data-control="elevation"]',
    '.control-icon.elevation','.elevation-control',
    '[data-tooltip="Elevation"]','[aria-label="Elevation"]',
    '[title="Elevation"]','.elevation'
  ]){
    const result=root.querySelector(selector);
    if(result)return result;
  }
  return null;
}
export function injectMerchantHudControl({app, html, isGM, fallbackToken, onOpen}) {
  if (!isGM || typeof onOpen !== 'function') return false;
  const token = currentHudToken(app, fallbackToken);
  if (!isNpcToken(token)) return false;
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
  // Both v11 and v14: put the shop immediately UNDER the Elevation control.
  // The respective HUD DOM differs, so find the semantic control first.
  const elevation = findElevationControl(root);
  const left = root.querySelector('.col.left') ||
    root.querySelector('.hud-column.left') ||
    root.querySelector('[data-side="left"]') ||
    root.querySelector('.left-controls');
  if (elevation?.parentNode?.insertBefore) {
    elevation.parentNode.insertBefore(button, elevation.nextSibling);
  } else if (left?.appendChild) {
    left.appendChild(button);
  } else {
    // v14 fallback if no stable HUD columns/semantic Elevation control exist.
    // Stay to the LEFT below where the native Elevation control is rendered.
    button.classList.add('ns-hud-floating');
    if (!root.style) return false;
    if (!root.style.position) root.style.position = 'relative';
    root.appendChild(button);
  }
  button.addEventListener('pointerdown', event => event.stopPropagation());
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const selected = currentHudToken(app, fallbackToken);
    if (isNpcToken(selected)) onOpen(selected);
  });
  return true;
}
