# NPC Shops

**Experimental alpha v0.1.10** — A custom NPC merchant module for Foundry VTT. Target installations are **Foundry 11 / dnd5e 3.3.1** and **Foundry 14 / dnd5e 5.3.3**. These targets need live validation; do not interpret the manifest's `verified` field as a claim of v14 testing.

## v0.1.9 — GM merchant creation control

- Adds compatibility with the Foundry v14 ApplicationV2 Token HUD. The GM receives the store icon to open any NPC as a shop; players do not.
- The GM-only **Shops** button now includes **Create / Edit Selected Shop**. Select an NPC token and click this to open the merchant editor, even if another Token HUD module hides the HUD control.
- **Alt+S** on a selected NPC continues to open its shop for the GM; when not a merchant, choose **Make Merchant**.
- Preserves existing Buy / Sell / Manage, chat announcements, merchant inventory, token badges, and the Clear Transaction History feature.

## v0.1.10 — Badge placement and automatic item categories

- Merchant shop badge is now above the token image and continues to follow its movement and canvas zoom.
- Buy, Sell and Manage automatically group existing and new items under collapsible sections: Weapons, Armor & Shields, Equipment, Consumables, Tools, Containers, Loot & Materials, Other Items.
- Categories are inferred from the D&D 5e Item type and armor subtype. Within a category items are sorted by name; saved stock is not edited or recreated.
- Players receive only a safe item category marker, not private Item system data. Expanded/collapsed sections persist across re-renders and tab switches while the window is open.
- Previous shopping, chat notifications, GM controls and Clear History remain intact. Rollable Tables stays removed.

## Features

- Turn a world NPC Actor into a merchant without replacing its normal sheet.
- GM-only stock editor: drag Items from a sidebar, compendium or Actor sheet; customize price (GP), quantity, unlimited stock, shop open/closed, and buyback rate.
- Players shop using their owned characters (select character in the shop), buy, sell, and receive items and standard cp/sp/ep/gp/pp currency changes.
- History of the last 60 transactions, stored on the merchant Actor.
- Lock per transaction on the processing GM and basic rollback on errors.
- Shared HTML/CSS merchant UI for both Foundry generations; no extra module dependencies.

## Install

From **Add-on Modules → Install Module → Manifest URL**, paste:

`https://raw.githubusercontent.com/Daikaze/NPC-Shops/main/module.json`

The `download` in the manifest requires a successfully published GitHub release containing `npc-shops.zip`. If the release is not present yet, use the packaged ZIP manually.

## Usage

1. As GM, place an NPC token on a Scene; select it and press **Alt+S**, or click the shop icon in its Token HUD. The merchant window shows **Make Merchant** for regular NPCs.
2. As GM, click **Make Merchant**, open the **Manage** tab, and drag Items into the drop zone. New stock starts at quantity 1; customize the price and stock, then **Save**.
3. Players click the small store badge **attached to the merchant token** to open its shop. Choose their owned character and use **Buy** / **Sell**. They do **not** need permission to control the NPC. Only the GM sees the movable **Shops** directory button and uses **Alt+S**.
4. A GM with NPC Shops enabled must be online to process player transactions. All shop configuration happens on the GM client.

The actor remains a normal NPC; shop stock is stored independently in `flags.npc-shops.shop` rather than mixed with the NPC's combat inventory.

## v0.1.8 — Clear Transaction History

- As GM, expand **Manage → Transaction History**, click **Clear History** and confirm. Only this merchant's history entries are cleared.
- Stock, prices, currency, settings and existing public chat messages are unchanged. New transactions continue to be recorded (existing 60-entry cap).

## v0.1.7 changes

- Removed Rollable Tables, its GM tab, table rolling, loot-generation controls, supporting source and styles.
- Existing stock and generated loot already added to merchants remain untouched. Buy, Sell, Manage, pricing, currencies, token badges, transaction history, and public trade chat receipts are unchanged.
- Previously stored table links/settings remain in existing merchant flags but are no longer used or displayed; no destructive migration. New merchants get no table-specific fields.

## v0.1.3 fixes

