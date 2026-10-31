/**
 * Foundry V14 native window adapter.
 *
 * Keep all storefront logic in ShopWindow so V11 uses its existing legacy
 * window. V14 owns the frame, drag, resize, minimize and window stacking.
 */
export function supportsNativeWindows() {
  const generation = Number(globalThis.game?.release?.generation ?? String(globalThis.game?.version ?? "").split(".")[0]);
  return generation >= 14 && typeof globalThis.foundry?.applications?.api?.ApplicationV2 === "function";
}

export function createNativeFrame({ id, title, width = 960, height = 700, onClose = () => {} }) {
  if (!supportsNativeWindows()) return null;
  const ApplicationV2 = globalThis.foundry.applications.api.ApplicationV2;
  class NPCShopsNativeFrame extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      classes: ["npc-shops-native"],
      window: {
        frame: true,
        title: "NPC Shops",
        icon: "fa-solid fa-store",
        minimizable: true,
        resizable: true
      },
      position: { width: 960, height: 700 }
    };
    constructor(options) {
      super(options);
      this.nsOnClose = onClose;
    }
    async _renderHTML() {
      const element = document.createElement("section");
      element.className = "npc-shops-window";
      element.setAttribute("aria-label", "NPC Shops");
      return element;
    }
    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }
    _onClickAction() {
      // Storefront actions remain delegated to ShopWindow.bindEvents.
    }
    _onClose(options) {
      try { this.nsOnClose?.(); }
      finally { return super._onClose(options); }
    }
  }
  return new NPCShopsNativeFrame({
    id, window: { title }, position: { width, height }
  });
}
