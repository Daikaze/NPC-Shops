# NPC Shops

## v0.4.2 — Give and Item Sheet fixes, resizing

- Replaces the incompatible GM Give dialog with a shop-local recipient picker (player-owned character sheets only); keeps multi-item gifting and stock adjustment.
- Prevents unsupported sheet-layering APIs from breaking Item previews and lifts opened Item Sheets in front of the shop after rendering.
- Shop window supports drag resizing from the bottom-right corner, with minimum size and scrollable content.
- Changes committed to source; live Foundry V11/V14 testing is still pending.

## v0.4.1 — GM Cashbox shortcut, RP Give, item sheet layering

- GM-only Cashbox button on the shop top navigation opens the existing NPC wallet and proceeds page.
- GM-only Give action in the Buy bill grants selected items and quantities to a player-owned character Actor without charging money. Normal limited stock is reduced, unlimited stock stays unlimited; the gift is recorded in merchant history.
- The native Item inspection sheet is raised above the custom shop window.
- Live validation in Foundry 11 and 14 is still required.

**Experimental alpha v0.4.0** — A custom NPC merchant module for Foundry VTT. Target installations are **Foundry 11 / dnd5e 3.3.1** and **Foundry 14 / dnd5e 5.3.3**. These targets need live validation; do not interpret the manifest's `verified` field as a claim of v14 testing.

## v0.4.0 — Merchant NPC receives coins, GM-only Cashbox, Item sheets and paid Drag & Drop

- **Merchant funds:** Every completed purchase credits the actual NPC Actor's `system.currency` wallet (where the NPC has currency) as well as recording lifetime purchase proceeds in `flags.npc-shops.shop.cashboxCp`. This happens inside the server-side GM-controlled trade pipeline, with attempted buyer refund, item rollback and merchant-wallet rollback if a later step fails. Duplicate trade request IDs are not charged twice. Existing sales remain unchanged.
- **GM-only cashbox:** Under `Settings → Cashbox`, see lifetime proceeds from purchases and the NPC's current balance. Players cannot access Cashbox and `publicShop` does not reveal it. Old shops default to zero proceeds with no migration.
- **Clickable Foundry sheets:** Click a shop Item's icon/name in Buy (and GM Stock) to view the native v11/v14 D&D Item sheet via a temporary document; inspecting has no purchase effect. In Sell, clicking an owned Item opens its existing sheet.
- **Paid drag and drop:** Drag a stock Item into the **Bill of Sale** to add one unit to the basket, without charging or delivering it. Drag from the Buy list onto an **open character sheet** to purchase one item through the same GM-validated currency/ownership/stock pipeline as the Buy button. The drag payload deliberately uses an NPC Shops-specific type, not Foundry's `Item` payload, to avoid free inventory copies. Unrecognized sheet drops produce a warning, never a free Item.
- Existing prices, ledger, Shop icons, roll tables, Save All, Clear All, v11/v14 compatibility and public chat receipts remain intact.

## v0.3.9 — Reliable titlebar double-click / double-tap + GM Clear All Stock

- **Fix v11/v14 minimization:** The NPC Shops title bar supports double-click to minimize and double-click again to restore. Foundry's outer-window pointer capture had been taking ownership on *every* pointerdown, redirecting native double-clicks away from the title bar. Capture now begins only after 5px of real drag movement; normal titlebar clicks remain native. Additional click(detail=2) and touch/pen double-tap fallbacks work if Foundry suppresses the dblclick event.
- **GM Settings → Stock → Clear All:** A new red **Clear All** button beside **Save All** clears every merchant inventory entry in one save, *only after confirmation inside NPC Shops*. It leaves the merchant enabled, and preserves RollTable links, shop prices/configuration, buyback percentage, and transaction history. The button disables for empty stock and is never shown to players.
- Save All and individual item removal work as before, with no change to the established Buy/Sell checkout backend or v11/v14 support.

## v0.3.8 — Centered v11 icon, native double-click minimization, Buy checkout

- Centered the **GM-only shop glyph in the v11 Token HUD**, matching v14. Uses an explicit full-tile flex centering wrapper to neutralize v11 native control-icon baseline and margin offsets, retaining the dark tile and under-Elevation position in both versions.
- **Double-click the NPC Shops title bar to minimize or restore** on v11 and v14, just like a normal Foundry window. Removed the separate minus/plus minimize button. Close remains clickable, and dragging the title bar is unchanged.
- Changed the Bill of Sale checkout caption from **Seal it** to **Buy** (and Sell it to Sell); quantity, pricing, validation, GM-authorized trade handling, and basket remain unchanged.
- Added tests for both version-specific HUD variants and double-click minimization.
## v0.3.7 — Trade visibility, minimize, in-window confirmations, Roll All preview and unified Stock

