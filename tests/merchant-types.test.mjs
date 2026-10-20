import test from 'node:test';
import assert from 'node:assert/strict';
import {isNpcActor,isNpcToken,tokenActor} from '../src/merchant-types.js';
test('D&D 5e NPC type is eligible, character type is not',()=>{
 assert.equal(isNpcActor({type:'npc'}),true);
 assert.equal(isNpcActor({type:'character'}),false);
 assert.equal(isNpcActor({type:'vehicle'}),false);
 assert.equal(isNpcActor({}),false);
});
test('direct Token actor takes precedence over world actor (synthetic/unlinked NPC support)',()=>{
 const token={actor:{type:'npc'},document:{actorId:'base'}};
 assert.equal(isNpcToken(token,()=>({type:'character'})),true);
 token.actor.type='character';
 assert.equal(isNpcToken(token,()=>({type:'npc'})),false);
});
test('fallbacks support v11 and v14 token document Actor resolution',()=>{
 assert.equal(isNpcToken({document:{actorId:'a',actor:{type:'npc'}}}),true);
 assert.equal(isNpcToken({document:{actorId:'a'}},()=>({type:'npc'})),true);
 assert.equal(isNpcToken({document:{actorId:'b'}},()=>({type:'character'})),false);
 assert.equal(tokenActor(null),null);
 assert.equal(isNpcToken({document:{}}),false);
});
