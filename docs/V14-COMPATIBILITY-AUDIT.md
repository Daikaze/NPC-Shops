# Foundry V14 module interoperability review — 2026-10-31

Scope: **static code inspection**, not a running Foundry V14/D&D 5e 6.0.6 integration test. Only NPC Shops is changed in this branch.

## NPC Shops findings and changes
- Existing storefront and merchant directory bypassed Foundry's application/window manager and manually handled dragging, resizing, minimizing, and z-index.
- Existing CSS overrode color/background/button/window dimensions in multiple historical stylesheets. These were susceptible to interference by other UI themes.
- V14 uses a **real ApplicationV2** frame for each merchant and the shop directory, with core titlebar, resize, minimize and stack ordering.
- New V14 styling is scoped to `.application.npc-shops-native`, loaded after legacy CSS. No global actor-sheet, button, or Token HUD styling is changed.
- V11 continues to use the previous storefront, preserving its behavior and all purchase/stock/ledger/cart code.
- Trading, sockets, RollTables, actor ownership, and player visibility require live V14 testing; this branch changes the interface, not those algorithms.

## Coexistence scan of the other modules

| Repository | Advertised compatibility | Overlap / potential interaction |
|---|---|---|
| Averis-Affinity-Manager | V14 + dnd5e 6.0.6 | Actor sheet integration and updateActor; no global sheet override identified |
| Gathering-Crafting | V14 + dnd5e 6.0.6 | Adds UI on renderActorDirectory[V2] and renderActorSheet[V2]; inspect actual sheet together in live runtime |
| Gods | V14 + dnd5e 6.0.6 | Adds distinct `gods` scene control group |
| Token-Atelier | V13–V14 | Adds `token-atelier` scene control group and ActorSheetV2 header button |
| Token-Hover-Art | V14 | Own TokenHUD + ActorSheet header hooks; separate CSS namespace |
| talking-tokens-v14. | V14 | Adds `talking-tokens` and `talking-tokens-gm-npc` tools under `controls.tokens` |
| Sheet-storage | V14 + dnd5e 6.0.6 | Adds `tokenFormStorage` header control and TokenHUD button; uses different selector from NPC Shops |
| Private-Message | V14 | Adds item directory/item context menu entries |
| DMG-Meter | V14 | Adds distinct `averisHighestDmg` scene control group; listens to post-apply damage hooks |
| Damage-Traker | V11 ONLY | Not considered V14-compatible; exclude from V14 loadouts |
| Bingo-Book | V11 ONLY (tracked list) | Exclude from V14 loadouts |

### CSS inspection
The inspected CSS entrypoints for the V14 modules mostly use module-specific class prefixes rather than broad `button` or `.window-content` rules. NPC Shops' previous extensive `!important` custom styling was its own largest interface risk; the V14 override is scoped to the module's native frame.

### Testing before merging/publishing
1. Enable NPC Shops, Token Hover Art, Sheet Storage, Token Atelier, Affinity Manager, Gods, Gathering & Crafting, Talking Tokens, Private Message, and DMG Meter together on a V14 / dnd5e 6.0.6 test world.
2. Test open/minimize/maximize/resize/close on a shop and the directory; open Actor/Item sheets above the shop.
3. Test Buy, Sell, GM Give, cashbox, stock editing, drag/drop, RollTables, clear history/stock, and permissions as GM and player.
4. Select the same NPC token with NPC Shops, Sheet Storage and Token Hover Art enabled; verify each control opens only its own dialog.
5. Open PC/NPC actor sheets and check controls from Sheet Storage, Token Atelier, Affinity Manager, Token Hover Art and Gathering & Crafting coexist.
6. Check browser console for hook errors, CSS bleed, bad `ApplicationV2` action dispatch, or duplicate HUD buttons.
7. Run repository Node tests and syntax checks. Keep V11 as a regression target.

**Conclusion:** No direct name collision or cross-module global CSS reset was found in the inspected entrypoints, but *static review cannot guarantee that the modules work together in-game*. Do not publish the change as verified until the V14 integration checks pass.
