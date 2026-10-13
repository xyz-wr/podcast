// legacy/index.html 에서 데이터·순수 로직·CSS 를 뽑아 src/ 에 생성한다.
// 기능을 React로 이관하기 전까지는 생성된 파일을 직접 고치지 말고, 이 스크립트를 다시 돌린다.
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const HTML = fs.readFileSync(new URL('legacy/index.html', ROOT), 'utf8').replace(/\r\n/g, '\n');
const GEN = '// 자동 생성: npm run extract (scripts/extract-legacy.mjs) — 원본 legacy/index.html. 직접 수정 금지.\n';

function write(rel, text){
  const url = new URL(rel, ROOT);
  fs.mkdirSync(new URL('.', url), { recursive: true });
  fs.writeFileSync(url, text);
  console.log('wrote', rel, text.length);
}
function must(m, what){ if(!m) throw new Error(`legacy/index.html 에서 ${what} 를 찾지 못했습니다`); return m; }
function blocks(marker){
  const re = new RegExp(`/\\* ${marker}-START \\*/([\\s\\S]*?)/\\* ${marker}-END \\*/`, 'g');
  return [...HTML.matchAll(re)].map(m => m[1]);
}
function jsModule(marker, min, names){
  const b = blocks(marker);
  if(b.length < min) throw new Error(`${marker} 블록이 ${b.length}개 (${min}개 이상 필요)`);
  return GEN + b.join('\n') + `\nexport { ${names.join(', ')} };\n`;
}

// 1) 데이터
const conv = JSON.parse(must(HTML.match(/<script id="conv-data" type="application\/json">([\s\S]*?)<\/script>/), 'conv-data')[1]);
write('src/data/conv.json', JSON.stringify(conv));
const diary = JSON.parse(must(HTML.match(/window\.DIARY_DATA=(\{[\s\S]*?\});<\/script>/), 'DIARY_DATA')[1]);
write('src/data/diary.json', JSON.stringify(diary));

// 2) 순수 로직 (기존 tests/*.mjs 가 쓰던 이름 그대로)
write('src/core/legacy/quiz-core.js', jsModule('TESTABLE', 4, [
  'STOP','exprWords','variants','qNorm','qTokens','qContent','qRatio','qHasExpression','qMissing','qExtra','qGrade',
  'QTENSES','qBuildPool','qLookup','qRefill','qShuffle','qzWords','voiceScore','rankVoices',
]));
write('src/core/legacy/voca-core.js', jsModule('VOCA-TESTABLE', 2, [
  'vkBlank','vkParseExpr','vkNorm','vkSameAnswer','vkHintOf','vkGrade','vkReview','VK_STEPS','VK_STEP_KO',
  'VK_KNOWN_STEP','vkDay','vkAddDays','vkWeekStart','vkStreak','vkShadow','vkShuffle','VK_DAY','vkTileWords',
  'vkDayItems','vkHeat','vkMonth','vkMergeState',
]));

// 3) CSS: id 없는 첫 <style> → base.css, <style id="xxx-style"> → xxx.css
const css = [...HTML.matchAll(/<style(?: id="([\w-]+)")?>([\s\S]*?)<\/style>/g)];
const names = [];
for(const [, id, body] of css){
  const name = id ? id.replace(/-style$/, '') : 'base';
  write(`src/styles/legacy/${name}.css`, `/* 자동 생성: npm run extract — 원본 legacy/index.html */\n${body.trim()}\n`);
  names.push(name);
}
write('src/styles/legacy/index.ts', GEN + names.map(n => `import './${n}.css';`).join('\n') + '\n');
