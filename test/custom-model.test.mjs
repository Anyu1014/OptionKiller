import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const endpoints=global.MJZ.core.customEndpoints;
test('custom endpoints accept OpenAI-compatible HTTPS bases and full chat paths',()=>{
 assert.deepEqual(endpoints('https://custom.example/v1/'),{chat:'https://custom.example/v1/chat/completions',models:'https://custom.example/v1/models'});
 assert.deepEqual(endpoints('https://custom.example/v1/chat/completions'),{chat:'https://custom.example/v1/chat/completions',models:'https://custom.example/v1/models'});
 assert.equal(endpoints('http://127.0.0.1:8000/v1').models,'http://127.0.0.1:8000/v1/models');
});
test('custom endpoint rejects insecure non-loopback, credentials, fragments and queries',()=>{
 for(const url of ['http://example.com/v1','https://u:p@example.com/v1','https://example.com/v1?key=secret','https://example.com/v1#x','file:///tmp/x','not-a-url'])assert.throws(()=>endpoints(url),url);
});
