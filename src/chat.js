/** Public trade receipts, created by the processing GM AFTER the transaction is committed. */
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function tradeReceiptContent(receipt) {
  const {kind,buyerName,userName,merchantName,itemName,quantity,totalCp}=receipt;
  if(!['buy','sell'].includes(kind)) throw new Error('Unknown receipt type');
  const qty=Number(quantity),cost=Number(totalCp);
  if(!Number.isSafeInteger(qty)||qty<1||!Number.isSafeInteger(cost)||cost<0) throw new Error('Invalid trade receipt');
  const bought=kind==='buy';
  return '<div class="npc-shops-receipt"><h3>🛍️ NPC Shops — '+(bought?'Purchase':'Sale')+'</h3>'+
    '<p><strong>'+esc(buyerName)+'</strong> ('+esc(userName)+') '+(bought?'bought from':'sold to')+' <strong>'+esc(merchantName)+'</strong></p>'+
    '<p>Item: <strong>'+qty+' × '+esc(itemName)+'</strong></p>'+
    '<p>Total: <strong>'+(cost/100).toFixed(2)+' GP</strong></p></div>';
}

/** Foundry 11 requires the legacy numeric "type" field; newer versions
 * use a style field. Explicit public visibility avoids configured GM roll
 * modes turning a trade receipt into a private/hidden chat message.
 */
export function tradeReceiptData(receipt, {
  generation = Number(globalThis.game?.release?.generation ?? String(globalThis.game?.version ?? '').split('.')[0]),
  constants = globalThis.CONST,
  userId = globalThis.game?.user?.id
} = {}) {
  const data = {
    content: tradeReceiptContent(receipt),
    speaker: {alias:'NPC Shops', scene:null, actor:null, token:null},
    whisper: [],
    blind: false,
    flags: {'npc-shops':{transaction:true}}
  };
  if (userId) data.user = userId;
  if (generation === 11) {
    const ooc = constants?.CHAT_MESSAGE_TYPES?.OOC;
    data.type = Number.isInteger(ooc) ? ooc : 1;
  } else if (generation >= 12) {
    const ooc = constants?.CHAT_MESSAGE_STYLES?.OOC;
    if (Number.isInteger(ooc)) data.style = ooc;
  }
  return data;
}

function chatDocumentClass(candidate) {
  return candidate ?? globalThis.ChatMessage ??
    globalThis.game?.messages?.documentClass ??
    globalThis.getDocumentClass?.('ChatMessage') ?? null;
}

/** Creates one public chat message. Throws on missing document class or vetoed creation;
 * callers must not roll back a successful trade just because ChatMessage creation failed.
 */
export async function publishTradeReceipt(receipt, {
  chatMessage,
  generation = Number(globalThis.game?.release?.generation ?? String(globalThis.game?.version ?? '').split('.')[0]),
  constants = globalThis.CONST,
  userId = globalThis.game?.user?.id
} = {}) {
  const documentClass = chatDocumentClass(chatMessage);
  if (typeof documentClass?.create !== 'function') {
    throw new Error('ChatMessage.create is unavailable on this Foundry client');
  }
  const payload = tradeReceiptData(receipt,{generation,constants,userId});
  try {
    const result = await documentClass.create(payload);
    if (!result) throw new Error('ChatMessage.create returned no message');
    return true;
  } catch (error) {
    // Legacy v11 systems can reject an enriched ChatMessage from older modules.
    // Only retry on an exception, NOT a silent/empty successful result, to avoid
    // duplicate receipts if another module vetoed document creation.
    if (generation !== 11 || error?.message === 'ChatMessage.create returned no message') throw error;
    const minimal = {
      content: payload.content,
      user: payload.user,
      type: payload.type,
      speaker: {alias:'NPC Shops'},
      whisper:[],blind:false
    };
    if (!minimal.user) delete minimal.user;
    const result = await documentClass.create(minimal);
    if (!result) throw new Error('Legacy v11 chat creation returned no message');
    return true;
  }
}
