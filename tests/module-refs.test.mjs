import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// index.html 의 모듈은 정규식 패치로 편집되는 일이 많아, 함수 하나가 통째로
// 사라져도 문법 오류가 나지 않는다 (호출 시점에야 ReferenceError). 실제로
// pickTile 이 그렇게 지워진 적이 있어서, 호출되는 이름이 선언돼 있는지 검사한다.

const HTML = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function moduleSource(id){
  const m = HTML.match(new RegExp('<script id="' + id + '"[^>]*>([\\s\\S]*?)</script>'));
  assert.ok(m, `${id} 스크립트를 찾지 못했습니다`);
  return m[1];
}

// 브라우저/언어가 제공하거나 다른 스크립트에서 오는 이름들
const GLOBALS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new',
  'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'Set', 'Map',
  'Date', 'RegExp', 'Error', 'Promise', 'parseInt', 'parseFloat', 'isNaN',
  'document', 'window', 'localStorage', 'sessionStorage', 'console', 'confirm',
  'alert', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'speechSynthesis',
  'SpeechSynthesisUtterance', 'Event', 'CustomEvent', 'fetch', 'encodeURIComponent'
]);

function declaredNames(src){
  const names = new Set();
  for(const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for(const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for(const m of src.matchAll(/\bfunction\s*\(([^)]*)\)/g))
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(a => names.add(a));
  for(const m of src.matchAll(/\(([^)]*)\)\s*=>/g))
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(a => names.add(a));
  for(const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1]);
  return names;
}

function calledNames(src){
  // 문자열/템플릿/주석 안의 호출 모양은 제외한다
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
  const out = new Set();
  for(const m of stripped.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) out.add(m[2]);
  return out;
}

for(const id of ['quiz-module', 'write-module']){
  test(`${id}: 호출하는 함수가 모두 선언돼 있다`, () => {
    const src = moduleSource(id);
    const declared = declaredNames(src);
    const missing = [...calledNames(src)].filter(n => !declared.has(n) && !GLOBALS.has(n));
    assert.deepEqual(missing, [], `선언되지 않은 호출: ${missing.join(', ')}`);
  });
}

test('quiz-module: 리스닝 단계 함수가 모두 살아 있다', () => {
  const src = moduleSource('quiz-module');
  for(const fn of ['qzWords', 'goListen', 'sayLine', 'whenVoicesReady', 'pickTile',
                   'unpickTile', 'checkOrder', 'revealOrder', 'listenHTML'])
    assert.ok(src.includes('function ' + fn + '('), `${fn} 이 없습니다`);
});

test('index.html: 스크립트 블록이 문법적으로 유효하다', () => {
  for(const id of ['quiz-module', 'write-module'])
    assert.doesNotThrow(() => new Function(moduleSource(id)), id);
});
