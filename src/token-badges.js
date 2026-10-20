/**
 * Clickable merchant badges for Foundry v11/v14.
 * PIXI children above a token can be outside the parent's hit area.
 * Instead, each visible merchant receives one native HTML button, positioned
 * from the token's PIXI transform every animation frame.
 */
export function merchantBadgePosition(token) {
  const width = Number(token?.w ?? token?.width ?? 0);
  const height = Number(token?.h ?? token?.height ?? 0);
  const size = Math.max(10, Math.min(16, Math.min(width || 80, height || 80) / 5));
  return {x: Math.max(size + 1, width / 2), y: -size - 7, size};
}

export function badgeViewportPosition(token, board, rendererScreen) {
  if (!token || !board?.getBoundingClientRect || typeof token.toGlobal !== 'function') return null;
  const local = merchantBadgePosition(token);
  const point = token.toGlobal({x: local.x, y: local.y});
  const rect = board.getBoundingClientRect();
  const renderWidth = Number(rendererScreen?.width) || rect.width;
  const renderHeight = Number(rendererScreen?.height) || rect.height;
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !(renderWidth > 0) || !(renderHeight > 0)) return null;
  const x = rect.left + point.x * (rect.width / renderWidth);
  const y = rect.top + point.y * (rect.height / renderHeight);
  return {x, y, onScreen: x >= rect.left + 18 && x <= rect.right - 18 && y >= rect.top + 18 && y <= rect.bottom - 18};
}

export class TokenShopBadges {
  constructor({open, isMerchant, getCanvas = () => globalThis.canvas, documentRef = globalThis.document,
    requestFrame = callback => globalThis.requestAnimationFrame(callback),
    cancelFrame = id => globalThis.cancelAnimationFrame(id)} = {}) {
    this.open = open;
    this.isMerchant = isMerchant;
    this.getCanvas = getCanvas;
    this.document = documentRef;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.current = new Map();
    this.frame = null;
  }

  createButton(token) {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = 'npc-shop-token-button';
    button.title = `Open ${token.name || token.actor?.name || 'merchant'} shop`;
    button.setAttribute('aria-label', button.title);
    button.innerHTML = '<i class="fas fa-store" aria-hidden="true"></i>';
    for (const eventName of ['pointerdown', 'mousedown', 'pointerup']) {
      button.addEventListener(eventName, event => event.stopPropagation());
    }
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const pair = this.current.get(token.document.id);
      if (!pair || pair.token !== token || !this.isVisibleMerchant(token)) return;
      this.open(token);
    });
    this.document.body.appendChild(button);
    return button;
  }

  isVisibleMerchant(token) {
    return !!(token && !token.destroyed && token.document?.actorId && !token.document.hidden && token.visible && this.isMerchant(token));
  }

  remove(id) {
    const pair = this.current.get(id);
    pair?.button?.remove();
    this.current.delete(id);
  }

  clear() {
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
    for (const id of this.current.keys()) this.remove(id);
  }

  updatePositions() {
    const worldCanvas = this.getCanvas();
    const board = worldCanvas?.app?.canvas ?? worldCanvas?.app?.view ?? this.document?.querySelector?.('canvas#board');
    const screen = worldCanvas?.app?.renderer?.screen;
    const ready = !!worldCanvas?.ready;
    for (const {token, button} of this.current.values()) {
      if (!ready || !this.isVisibleMerchant(token)) {
        button.style.display = 'none';
        continue;
      }
      const position = badgeViewportPosition(token, board, screen);
      if (!position?.onScreen) {
        button.style.display = 'none';
        continue;
      }
      button.style.display = '';
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
    }
  }

  tick() {
    this.frame = null;
    if (!this.current.size) return;
    this.updatePositions();
    this.frame = this.requestFrame(() => this.tick());
  }

  sync(tokens) {
    const live = new Set();
    for (const token of tokens ?? []) {
      if (!this.isVisibleMerchant(token)) continue;
      const id = token.document.id;
      if (!id) continue;
      live.add(id);
      const existing = this.current.get(id);
      if (existing && existing.token !== token) this.remove(id);
      if (!this.current.has(id)) {
        this.current.set(id, {token, button: this.createButton(token)});
      }
    }
    for (const id of this.current.keys()) if (!live.has(id)) this.remove(id);
    this.updatePositions();
    if (this.current.size && this.frame === null) this.frame = this.requestFrame(() => this.tick());
    if (!this.current.size && this.frame !== null) {
      this.cancelFrame(this.frame);
      this.frame = null;
    }
  }
}
