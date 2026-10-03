import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 보카 모듈의 순수 로직은 /* VOCA-TESTABLE-START */ ~ /* VOCA-TESTABLE-END */ 로 마킹돼 있다.
// (퀴즈 탭의 TESTABLE 블록과 이름이 섞이지 않게 마커를 따로 쓴다)
const HTML = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadVoca(){
  const re = /\/\* VOCA-TESTABLE-START \*\/([\s\S]*?)\/\* VOCA-TESTABLE-END \*\//g;
  let src = '', m, blocks = 0;
  while((m = re.exec(HTML))){ src += m[1] + '\n'; blocks++; }
  if(blocks < 2) throw new Error(`VOCA-TESTABLE 블록을 ${blocks}개만 찾았습니다 (2개 이상 필요)`);
  const names = ['vkBlank','vkParseExpr','vkNorm','vkSameAnswer','vkHintOf','vkGrade','vkReview','VK_STEPS','VK_STEP_KO',
    'VK_KNOWN_STEP','vkDay','vkAddDays','vkWeekStart','vkStreak','vkBotXp','vkRank','vkTierAfter','VK_BOTS','vkShadow','vkShuffle','VK_DAY'];
  return new Function(src + '\nreturn {' + names.join(',') + '};')();
}
const V = loadVoca();
const FOLDERS = JSON.parse(HTML.match(/<script id="conv-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).folders;

// 빈칸을 [정답] 으로 표시한 문자열
function show(en, expr){
  const segs = V.vkBlank(en, expr);
  return segs ? segs.map(g => g.t === 'b' ? '[' + g.v + ']' : g.v).join('') : null;
}

test('vkBlank: 그대로 들어간 표현', () => {
  assert.equal(show("Let's hit the road right after breakfast.", 'hit the road'), "Let's [hit the road] right after breakfast.");
});

test('vkBlank: 진행형·과거형 어형변화', () => {
  assert.equal(show("We're hitting the road now.", 'hit the road'), "We're [hitting the road] now.");
  assert.equal(show('She rang up my items.', 'ring up (something)'), 'She [rang up] my items.');
  assert.equal(show('That sounded amazing!', 'That sounds amazing!'), '[That sounded amazing]!');
});

test('vkBlank: 자리표시 (someone)·(one\'s) 단어는 보이게 둔다', () => {
  assert.equal(show('A taxi cut me off at the light.', 'cut (someone) off'), 'A taxi [cut] me [off] at the light.');
  assert.equal(show('I checked my balance this morning.', "check (one's) balance"), 'I [checked] my [balance] this morning.');
});

test('vkBlank: 끼어든 단어는 빈칸으로 만들지 않는다', () => {
  assert.equal(show('After seeing the price, I put the wine back on the shelf.', 'put (something) back on the shelf'),
    'After seeing the price, I [put] the wine [back on the shelf].');
  assert.equal(show('After a hard day, I make my whiskey a double.', 'make it a double'), 'After a hard day, I [make] my whiskey [a double].');
});

test('vkBlank: A/B 대안 표현', () => {
  assert.equal(show("I'll root for you all the way.", 'Root for/Cheer for'), "I'll [root for] you all the way.");
  assert.equal(show('We are dropping off the car now.', 'pick up/drop off a car'), 'We are [dropping off the car] now.');
  assert.equal(show('That referee made a bad call.', 'Make a (bad/good) call'), 'That referee [made a bad call].');
});

test('vkBlank: 축약형 안의 표현 (you\'ve done, he\'s turning)', () => {
  assert.equal(show("I love what you've done with the place.", 'Love what (someone) has done with the place'),
    "I [love what] you've [done with the place].");
  assert.equal(show("Do you know how old he's turning this year?", 'how old (someone) is turning'),
    "Do you know [how old] he's [turning] this year?");
});

test('vkBlank: 표현이 없으면 null', () => {
  assert.equal(V.vkBlank('I like coffee.', 'hit the road'), null);
});

test('vkBlank: 전체 문장의 95% 이상에서 빈칸을 만들고, 모든 카드가 출제 가능한 문장을 가진다', () => {
  let total = 0, ok = 0;
  const noSentence = [];
  for(const f of FOLDERS) f.cards.forEach(c => {
    const sents = [c.example.en];
    for(const L of ['A2', 'B1', 'B2']) for(const t of ['present', 'past', 'future', 'progressive']) sents.push(c.practice[L][t].en);
    let mine = 0;
    for(const en of sents){ total++; if(V.vkBlank(en, c.expression)){ ok++; mine++; } }
    if(!mine) noSentence.push(c.expression);
  });
  assert.ok(ok / total >= 0.95, `커버리지 ${(ok / total * 100).toFixed(1)}%`);
  assert.deepEqual(noSentence, []);
});

test('vkSameAnswer: 대소문자·문장부호·축약형 무시, 철자는 정확히', () => {
  assert.ok(V.vkSameAnswer('Hitting the road', 'hitting the road'));
  assert.ok(V.vkSameAnswer('can not put it down', "can't put it down") === false);
  assert.ok(V.vkSameAnswer('cannot put it down', "can't put it down"));
  assert.ok(V.vkSameAnswer('we will see', "We'll see"));
  assert.ok(!V.vkSameAnswer('hiting the road', 'hitting the road'));
  assert.ok(!V.vkSameAnswer('', 'hit'));
});

test('vkHintOf: 단어마다 첫 글자만', () => {
  assert.equal(V.vkHintOf('hitting the road'), 'h______ t__ r___');
});

test('vkGrade: 표현을 빼면 통과 못 한다', () => {
  const g = V.vkGrade('We leave early.', 'hit the road', 'We hit the road early.');
  assert.equal(g.ok, false);
  assert.equal(g.hasExpr, false);
  assert.deepEqual(g.missing, ['hit', 'road']);
});

test('vkGrade: 축약형·어형만 달라도 완벽', () => {
  const g = V.vkGrade('We will hit the road soon', 'hit the road', "We'll hit the road soon.");
  assert.equal(g.perfect, true);
});

test('vkReview: 새 표현을 처음에 맞히면 3일 단계', () => {
  const r = V.vkReview(null, true, 1000, {});
  assert.equal(r.s, V.VK_KNOWN_STEP);
  assert.equal(V.VK_STEP_KO[r.s], '3일');
  assert.equal(r.due, 1000 + 3 * V.VK_DAY);
});

test('vkReview: 틀리면 5분 뒤, 같은 세션에서 다시 맞히면 1일', () => {
  const wrong = V.vkReview(null, false, 0, {});
  assert.equal(wrong.s, 0);
  assert.equal(wrong.due, 5 * 60 * 1000);
  const again = V.vkReview(wrong, true, 10, {failed: true});
  assert.equal(V.VK_STEP_KO[again.s], '1일');
});

test('vkReview: 맞힐 때마다 한 단계씩, 최대 4개월', () => {
  let r = V.vkReview(null, true, 0, {});
  for(let i = 0; i < 10; i++) r = V.vkReview(r, true, 0, {});
  assert.equal(V.VK_STEP_KO[r.s], '4개월');
  assert.equal(r.ok, 11);
});

test('vkReview: 힌트를 보고 맞히면 단계 유지', () => {
  const r = V.vkReview({s: 4, due: 0, n: 3, ok: 3, ng: 0}, true, 0, {hinted: true});
  assert.equal(r.s, 4);
});

test('vkStreak: 오늘 안 했으면 어제부터 센다', () => {
  const now = new Date(2026, 9, 3, 12).getTime();
  const days = new Set([V.vkDay(V.vkAddDays(now, -1)), V.vkDay(V.vkAddDays(now, -2)), V.vkDay(V.vkAddDays(now, -4))]);
  assert.equal(V.vkStreak(days, now), 2);
  days.add(V.vkDay(now));
  assert.equal(V.vkStreak(days, now), 3);
});

test('vkWeekStart: 월요일 0시', () => {
  const ws = new Date(V.vkWeekStart(new Date(2026, 9, 3, 15).getTime()));   // 2026-10-03 토요일
  assert.equal(ws.getDay(), 1);
  assert.equal(V.vkDay(ws.getTime()), '2026-09-28');
});

test('vkBotXp: 결정적이고 주중에 줄지 않는다', () => {
  const ws = V.vkWeekStart(new Date(2026, 9, 3).getTime());
  let prev = -1;
  for(let h = 0; h <= 7 * 24; h += 6){
    const x = V.vkBotXp('꾸준이', ws, 1, ws + h * 3600e3);
    assert.ok(x >= prev);
    prev = x;
  }
  assert.equal(V.vkBotXp('꾸준이', ws, 1, ws + 3 * V.VK_DAY), V.vkBotXp('꾸준이', ws, 1, ws + 3 * V.VK_DAY));
  assert.equal(V.vkBotXp('꾸준이', ws, 1, ws), 0);
});

test('vkRank · vkTierAfter: 상위 3 승급, 하위 3 강등', () => {
  assert.equal(V.vkRank(100, [50, 200, 300]), 3);
  assert.equal(V.vkTierAfter(1, 3, 10), 2);
  assert.equal(V.vkTierAfter(1, 5, 10), 1);
  assert.equal(V.vkTierAfter(1, 8, 10), 0);
  assert.equal(V.vkTierAfter(0, 10, 10), 0);
  assert.equal(V.vkTierAfter(4, 1, 10), 4);
});

test('vkShadow: 말한 단어만 맞음 표시', () => {
  const r = V.vkShadow('We hit the road early.', 'we hit the road');
  assert.deepEqual(r.parts.map(p => p.ok), [true, true, true, true, false]);
  assert.equal(r.score, 4 / 5);
});
