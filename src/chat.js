/** Public trade receipts; created by GM after transaction commit. */
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
export async function publishTradeReceipt(receipt,{chatMessage=globalThis.ChatMessage}={}) {
  if(!chatMessage?.create) return false;
  await chatMessage.create({content:tradeReceiptContent(receipt),
    speaker:chatMessage.getSpeaker?.({alias:'NPC Shops'})??{alias:'NPC Shops'},
    whisper:[],blind:false,flags:{'npc-shops':{transaction:true}}});
  return true;
}
