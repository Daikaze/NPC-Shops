import test from 'node:test';
import assert from 'node:assert/strict';
import {tradeReceiptContent,publishTradeReceipt} from '../src/chat.js';
test('receipt shows actor, player, merchant, item and price while escaping HTML',()=>{
 const html=tradeReceiptContent({kind:'buy',buyerName:'Rashira',userName:'Player & A',merchantName:'Kiro Shop',itemName:'<script>bad</script>',quantity:2,totalCp:1000});
 assert.match(html,/Rashira/);assert.match(html,/Player &amp; A/);assert.match(html,/Kiro Shop/);
 assert.match(html,/2 × &lt;script&gt;/);assert.match(html,/10.00 GP/);assert.doesNotMatch(html,/<script>/);
});
test('sale receipt is sent to public chat, not as a whisper',async()=>{
 let payload;
 await publishTradeReceipt({kind:'sell',buyerName:'Hero',userName:'Player',merchantName:'Mura',itemName:'Sword',quantity:1,totalCp:500},{chatMessage:{getSpeaker:()=>({alias:'NPC Shops'}),create:async data=>{payload=data;}}});
 assert.deepEqual(payload.whisper,[]);assert.equal(payload.blind,false);assert.match(payload.content,/Sale/);assert.match(payload.content,/sold to/);
});
