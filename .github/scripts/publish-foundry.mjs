/**
 * Publish the current GitHub release to Foundry's official package registry.
 * Requires GitHub Actions repository secret FOUNDRY_PACKAGE_RELEASE_TOKEN.
 * The release manifest URL is version-pinned, while module.json's own
 * "manifest" property deliberately points at main for automatic updates.
 */
import {readFile} from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../../module.json", import.meta.url), "utf8"));
const token = (process.env.FOUNDRY_PACKAGE_RELEASE_TOKEN || "").trim();
if (!token) {
  console.error("::error title=Missing Foundry release token::NPC Shops is released on GitHub but cannot appear as a new version in Foundry's official catalog until you add GitHub Actions secret FOUNDRY_PACKAGE_RELEASE_TOKEN. Copy your Package Release Token from https://foundryvtt.com/packages/npc-shops/edit/");
  process.exit(1);
}
const repository = (process.env.GITHUB_REPOSITORY || "Daikaze/NPC-Shops").trim();
const tag = `v${manifest.version}`;
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== tag) {
  throw new Error(`Release tag mismatch: expected ${tag}, got ${process.env.GITHUB_REF_NAME}`);
}
const url = `https://github.com/${repository}/releases/download/${tag}/module.json`;
const payload = {
  id: manifest.id,
  release: {
    version: manifest.version,
    manifest: url,
    notes: `https://github.com/${repository}/releases/tag/${tag}`,
    compatibility: {
      minimum: String(manifest.compatibility?.minimum ?? ""),
      verified: String(manifest.compatibility?.verified ?? ""),
      maximum: String(manifest.compatibility?.maximum ?? "")
    }
  }
};
if (!payload.release.compatibility.minimum || !payload.release.compatibility.verified) {
  throw new Error("Foundry compatibility minimum and verified must both be defined");
}
const endpoint = "https://foundryvtt.com/_api/packages/release_version/";
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: token,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(30000)
});
const message = await response.text();
let body;
try { body = JSON.parse(message); } catch { body = {message: message.slice(0,500)}; }
if (!response.ok || body?.status !== "success") {
  console.error(`::error title=Foundry catalog update failed::HTTP ${response.status}: ${JSON.stringify(body).slice(0,1000)}`);
  process.exit(1);
}
console.log(`Foundry official package registry updated: ${manifest.id} v${manifest.version}`);
console.log(`Release manifest: ${url}`);
