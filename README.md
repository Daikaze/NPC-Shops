# NPC Shops

**Experimental alpha v0.1.5** — A custom NPC merchant module for Foundry VTT. Target installations are **Foundry 11 / dnd5e 3.3.1** and **Foundry 14 / dnd5e 5.3.3**. These targets need live validation; do not interpret the manifest's `verified` field as a claim of v14 testing.

## Features

- Turn a world NPC Actor into a merchant without replacing its normal sheet.
- GM-only stock editor: drag Items from a sidebar, compendium or Actor sheet; customize price (GP), quantity, unlimited stock, shop open/closed, and buyback rate.
- Players shop using their owned characters (select character in the shop), buy, sell, and receive items and standard cp/sp/ep/gp/pp currency changes.
- History of the last 60 transactions, stored on the merchant Actor.
- Lock per transaction on the processing GM and basic rollback on errors.
- Shared HTML/CSS merchant UI for both Foundry generations; no extra module dependencies.
- GM-only **Rollable Tables** tab with Roll All Tables, previews, per-table roll counts, and Add All Items; accepts world/compendium RollTables and links to imported Plutonium/5etools Items.

## Install

From **Add-on Modules → Install Module → Manifest URL**, paste:

`https://raw.githubusercontent.com/Daikaze/NPC-Shops/main/module.json`

The `download` in the manifest requires a successfully published GitHub release containing `npc-shops.zip`. If the release is not present yet, use the packaged ZIP manually.

## Usage

1. As GM, place an NPC token on a Scene; select it and press **Alt+S**, or click the shop icon in its Token HUD. The merchant window shows **Make Merchant** for regular NPCs.
2. As GM, click **Make Merchant**, open the **Manage** tab, and drag Items into the drop zone. New stock starts at quantity 1; customize the price and stock, then **Save**.
3. Players click the small store badge **attached to the merchant token** to open its shop. Choose their owned character and use **Buy** / **Sell**. They do **not** need permission to control the NPC. Only the GM sees the movable **Shops** directory button and uses **Alt+S**.
4. A GM with NPC Shops enabled must be online to process player transactions. All shop configuration happens on the GM client.

## Rollable Tables + Plutonium (v0.1.5)

1. Import **Items** and **RollTables** using Plutonium / 5etools into the world or an Item/RollTable compendium. This module does not download content and does not require Plutonium's own runtime.
2. As GM, open an enabled merchant and select **Rollable Tables** (beside Buy/Sell/Manage). Drag a world or compendium RollTable into the drop box, choose a world table from the dropdown, or press **Browse Compendium Tables** to load table compendium indexes and choose one.
3. Adjust **Rolls** per table (1–50) and whether each table is included in **Roll All Tables**. Click **Roll** on one table or **Roll All Tables** to create a non-persisted preview.
4. The preview lists items, prices and quantities. Click **Add** or **Add All Items** to put the results into the merchant's stock. Buying still uses NPC Shops' normal purchase flow and currency handling.
5. Table results referencing an `Item` document or compendium Item are resolved directly using Foundry UUIDs. Entries containing `@UUID[...]` or `@Compendium[...]` are supported. Plain-text item names are matched only if they uniquely identify a world Item, or uniquely match an Item in a Plutonium/5etools or custom-named Item compendium; ambiguous and non-item results are shown under **Unresolved results** and never added.

**Note:** the screenshot label “Roll All Tables” comes from *Item Piles*' merchant population interface, not from Plutonium itself. NPC Shops implements this functionality independently. Native Plutonium content import and its RollTable assets are supported via Foundry's standard document API; not every text-only 5etools table maps automatically to a purchasable Item. Rollable Tables is GM-only and does not expose unrevealed treasure tables to players.

The actor remains a normal NPC; shop stock is stored independently in `flags.npc-shops.shop` rather than mixed with the NPC's combat inventory.

## v0.1.5 additions

- New GM Rollable Tables tab with world/compendium tables, drag and drop, and Roll All Tables.
- Plutonium-linked Item references and cautious exact-name matching to imported Items.
- Preview before adding generated items to shop stock; players see only the resulting shop inventory.

## v0.1.5 Rollable Tables fixes

- Fix Foundry v14 roll results: v14 uses `name`, `description`, `documentUuid`; v11 uses `text`, `documentCollection`, `documentId`.
- Follow embedded UUID/Compendium/Item links in descriptions and support `{@item ...}` tags from 5etools content.
- Find matching actual Plutonium-imported Items by unique name in world Items or Item compendiums.
- Text-only results do **not** automatically become invented items: GM can drag a real Item from a Plutonium Item compendium directly onto an unresolved preview row, or choose **Convert to Loot** and set a price (default 0 GP).
- NPC Shops does not have access to a separate Plutonium database via these tables; Items must be available in the world, a compendium, or drag-dropped from the importer. Pure text tables cannot supply full Item mechanics automatically.

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
