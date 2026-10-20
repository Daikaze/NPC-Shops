/** Only D&D 5e NPC actors may be converted into shops.
 * Use the linked Token Actor first (supports v11/v14 and unlinked tokens);
 * only fall back to the World Actor if a Token Actor is unavailable.
 */
export function isNpcActor(actor) {
  return actor?.type === 'npc';
}

export function tokenActor(token, getWorldActor = id => globalThis.game?.actors?.get(id)) {
  if (!token) return null;
  if (token.actor) return token.actor;
  if (token.document?.actor) return token.document.actor;
  const id = token.document?.actorId;
  if (!id || typeof getWorldActor !== 'function') return null;
  return getWorldActor(id) ?? null;
}

export function isNpcToken(token, getWorldActor) {
  return isNpcActor(tokenActor(token,getWorldActor));
}
