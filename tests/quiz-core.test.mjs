import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, loadFolders } from './extract.mjs';

const C = loadCore();
const FOLDERS = loadFolders();

test('qNorm: 소문자화 + 문장부호 제거', () => {
  assert.equal(C.qNorm("Let's HIT the road, now!"), 'let us hit the road now');
});

test('qNorm: 축약형 확장', () => {
  assert.equal(C.qNorm("We'll go"), 'we will go');
  assert.equal(C.qNorm("I'm ready"), 'i am ready');
  assert.equal(C.qNorm("don't stop"), 'do not stop');
  assert.equal(C.qNorm("can't wait"), 'cannot wait');
  assert.equal(C.qNorm("won't leave"), 'will not leave');
  assert.equal(C.qNorm("they've seen it"), 'they have seen it');
  assert.equal(C.qNorm("he's here"), 'he is here');
});

test('qNorm: 소유격 아포스트로피는 단어를 붙여서 정규화', () => {
  assert.equal(C.qNorm("a runner's high"), 'a runners high');
});

test('qNorm: 빈 입력', () => {
  assert.equal(C.qNorm(''), '');
  assert.equal(C.qNorm(null), '');
});

test('qRatio: 완전 일치는 1', () => {
  const m = C.qTokens("We hit the road early");
  assert.equal(C.qRatio(m, m), 1);
});

test('qRatio: 내용어 절반만 맞으면 0.5', () => {
  // 내용어: hit, road, early (the/we 는 불용어가 아니므로 we 포함)
  const model = C.qTokens("hit road early");
  const user = C.qTokens("hit road");
  assert.equal(C.qRatio(user, model), 2 / 3);
});

test('qHasExpression: 어형변화를 허용한다', () => {
  assert.equal(C.qHasExpression(C.qTokens("We're hitting the road now"), 'hit the road'), true);
  assert.equal(C.qHasExpression(C.qTokens("We left early"), 'hit the road'), false);
});

test('qGrade: 모범답안 그대로면 정답', () => {
  const r = C.qGrade("We hit the road early.", 'hit the road', 'We hit the road early.');
  assert.equal(r.ok, true);
  assert.equal(r.ratio, 1);
});

test('qGrade: 축약형만 다르면 정답', () => {
  const r = C.qGrade("We'll hit the road soon", 'hit the road', 'We will hit the road soon.');
  assert.equal(r.ok, true);
});

test('qGrade: 핵심 표현이 빠지면 유사도가 높아도 오답', () => {
  const r = C.qGrade("We left the house early", 'hit the road', 'We hit the road early');
  assert.equal(r.hasExpr, false);
  assert.equal(r.ok, false);
});

test('qGrade: 핵심 표현은 있어도 유사도가 낮으면 오답', () => {
  const r = C.qGrade("hit the road", 'hit the road',
    'We usually hit the road at dawn so we can beat the traffic');
  assert.equal(r.hasExpr, true);
  assert.ok(r.ratio < 0.8);
  assert.equal(r.ok, false);
});

test('qGrade: 빈 답은 오답', () => {
  const r = C.qGrade("   ", 'hit the road', 'We hit the road early');
  assert.equal(r.ok, false);
  assert.equal(r.ratio, 0);
});

test('qGrade: missing 은 모범답안에서 빠뜨린 내용어', () => {
  const r = C.qGrade("We hit the road", 'hit the road', 'We hit the road early');
  assert.deepEqual(r.missing, ['early']);
});

test('qGrade: extra 는 모범답안에 없는 내용어', () => {
  const r = C.qGrade("We hit the road quickly", 'hit the road', 'We hit the road early');
  assert.deepEqual(r.extra, ['quickly']);
});

test('qBuildPool: 표현 수 x 4시제', () => {
  const pool = C.qBuildPool(FOLDERS);
  const cards = FOLDERS.reduce((a, f) => a + f.cards.length, 0);
  assert.equal(pool.length, cards * 4);
  assert.equal(new Set(pool).size, pool.length);
});

test('qLookup: id로 B1 문장을 찾는다', () => {
  const pool = C.qBuildPool(FOLDERS);
  const item = C.qLookup(FOLDERS, pool[0]);
  const c = FOLDERS[0].cards[0];
  assert.equal(item.ko, c.practice.B1.present.ko);
  assert.equal(item.en, c.practice.B1.present.en);
  assert.equal(item.expression, c.expression);
  assert.equal(item.folderId, FOLDERS[0].id);
  assert.equal(item.tense, 'present');
});

