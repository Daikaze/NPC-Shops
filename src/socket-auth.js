/** Validate packets using the sender ID supplied by Foundry's socket server.
 * Never treat a userId inside a packet as proof of identity.
 * Foundry V11/V14 relays the authenticated sender as the second listener argument.
 */
const ACTIONS = new Set(['trade', 'shop', 'item', 'directory']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 100;

export function authorizeSocketMessage(packet, senderId, primaryGMId) {
  // Fail closed on missing sender metadata, including unsupported host versions.
  if (!identifier(senderId) || !object(packet)) return null;
  if (packet.type === 'response') {
    return senderId === primaryGMId && identifier(packet.to) && identifier(packet.requestId) ? packet : null;
  }
  if (packet.type === 'shop-changed') {
    return senderId === primaryGMId && identifier(packet.merchantId) ? packet : null;
  }
  if (packet.type !== 'request' || !object(packet.payload)) return null;
  const {payload} = packet;
  if (!ACTIONS.has(payload.action) || !identifier(payload.requestId)) return null;
  // Explicitly refuse conflicting claims instead of silently trusting them.
  if (payload.userId !== senderId) return null;
  if (payload.action === 'trade') {
    if (!object(payload.details) || payload.details.userId !== senderId ||
        !identifier(payload.details.requestId)) return null;
  }
  return packet;
}
