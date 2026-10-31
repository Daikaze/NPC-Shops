# NPC Shops release publishing (GitHub + Foundry)

GitHub Release **is not** the official Foundry package catalog entry.

GitHub Actions in `release.yml` first validates and uploads `npc-shops.zip` and `module.json` as GitHub release assets. It then calls the [official Foundry Package Release API](https://foundryvtt.com/article/package-release-api/) to register the same version in the [NPC Shops catalog page](https://foundryvtt.com/packages/npc-shops).

## Required once: configure the Foundry token

1. Sign in as the NPC Shops package owner at https://foundryvtt.com/packages/npc-shops/edit/.
2. Copy the **Package Release Token** from the Foundry package management page.
3. Add a new Actions repository secret in GitHub at **Daikaze/NPC-Shops → Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `FOUNDRY_PACKAGE_RELEASE_TOKEN`
   - Value: the Foundry token (do not put it in source files or chats)
4. In GitHub **Actions → Validate and Package NPC Shops → Run workflow** on `main` to register the already-published v0.5.4 release. The workflow will retry the official Foundry registration without bumping the version.

The automated step intentionally **fails with a clear error** if the secret is missing or if Foundry rejects the update. This prevents a successful GitHub release from being mistaken for an official Foundry catalog update.

## Manual alternative

On https://foundryvtt.com/packages/npc-shops/edit/, add **Package Version 0.5.4** with:

- Manifest URL: `https://github.com/Daikaze/NPC-Shops/releases/download/v0.5.4/module.json`
- Foundry minimum: `11`
- Foundry verified: `14`
- Maximum: leave blank
- Release notes URL: `https://github.com/Daikaze/NPC-Shops/releases/tag/v0.5.4`

Click **Save Package**. Use the per-release URL for the official catalog, not `main/module.json`, so users can install historical releases reliably.

Installed users can use **https://raw.githubusercontent.com/Daikaze/NPC-Shops/main/module.json** for automatic update checking even before the official registry is updated, but first-time installs via the Foundry searchable catalog will use whatever official version is registered.

Documentation: https://foundryvtt.com/article/package-management/