test('qLookup: 모든 풀 항목이 조회 가능하다', () => {
  const pool = C.qBuildPool(FOLDERS);
  for(const id of pool){
    const it = C.qLookup(FOLDERS, id);
    assert.ok(it && it.ko && it.en, `조회 실패: ${id}`);
  }
});

test('qLookup: 없는 id는 null', () => {
  assert.equal(C.qLookup(FOLDERS, 'nope|0|present'), null);
  assert.equal(C.qLookup(FOLDERS, FOLDERS[0].id + '|9999|present'), null);
});

const seq = (...ns) => { let i = 0; return () => ns[i++ % ns.length]; };

test('qRefill: 빈 큐를 5개로 채운다', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const q = C.qRefill([], pool, {}, seq(0));
  assert.equal(q.length, 5);
  assert.equal(new Set(q).size, 5);
});

test('qRefill: 기존 큐를 유지하고 모자란 만큼만 채운다', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const q = C.qRefill(['a', 'b'], pool, {}, seq(0));
  assert.equal(q.length, 5);
  assert.deepEqual(q.slice(0, 2), ['a', 'b']);
});

test('qRefill: 완료한 문장은 다시 뽑지 않는다', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  const q = C.qRefill([], pool, { a: { wrong: 0 }, b: { wrong: 1 } }, seq(0));
  assert.deepEqual(q, ['c', 'd', 'e', 'f']);
});

test('qRefill: 남은 문장이 부족하면 5개 미만으로 둔다', () => {
  const q = C.qRefill(['x'], ['x', 'y'], {}, seq(0));
  assert.deepEqual(q, ['x', 'y']);
});

test('qRefill: 풀이 소진되면 큐를 그대로 돌려준다', () => {
  const q = C.qRefill(['x'], ['x'], {}, seq(0));
  assert.deepEqual(q, ['x']);
});

test('qShuffle: 원본을 바꾸지 않고 같은 원소를 돌려준다', () => {
  const src = ['a', 'b', 'c', 'd', 'e'];
  const out = C.qShuffle(src, seq(0.9, 0.1, 0.5, 0.3));
  assert.deepEqual(src, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual([...out].sort(), [...src].sort());
});

test('qzWords: 문장부호를 떼고 단어만 남긴다', () => {
  assert.deepEqual(C.qzWords("We'll hit the road soon, okay?"),
    ["We'll", 'hit', 'the', 'road', 'soon', 'okay']);
});

test('qzWords: 모든 B1 문장에서 빈 타일이 생기지 않는다', () => {
  for(const id of C.qBuildPool(FOLDERS)){
    const en = C.qLookup(FOLDERS, id).en;
    const ws = C.qzWords(en);
    assert.ok(ws.length >= 2 && ws.every(w => w.trim()), `타일 문제: ${en}`);
  }
});

const V = (name, lang, local = true) => ({name, lang, localService: local});

test('rankVoices: 영어 음성만 남긴다', () => {
  const out = C.rankVoices([V('Microsoft Heami', 'ko-KR'), V('Google US English', 'en-US', false)]);
  assert.deepEqual(out.map(v => v.name), ['Google US English']);
});

test('rankVoices: 신경망 음성을 구형 SAPI 음성보다 앞에 둔다', () => {
  const out = C.rankVoices([
    V('Microsoft David - English (United States)', 'en-US'),
    V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false),
    V('Microsoft Zira - English (United States)', 'en-US')
  ]);
  assert.match(out[0].name, /Aria/);
});

test('rankVoices: compact 음성을 가장 뒤로 보낸다', () => {
  const out = C.rankVoices([V('Samantha (Compact)', 'en-US'), V('Samantha', 'en-US')]);
  assert.deepEqual(out.map(v => v.name), ['Samantha', 'Samantha (Compact)']);
});

test('rankVoices: 안드로이드 기본 조합에서 Google 음성을 고른다', () => {
  const out = C.rankVoices([V('English United Kingdom', 'en-GB'), V('Google US English', 'en-US', false)]);
  assert.equal(out[0].name, 'Google US English');
});

test('voiceScore: en-US 를 다른 영어권보다 높게 본다', () => {
  assert.ok(C.voiceScore(V('Daniel', 'en-US')) > C.voiceScore(V('Daniel', 'en-GB')));
});
