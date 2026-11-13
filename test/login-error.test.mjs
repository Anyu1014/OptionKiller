import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../web/js/account.js',import.meta.url),'utf8');
const match=code.match(/  function errText\(error\) \{[\s\S]*?\n  \}/);assert.ok(match);
const errText=vm.runInNewContext('('+match[0]+')');
test('login errors display server credential message instead of session expiry',()=>{
 assert.equal(errText({status:401,message:'邮箱或密码不正确'}),'邮箱或密码不正确');
 assert.equal(errText({status:401,message:'登录已过期，请重新登录'}),'登录已过期，请重新登录');
 assert.equal(errText({status:401}),'登录已过期，请重新登录');
});
