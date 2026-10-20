import test from 'node:test';
import assert from 'node:assert/strict';
import {tradeReceiptContent,tradeReceiptData,publishTradeReceipt} from '../src/chat.js';

const receipt = {kind:'buy',buyerName:'Rashira',userName:'Player & A',merchantName:'Kiro Shop',itemName:'<script>bad</script>',quantity:2,totalCp:1000};

test('receipt includes character, player, merchant, item, amount; HTML is escaped',()=>{
  const html=tradeReceiptContent(receipt);
  assert.match(html,/Rashira/);
  assert.match(html,/Player &amp; A/);
  assert.match(html,/Kiro Shop/);
  assert.match(html,/2 × &lt;script&gt;/);
  assert.match(html,/10.00 GP/);
  assert.doesNotMatch(html,/<script>/);
});
test('v11 uses numeric OOC chat type, GM speaker and public visibility',()=>{
  const d=tradeReceiptData(receipt,{generation:11,constants:{CHAT_MESSAGE_TYPES:{OOC:1}},userId:'GM'});
  assert.equal(d.type,1);
  assert.equal(d.style,undefined);
  assert.equal(d.user,'GM');
  assert.deepEqual(d.whisper,[]);
  assert.equal(d.blind,false);
  assert.equal(d.speaker.alias,'NPC Shops');
});
test('v14 uses style rather than old numeric message type',()=>{
  const d=tradeReceiptData(receipt,{generation:14,constants:{CHAT_MESSAGE_STYLES:{OOC:1}},userId:'GM'});
  assert.equal(d.type,undefined);
  assert.equal(d.style,1);
  assert.deepEqual(d.whisper,[]);
});
test('v11 purchase creates an actual chat document with explicit numeric type',async()=>{
  let payload;
  const doc={create:async data=>{payload=data;return {id:'chat1'}}};
  const published=await publishTradeReceipt(receipt,{chatMessage:doc,generation:11,constants:{CHAT_MESSAGE_TYPES:{OOC:1}},userId:'GM'});
  assert.equal(published,true);
  assert.equal(payload.type,1);
  assert.match(payload.content,/Purchase/);
  assert.deepEqual(payload.whisper,[]);
});
test('sale produces public v14 message without legacy numeric type',async()=>{
  let payload;
  const doc={create:async data=>{payload=data;return {id:'chat2'}}};
  const published=await publishTradeReceipt({...receipt,kind:'sell'},{
    chatMessage:doc,generation:14,constants:{CHAT_MESSAGE_STYLES:{OOC:1}},userId:'GM'});
  assert.equal(published,true);
  assert.equal(payload.style,1);
  assert.match(payload.content,/Sale/);
  assert.match(payload.content,/sold to/);
});
test('v11 falls back to minimal chat payload when enriched creation throws',async()=>{
  const calls=[];
  const doc={create:async data=>{
    calls.push(data);
    if(calls.length===1) throw Error('Legacy chat flags rejected');
    return {id:'fallback-success'};
  }};
  assert.equal(await publishTradeReceipt(receipt,{
    chatMessage:doc,generation:11,constants:{CHAT_MESSAGE_TYPES:{OOC:1}},userId:'GM'
  }),true);
  assert.equal(calls.length,2);
  assert.equal(calls[1].type,1);
  assert.equal(calls[1].flags,undefined);
  assert.deepEqual(calls[1].whisper,[]);
});
test('failure does not silently claim that a receipt was published',async()=>{
  await assert.rejects(publishTradeReceipt(receipt,{chatMessage:{},generation:11}),/unavailable/);
  await assert.rejects(publishTradeReceipt(receipt,{chatMessage:{create:async()=>undefined},generation:11}),/no message/);
});
test('v11 does not retry on vetoed/empty create',async()=>{
  let count=0;
  await assert.rejects(publishTradeReceipt(receipt,{chatMessage:{create:async()=>{count++;return null;}},generation:11}),/no message/);
  assert.equal(count,1);
});
