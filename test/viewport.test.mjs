import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('viewport and native shells match the fixed-scale layout', () => {
  assert.match(read('../web/index.html'), /name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/);
  assert.match(read('../web/css/app.css'), /html, body\s*\{\s*touch-action:\s*pan-x pan-y/);
  const android = read('../android/app/src/main/java/com/optionkiller/app/MainActivity.java');
  assert.match(android, /setSupportZoom\(false\)/);
  assert.match(android, /setTextZoom\(100\)/);
  const ios = read('../ios/OptionKiller/ViewController.swift');
  assert.match(ios, /pinchGestureRecognizer\?\.isEnabled = false/);
  assert.match(ios, /maximumZoomScale = 1/);
});
