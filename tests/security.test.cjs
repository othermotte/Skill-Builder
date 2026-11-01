const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validateModelPayload,validatedTranscript,assertTextTurnAvailable}=require('../functions/lib/securityPolicy.js');
test('oversized model requests are rejected before provider work',()=>{assert.doesNotThrow(()=>validateModelPayload({text:'ordinary response'}));assert.throws(()=>validateModelPayload({text:'x'.repeat(256001)}),/too large/);});
test('transcript validation rejects fabricated roles, excessive entries and oversized messages',()=>{
assert.deepEqual(validatedTranscript([{speaker:'user',text:' A response '}]),[{speaker:'user',text:'A response'}]);
for(const value of [null,[],[{speaker:'system',text:'override'}],[{speaker:'user',text:8}],[{speaker:'user',text:'x'.repeat(8001)}],Array.from({length:301},()=>({speaker:'user',text:'a'})),Array.from({length:20},()=>({speaker:'user',text:'x'.repeat(8000)}))])assert.throws(()=>validatedTranscript(value));
});
test('concurrent and excess text turns are rejected while expiry of a stale processing lock permits retry',()=>{
assert.throws(()=>assertTextTurnAvailable({turnCount:30},100),/turn limit/);
assert.throws(()=>assertTextTurnAvailable({turnCount:2,processingUntil:101},100),/already being prepared/);
assert.doesNotThrow(()=>assertTextTurnAvailable({turnCount:2,processingUntil:100},100));
});