- **GM-only trade term visibility:** The merchant header's "Sells at list / Buys at XX%" information is hidden from players by default. GM Settings → Terms has an explicit **Show to Players / Hide from Players** switch. The GM always sees the terms; player buying/selling calculations remain unchanged.
- **Minimize / Restore:** New minus/plus action in NPC Shops' title bar collapses the entire storefront to a draggable title bar, and restores the existing tab, inventory, and cart.
- **Foundry-contained dialogs:** Merchant removal, Rollable Table unlinking and clearing transaction history now use a styled confirmation overlay inside NPC Shops, not the browser's native confirm window. Cancel and Escape dismiss safely.
- **Buyback v11:** Percentage input/Save Buyback works independently of v14 ApplicationV2, retains the typed value through renders, and updates the NPC flag. The empty-inventory case works too.
- **Roll All Tables previews first:** Enumerates every result from all linked tables into a review list; allows per-item quantities/prices and individual discard, then **Add All Items** explicitly commits the selected results. Merely clicking Roll All never modifies merchant stock.
- **Unified Stock editor:** Category headers, rows, field labels and save/remove buttons now match Buy's charcoal/bronze layout instead of the older blue accordion. Keeps Save All, stock tracking and merchant inventory unchanged.

## v0.3.6 — Native-style HUD, Buyback editing, All Table Items, spacious Settings

- **v11 / v14 Make Merchant icon:** match Foundry's dark charcoal/white Token HUD button style rather than the colored navy/gold tile; retain the under-Elevation position in both versions.
- **Buyback Percentage:** spacious dedicated control with an editable draft and **Save Buyback** button. Can be saved even with zero shop items, and persists an integer 0–100% to the NPC shop flag. Save All retains its existing ability to update the buyback field.
- **Roll All Tables:** now enumerates **every row** from **every attached RollTable**, including World and Compendium tables, expands nested tables safely, resolves Item references/text results and **adds them directly to Stock in one commit**; never calls random `roll()` for that action. Existing inventory, prices and history are preserved. Duplicate Item sources are merged into their stock quantity; safety limit prevents accidental huge imports.
- **Individual Roll** remains a random preview workflow with manually editable quantity/price and Add All. Roll All clears earlier previews after importing to prevent accidental double additions.
- **Keep rolled checkbox:** one 19px square, clear label and consistent spacing, no overlapping native/Foundry glyphs.
- Wider shop, less cramped merchant settings and RollTable selection, readable quantities, responsive fields, improved vertical spacing.
- No Item Piles dependency and no new player-facing tab.

## v0.3.5 — Elevation placement verified for v11 and v14

- Ensures the **27px Make Merchant** icon is inserted immediately **under Elevation** in both v11 classic and v14 ApplicationV2 Token HUDs, instead of appending at the bottom of the left column or on the right.
- Expands semantic Elevation selectors (including Foundry inputs and wrappers). A left-side absolute fallback is used if a HUD build lacks discoverable Elevation markup.
- Scope is limited to the HUD icon. **Remove Merchant**, Rollable Tables, stock, trading and Save All from v0.3.4 remain unchanged.

## v0.3.4 — Small HUD under Elevation (v11 & v14), Remove Merchant, Item Piles-style Rollable Tables

