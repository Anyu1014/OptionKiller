import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const swipe=globalThis.MJZ.core.swipeDirection;
test('horizontal swipes need distance and dominance over vertical movement',()=>{
 assert.equal(swipe(-120,10),1);assert.equal(swipe(120,10),-1);assert.equal(swipe(69,0),0);assert.equal(swipe(80,70),0);assert.equal(swipe(0,160),0);assert.equal(swipe(NaN,0),0);
});
