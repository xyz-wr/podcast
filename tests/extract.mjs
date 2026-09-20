import fs from 'node:fs';

const HTML_PATH = new URL('../study.html', import.meta.url);

// study.html은 단일 파일 앱이라 로직을 별도 모듈로 분리하지 않는다.
// 대신 순수 로직을 /* TESTABLE-START */ ~ /* TESTABLE-END */ 로 마킹해 두고
// 테스트에서 그 블록만 모아 평가한다.
export function loadCore(){
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const re = /\/\* TESTABLE-START \*\/([\s\S]*?)\/\* TESTABLE-END \*\//g;
  let src = '', m, blocks = 0;
  while((m = re.exec(html))){ src += m[1] + '\n'; blocks++; }
  if(blocks < 2) throw new Error(`study.html에서 TESTABLE 블록을 ${blocks}개만 찾았습니다 (2개 이상 필요)`);
  const exported = [
    'STOP','exprWords','variants',
    'qNorm','qTokens','qContent','qRatio','qHasExpression','qMissing','qExtra','qGrade',
    'QTENSES','qBuildPool','qLookup','qRefill','qShuffle'
  ];
  return new Function(src + '\nreturn {' + exported.join(',') + '};')();
}

export function loadFolders(){
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if(!m) throw new Error('study.html에서 data 스크립트를 찾지 못했습니다');
  return JSON.parse(m[1]).folders;
}