- **Both Foundry v11 and v14:** the GM Token HUD shop creation button is 27×27 px, inserted directly **below Elevation** when that control exists. Left-column fallback; no oversized button in the right column. The separate token-corner shop badge is unchanged.
- **Remove Merchant:** GM Settings → Stock and Terms have a confirmation button. Disabling hides the merchant badge but preserves stock, pricing, ledger and linked RollTables; Make Merchant restores the same shop.
- **Rollable Tables** live inside GM **Settings → Rollable Tables** (not a top-level tab). Browse World and Compendium RollTables, Add/Remove Table, set rolls, Roll or Roll All Tables, **Keep rolled**, inspect quantity/price, add one item or Add All Items and discard results.
- Resolves Foundry v11 and v14 RollTable Item references and looks up exact text matches in world Items and Item Compendiums. Unmatched text becomes explicitly labeled zero-price basic Loot in the preview; it is never added without GM confirmation. Works independently of Item Piles.
- Compatible with the existing merchant storefront, player Buy/Sell, Save All and public chat receipts. No merchant data is migrated or overwritten.
- Based on the **workflow** of [Item Piles](https://foundryvtt.com/packages/item-piles), not a copy of its source, templates or assets.

## v0.3.3 — Fix white, unreadable character dropdowns

- Fixes expanded native HTML `select` menus in NPC Shops showing a **white background with white/invisible text** on Firefox/Windows or under Foundry's native control styling.
- Applies an explicit dark `color-scheme` to the shop form controls, plus matching background/foreground colors for options, selected options, and option groups. The buyer picker gets an opaque background instead of its former transparency.
- Scoped to the merchant window. No changes to other Foundry interfaces or NPC Shops inventory, trading, Save All, purchases, chat, or NPC controls.

## v0.3.1 — Slate theme + Save All Stock

- Recolors the standalone NPC Shops storefront to the reference **charcoal/slate inventory palette**: dark gray row cards, gray separators, ivory item names and muted-gold prices/icons. Both the Bill of Sale and merchant settings use the same palette.
- Adds **Save All** above and below **GM Settings → Stock**. It validates and saves every item row—including those hidden by a search—with a single merchant stock update (quantity, price and unlimited toggle), and includes the buyback percentage shown in the Stock editor.
- Rejects invalid prices, empty fields, fractional/negative stock and stale/deleted stock rows before making any changes. Saves remain atomic at the shop settings level.
- Keeps each item's individual **Save** button and the live Buy-tab/player inventory sync from v0.3.0. Existing merchant items and transaction history are retained.

## v0.3.2 — Recreate the Merchant Presets window design

- Replaces the v0.3.1 gray-only look with a **much closer recreation of the Merchant Presets Buy window**: maroon gradient shop header, merchant portrait and status chips, buyer/purse panel, charcoal category sidebar, slate product rows with gold coin emblems, and a parchment-colored Bill of Sale with a wax-style Seal button.
- The same visual system applies to Buy, Sell and Settings. Original NPC Shops behavior is retained, including item search, basket review, GM Save All, transaction history, live stock updates, NPC-only controls and v11/v14 compatibility.
- Theme is independently authored in `styles/merchant-presets-look.css`, loaded after existing styles so legacy theme rules do not override it. No Merchant Presets templates, fonts, images, scripts, or compendiums are copied.
- The aesthetic references [Merchant Presets by Miki](https://github.com/mikiross87/merchant-presets). It is not the Merchant Presets runtime, and v11 remains supported by the NPC Shops backend.
- No shop data migration or restocking is performed. Existing merchant inventories and prices are preserved.

## v0.1.19 — Search merchandise by name

- Adds a search bar to **Buy**, **Sell** and GM **Manage** views.
- Filters item names as you type, ignoring case and spaces around the search term; categories with no matches hide automatically.
- Shows a "No items match your search" message when nothing matches, and restores the full list when cleared.
- Search text is remembered independently per tab while the window remains open.
- Filtering does not modify stock or prices, interrupt quantity inputs, or discard unsaved GM edits.

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

## v0.1.11 — Fix opening shops by clicking the merchant badge

- Replaced the non-clickable above-token PIXI child badge with a real browser button. Foundry v14 does not reliably hit-test child elements outside the token's bounds.
- The round gold merchant icon stays **above** the token, follows token motion and canvas pan/zoom on each animation frame, and is clickable without NPC ownership.
- Badges hide when a merchant becomes invisible/hidden or leaves the view; cleanup on scene changes avoids stale buttons. UI windows appear above the badges.
- Other shop features are unchanged, including Buy/Sell/Manage, automatic item categories, GM-only controls and chat receipts.

## v0.1.12 — Fixed-size shop badge that moves with token

- The visible merchant badge is once again a PIXI child of each merchant token; it inherits every animated token movement transform directly rather than trailing behind in HTML.
- Its visible size and spacing above the token remain constant through zoom by inverse-scaling against the live canvas transform.
- A transparent, fixed-size HTML click area continues to allow players to open the shop above the token's PIXI hit area.
- No changes to shop inventory, categories, trading, player access or transaction history.

## v0.1.13 — Live Foundry v14 zoom compensation

- Fix the shop badge's size at different zoom levels using the **live canvas stage zoom**, not potentially stale token matrix values.
- Run visual correction on Foundry's PIXI ticker (when available), synchronized with token animation and scene rendering; retain requestAnimationFrame fallback for earlier versions.
- Account for token/container scaling and browser canvas pixel ratio while keeping the same clickable badge above the moving NPC.
- Existing shop inventory, trading, item categories and GM settings are unchanged.

## v0.1.14 — Fixed-size button at the top-right of NPC tokens

- Changed to a **single visible 30px HTML store button** in the top-right corner of every merchant token, within the token bounds. This is deliberately not a PIXI visual and is never multiplied by Foundry's camera zoom.
- Tracks the token corner from Foundry's displayed token transform in the late PIXI application ticker, with no CSS movement animation. There is no floating shop icon above the token.
- Still clickable by players without actor ownership; hidden merchants do not show the button.
- Buy, Sell, Manage, item categories, chat receipts and Clear History are unchanged.

## v0.1.15 — Proportional top-right shop badge

- The previous 30px fixed-size badge was tiny at high zoom and oversized at low zoom. The badge now scales **proportionally to the token's displayed size** (16%, minimum 14px, maximum 44px).
- Remains in the token's upper-right corner, with a transparent clickable area of at least 24px and no CSS movement animation.
- Uses actual displayed token corners and updates in the Foundry ticker. Player click-to-shop, shops/merchant settings, categories, chat receipts, Buy/Sell and history remain untouched.

## v0.1.16 — Revert to proven token-child badge (v0.1.3)

- Restores the **v0.1.3 PIXI-only token-child badge**, the approach that previously solved shop icons showing over Character Sheets.
- Places the badge **inside the upper-right token corner**, rather than above/outside the token, so v14 can hit-test the icon without a separate HTML button.
- No per-frame HTML overlay, canvas projection, CSS badge resizing or camera-zoom calculation. The badge follows the token's exact native movement and zoom at a proportional size.
- Players retain click-to-shop access. Buy/Sell/Manage, item grouping, trade chat and Clear History are unchanged.

## v0.1.17 — NPC-only shop creation

- **GM merchant creation controls now appear only for D&D 5e actors with type `npc`.** PC characters (`character`) do not receive a shop creation button in Token HUD (v11/v14), in the GM Shop window, or in the selected-shop directory entry.
- Alt+S on a PC token warns the GM instead of attempting to make a PC a shop.
- The merchant creation action and shop settings save path also validate the NPC type, preventing creation through a hidden button or direct UI event.
- Buy, Sell, Manage, token shop badges, categories, chat receipts and Clear History remain unchanged for NPC merchants.

## v0.1.18 — Restore public purchase/sale chat receipts in Foundry v11

- Foundry 11 chat receipts now explicitly use the numeric `CONST.CHAT_MESSAGE_TYPES.OOC` and GM user ID; v14 uses the modern chat style when available.
- Trade messages remain public, with the buying/selling player, character, merchant, item, quantity, and total price.
- Added a safe fallback for errors creating enriched legacy v11 messages, and GM console/notification diagnostics if both attempts fail or message creation is blocked.
- Trading commits are not rolled back just because a chat notification fails; duplicate trade requests still do not create duplicate chat messages.
- No changes to merchant stock, Shop UI, NPC-only controls, player permissions, token icons or Transaction History.

## v0.2.3 — Restore the simple NPC Shops interface

- Returned the merchant UI to **Buy / Sell / Manage**, removing the extra Rollable Tables tab and Compendium browsing/import screens added in v0.2.0.
- Old RollTable configuration flags may remain in saved shop data but are not displayed or used; **merchant stock, prices, and transaction history are preserved**.
- Importing an individual Item via **drag and drop** from the Foundry Item sidebar, Compendiums, or Actor sheets remains available in Manage, just like v0.1.19.
- Retained the independent item search in Buy/Sell/Manage, improved readability, per-tab scroll restoration, NPC-only GM merchant creation, and public trade chat messages.

## v0.3.0 — Three-panel storefront redesign + live stock updates

- Redesigns NPC Shops after the **Merchant Presets** visual pattern (burgundy shop header, three-column category/catalog/receipt layout and GM Settings), with an independent implementation and no extra dependencies or copied compendium assets. Original design inspiration: https://github.com/mikiross87/merchant-presets.
- **Stock Save now updates Buy instantly** on the GM's screen and broadcasts shop changes to open player windows, which reload the server's safe public inventory.
- A Bill of Sale lets buyers/sellers add quantities, review item prices and wallet balance, and confirm the bill using the existing GM-side authorized trade pipeline. Each row is a separate validated trade; a later failure stops the bill and retains any unfulfilled items.
- GM Settings keeps Stock, Terms and History, including original inventory management, selling percentage and Clear History.
- Existing shops, saved flags, stock, prices, transaction history, merchant token badges, NPC-only creation and v11/v14 API support are preserved.
- Inspired visual styling is an independent implementation using system fonts and existing NPC item images; this is not the full Merchant Presets module and does not import its content packs or time-based restocking.

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