- Replace floating HTML merchant badges with PIXI canvas markers attached directly to the NPC token, so they **follow the token instantly** during movement or zoom and **never overlay Character Sheets**.
- Remove player-facing **Shops** floating directory button and deny players the **Alt+S** shortcut. Players still click the token merchant icon to access the shop.
- Remove the player Token HUD entry, keeping GM controls GM-only. Existing legacy `shopPin` flags are ignored and don't need cleanup.
- Add canvas badge tests for both v11 and v14-style PIXI Graphics APIs.

## v0.1.2 fixes

- Enable the required `"socket": true` manifest setting so Foundry forwards merchant requests and GM responses. Previously missing, causing perpetual loading and GM timeout messages.
- Formerly stored fixed-position token shop markers. Superseded by v0.1.3 token-following markers.
- Formerly projected HTML markers onto screen coordinates. Superseded by v0.1.3 PIXI marker rendering.
- Allow the GM to drag the **Shops** button to any screen position; save position across reloads. Right-click Shops to restore default position.
- Return actionable GM error messages when a request fails instead of waiting indefinitely.

## v0.1.1 fixes

- NPCs start as **not merchants**, so GM sees **Make Merchant**. Already configured shops remain enabled.
- Players receive public shop listings from an active GM through module socket requests; no NPC ownership is required. Scene Shops button and a clickable store icon appear on visible merchant tokens.
- Explicit per-denomination Actor updates and verification avoid giving an item when currency cannot be charged.
- Coins remain in their original denominations whenever possible, without auto-upgrading GP to PP.

## Important limitations and safeguards

- **ALPHA — back up the World before use**, test on copies first, and verify version compatibility on actual v11/3.3.1 and v14/5.3.3 installations.
- Transactions touch multiple documents and are **not database-atomic**; best-effort rollback cannot guarantee recovery if Foundry crashes or other modules interfere mid-trade.
- Requests use standard Foundry module socket messages. A client might forge a requester ID; **do not treat this module as secure against malicious players**. Use on trusted tables and inspect the ledger. Full trustworthy sender authentication requires server-side handling or another authenticated protocol.
- Coin denominations are **not normalized upward** on trades. Purchases spend existing GP/EP/SP/CP where possible and only make lower-denomination change when needed; the module never automatically changes held gold into platinum. Standard D&D 5e exchange values are used; custom currencies are not supported.
- Selling is limited to physical `weapon`, `equipment`, `consumable`, `tool`, and `loot` items. Containers, nested items, and nonstandard currencies are excluded in this alpha.
- Merchants are **world Actors**, not unlinked synthetic tokens or Compendium-only Actors. Shop transfers create new item entries rather than automatically stacking identical items.
- A GM can manage stock concurrently with a player purchase; do not edit shop inventory while players transact. Multiple simultaneously active GMs use the lowest-ID active GM as processing host; unusual GM disconnects can interrupt an in-flight trade.
- The `getFlag` stock data may be large with numerous item snapshots. Keep inventory moderate.
- Existing modules that replace Token HUD or drag data payloads may need additional integrations. **GM: Alt+S or Token HUD. Players: token store badge only.**

## Developer API

`game.modules.get('npc-shops').api.open(actor)`; GM only: `.openSelected()` and `.openDirectory()`.

## Roadmap

- Tests on both target combinations, UI polish and localization.
- Stronger transaction identity checks, pre-trade currency snapshot validation, sale confirmation, restock controls.
- Optional inventory stacking, per-item pricing multipliers, and GM approval mode.

## License

MIT.

## v0.1.6 — Gathering RollTables and public trade chat

- Strips a matching table title from results such as `Gathering: Coast: Gillyweed` before looking for an imported Item named `Gillyweed`.
- Optional, **enabled by default**, automatic **generic Loot** fallback for text-only results. Use the Rollable Tables settings to choose its default price (0 GP initially), or disable fallback to retain unresolved results. These generated items contain no invented Plutonium statistics or effects.
- Every successfully committed purchase or sale creates one **public chat receipt** with player, character, merchant, item, quantity, and price. Failed transactions produce no trade receipt; repeat request IDs do not double-post.
- Test on a copy of the world; real Foundry v11/v14 client integration still needs validation.
