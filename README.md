# NPC Shops

**Experimental alpha v0.1.0** — A custom NPC merchant module for Foundry VTT. Target installations are **Foundry 11 / dnd5e 3.3.1** and **Foundry 14 / dnd5e 5.3.3**. These targets need live validation; do not interpret the manifest's `verified` field as a claim of v14 testing.

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

1. Place an NPC token on a Scene; select it and press **Alt+S**. A small shop button is also attempted in the token HUD.
2. As GM, click **Make Merchant**, open the **Manage** tab, and drag Items into the drop zone. New stock starts at quantity 1; customize the price and stock, then **Save**.
3. Players select the merchant token, press **Alt+S**, pick an owned character, and use the **Buy** or **Sell** tab.
4. A GM must be online to process player transactions. All shop configuration happens on the GM client.

The actor remains a normal NPC; shop stock is stored independently in `flags.npc-shops.shop` rather than mixed with the NPC's combat inventory.

## Important limitations and safeguards

- **ALPHA — back up the World before use**, test on copies first, and verify version compatibility on actual v11/3.3.1 and v14/5.3.3 installations.
- Transactions touch multiple documents and are **not database-atomic**; best-effort rollback cannot guarantee recovery if Foundry crashes or other modules interfere mid-trade.
- Requests use standard Foundry module socket messages. A client might forge a requester ID; **do not treat this module as secure against malicious players**. Use on trusted tables and inspect the ledger. Full trustworthy sender authentication requires server-side handling or another authenticated protocol.
- Wallet amounts are re-normalized into PP/GP/EP/SP/CP (standard D&D 5e exchange values) when trading, so denominations may change. Custom currencies are not supported.
- Selling is limited to physical `weapon`, `equipment`, `consumable`, `tool`, and `loot` items. Containers, nested items, and nonstandard currencies are excluded in this alpha.
- Merchants are **world Actors**, not unlinked synthetic tokens or Compendium-only Actors. Shop transfers create new item entries rather than automatically stacking identical items.
- A GM can manage stock concurrently with a player purchase; do not edit shop inventory while players transact. Multiple simultaneously active GMs use the lowest-ID active GM as processing host; unusual GM disconnects can interrupt an in-flight trade.
- The `getFlag` stock data may be large with numerous item snapshots. Keep inventory moderate.
- Existing modules that replace Token HUD or drag data payloads may need additional integrations. **Alt+S is always the primary entry point**.

## Developer API

`game.modules.get('npc-shops').api.open(actor)` or `.openSelected()`.

## Roadmap

- Tests on both target combinations, UI polish and localization.
- Stronger transaction identity checks, pre-trade currency snapshot validation, sale confirmation, restock controls.
- Optional inventory stacking, per-item pricing multipliers, and GM approval mode.

## License

MIT.
