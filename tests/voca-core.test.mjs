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
    'VK_KNOWN_STEP','vkDay','vkAddDays','vkWeekStart','vkStreak','vkShadow','vkShuffle','VK_DAY','vkTileWords',
    'vkDayItems','vkHeat','vkMonth','vkMergeState'];
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

test('vkTileWords: 문장부호는 떼고 축약·하이픈은 한 타일로', () => {
  assert.deepEqual(V.vkTileWords("We're hitting the road now, and everyone's excited."),
    ["We're", 'hitting', 'the', 'road', 'now', 'and', "everyone's", 'excited']);
  assert.deepEqual(V.vkTileWords('"Is it dog-ear the page?" she asked.'), ['Is', 'it', 'dog-ear', 'the', 'page', 'she', 'asked']);
});

test('vkDayItems: 그날 일별 기록의 표현과 출처·정오를 돌려준다', () => {
  const k = '2026-10-03';
  const log = {k: {'a|0': {s: 'fq', ok: 2, ng: 1}, 'b|1': {s: 'l', ok: 0, ng: 0}}};
  const items = V.vkDayItems(log, {}, [], k).sort((x, y) => x.key < y.key ? -1 : 1);
  assert.deepEqual(items, [{key: 'a|0', s: 'fq', ok: 2, ng: 1}, {key: 'b|1', s: 'l', ok: 0, ng: 0}]);
});

test('vkDayItems: 일별 기록이 없던 날은 복습 기록·오답 노트로 복원하고, 겹치면 한 번만', () => {
  const day = new Date(2026, 9, 1, 9).getTime(), other = new Date(2026, 9, 2, 9).getTime();
  const srs = {'a|0': {s: 2, first: day, last: other}, 'b|1': {s: 0, first: other, last: day}, 'c|2': {s: 1, first: other, last: other}};
  const wrongs = [{k: 'b|1', at: day, conv: true}, {k: 'c|2', at: other}];
  const items = V.vkDayItems(null, srs, wrongs, V.vkDay(day)).sort((x, y) => x.key < y.key ? -1 : 1);
  assert.deepEqual(items.map(x => x.key), ['a|0', 'b|1']);
  assert.equal(items[1].ng, 1);
  assert.equal(items[1].s, 'fc');
  // 일별 기록과 오답 노트가 같은 오답을 담고 있어도 두 번 세지 않는다
  const both = V.vkDayItems({k: {'b|1': {s: 'c', ok: 0, ng: 1}}}, srs, wrongs, V.vkDay(day)).find(x => x.key === 'b|1');
  assert.equal(both.ng, 1);
});

test('vkHeat · vkMonth: 달력 색 단계와 월 구성', () => {
  assert.deepEqual([0, 1, 4, 5, 9, 10, 19, 20].map(V.vkHeat), [0, 1, 1, 2, 2, 3, 3, 4]);
  const m = V.vkMonth(new Date(2026, 9, 3).getTime());   // 2026년 10월: 목요일 시작, 31일
  assert.deepEqual(m, {y: 2026, m: 9, lead: 4, days: 31});
});

test('vkMergeState: 두 기기 기록을 합친다', () => {
  const pc = {
    srs: {'a|0': {s: 3, last: 200, n: 3}, 'b|1': {s: 1, last: 50, n: 1}},
    log: {'2026-10-03': {sec: 600, xp: 40, ok: 4, ng: 1, k: {'a|0': {s: 'f', ok: 1, ng: 0}}}},
    ten: {past: {ok: 3, ng: 1}},
    wrongs: [{k: 'b|1', at: 50}],
    set: {lvl: 'B2', daily: 10, goal: 20, rate: 1}, setAt: 300,
    quiz: {best: 9, plays: 2}, conv: {cafe: {best: 3, n: 7, at: 10}}, tests: [{day: '2026-10-01', est: 120, lvl: 'B1', acc: [1, 0.6, 0.2]}]
  };
  const phone = {
    srs: {'a|0': {s: 2, last: 100, n: 2}, 'c|2': {s: 0, last: 400, n: 1}},
    log: {'2026-10-03': {sec: 900, xp: 10, ok: 1, ng: 0, k: {'c|2': {s: 'q', ok: 0, ng: 1}}}, '2026-10-02': {sec: 60, xp: 5, ok: 1, ng: 0}},
    ten: {past: {ok: 1, ng: 2}},
    wrongs: [{k: 'c|2', at: 400}, {k: 'b|1', at: 50}],
    set: {lvl: 'A2', daily: 5, goal: 10, rate: 0.85}, setAt: 100,
    quiz: {best: 12, plays: 1}, conv: {cafe: {best: 5, n: 7, at: 20}}, tests: []
  };
  const m = V.vkMergeState(pc, phone);
  assert.equal(m.srs['a|0'].s, 3);                       // 더 나중에 학습한 쪽
  assert.ok(m.srs['b|1'] && m.srs['c|2']);              // 한쪽에만 있던 표현도 유지
  assert.equal(m.log['2026-10-03'].sec, 900);
  assert.deepEqual(Object.keys(m.log['2026-10-03'].k).sort(), ['a|0', 'c|2']);
  assert.ok(m.log['2026-10-02']);
  assert.deepEqual(m.ten.past, {ok: 3, ng: 2});
  assert.equal(m.wrongs.length, 2);                      // 같은 오답은 한 번만, 최신이 앞
  assert.equal(m.wrongs[0].k, 'c|2');
  assert.equal(m.set.lvl, 'B2');                         // 나중에 바꾼 설정
  assert.equal(m.quiz.best, 12);
  assert.equal(m.conv.cafe.best, 5);
  assert.equal(m.tests.length, 1);
});

test('vkMergeState: 다시 합쳐도 그대로 (반복 동기화에 안전)', () => {
  const a = {srs: {'a|0': {s: 2, last: 1, n: 1}}, log: {'2026-10-03': {sec: 5, k: {'a|0': {s: 'f', ok: 1, ng: 0}}}}, wrongs: [{k: 'a|0', at: 1}],
             set: {lvl: 'B1'}, setAt: 0, quiz: {best: 1, plays: 1}, conv: {}, tests: [], ten: {}};
  const once = V.vkMergeState(a, {});
  assert.deepEqual(V.vkMergeState(once, once), once);
  assert.deepEqual(V.vkMergeState(once, a), V.vkMergeState(once, once));
});

test('vkMergeState: 둘 다 설정 시각이 없으면 서버(두 번째) 설정을 따른다', () => {
  const fresh = {set: {lvl: 'B1'}, setAt: 0}, server = {set: {lvl: 'B2'}, setAt: 0};
  assert.equal(V.vkMergeState(fresh, server).set.lvl, 'B2');
});

test('voca-module: ACT 는 선언한 뒤에만 쓴다 (앞에서 쓰면 모듈 전체가 멈춘다)', () => {
  const src = HTML.match(/<script id="voca-module">([\s\S]*?)<\/script>/)[1];
  const decl = src.indexOf('const ACT = Object.create(null);');
  const firstUse = src.search(/\nACT\.[A-Za-z]+ = /);
  assert.ok(decl > 0 && firstUse > decl, `ACT 선언 ${decl}, 첫 사용 ${firstUse}`);
});

test('vkShadow: 말한 단어만 맞음 표시', () => {
  const r = V.vkShadow('We hit the road early.', 'we hit the road');
  assert.deepEqual(r.parts.map(p => p.ok), [true, true, true, true, false]);
  assert.equal(r.score, 4 / 5);
});
