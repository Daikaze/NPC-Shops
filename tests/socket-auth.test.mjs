import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorizeSocketMessage} from '../src/socket-auth.js';

const trade = (userId='player') => ({
  type:'request', payload:{
    action:'trade', userId, requestId:'outer-1',
    details:{userId,requestId:'trade-1',merchantId:'shop',buyerId:'character',kind:'buy',skuId:'sword',quantity:1}
  }
});

test('matching authenticated sender is allowed to request a GM-validated trade',()=>{
  assert.deepEqual(authorizeSocketMessage(trade(), 'player', 'gm'), trade());
  const shop={type:'request',payload:{action:'shop',userId:'player',requestId:'req-1',merchantId:'shop'}};
  assert.deepEqual(authorizeSocketMessage(shop,'player','gm'),shop);
});
test('forged packet userId cannot impersonate another player or GM',()=>{
  assert.equal(authorizeSocketMessage(trade('victim'),'attacker','gm'),null);
  assert.equal(authorizeSocketMessage(trade('gm'),'player','gm'),null);
  assert.equal(authorizeSocketMessage(trade(),'','gm'),null);
  assert.equal(authorizeSocketMessage(trade(),undefined,'gm'),null);
});
test('nested trade user identity is also validated against the authenticated sender',()=>{
  const packet=trade();
  packet.payload.details.userId='victim';
  assert.equal(authorizeSocketMessage(packet,'player','gm'),null);
  packet.payload.details.userId='player';
  delete packet.payload.details.requestId;
  assert.equal(authorizeSocketMessage(packet,'player','gm'),null);
});
test('reject unknown or malformed requests before invoking GM handler',()=>{
  const bad=trade();
  bad.payload.action='unsafe-mutate';
  assert.equal(authorizeSocketMessage(bad,'player','gm'),null);
  assert.equal(authorizeSocketMessage({type:'request',payload:{action:'trade',userId:'player',requestId:'x'}},'player','gm'),null);
  assert.equal(authorizeSocketMessage({type:'request',payload:{action:'shop',userId:'player',requestId:''}},'player','gm'),null);
  assert.equal(authorizeSocketMessage(null,'player','gm'),null);
});
test('only the real active GM can send a transaction result or shop refresh',()=>{
  const response={type:'response',to:'player',requestId:'outer-1',result:{ok:true}};
  assert.deepEqual(authorizeSocketMessage(response,'gm','gm'),response);
  assert.equal(authorizeSocketMessage(response,'attacker','gm'),null);
  const changed={type:'shop-changed',merchantId:'shop'};
  assert.deepEqual(authorizeSocketMessage(changed,'gm','gm'),changed);
  assert.equal(authorizeSocketMessage(changed,'attacker','gm'),null);
  assert.equal(authorizeSocketMessage(changed,'gm',undefined),null);
});
test('Foundry message handler calls socket authorizer with server-supplied senderId',()=>{
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(source,/async \(incoming, senderId\) =>/);
  assert.match(source,/authorizeSocketMessage\(incoming, senderId,/);
  assert.match(source,/payload = \{\.\.\.data\.payload, userId: senderId\}/);
  assert.match(source,/payload\.details = \{\.\.\.payload\.details, userId: senderId\}/);
  assert.match(source,/to:senderId,requestId:payload\.requestId/);
});
