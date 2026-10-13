# React 이관 Phase 1 (기반 작업) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 별도 브랜치 `react-migration`에 Vite + React + TS + Zustand 앱의 기반(저장소·동기화 계층, 추출한 데이터·로직·CSS, 탭바 뼈대)을 만들고, Netlify 브랜치 미리보기 주소에서 동작을 확인한다.

**Architecture:** 기존 앱은 `legacy/index.html`로 옮겨 참고용으로 고정한다. 그 안의 데이터 JSON, 순수 로직(TESTABLE 블록), CSS는 추출 스크립트로 `src/`에 생성한다. 저장소 이름(localStorage, IndexedDB, Supabase)은 `src/storage/keys.ts` 한 곳에 고정하고, 기존 앱이 만든 DB를 그대로 읽는지 계약 테스트로 증명한다. 동기화 엔진은 기존 코드를 TS로 그대로 옮기고, 기능별 후속 처리(Gemini 키, 보카 병합, 화면 다시 그리기)는 이후 Phase에서 `registerSyncHook`으로 붙인다.

**Tech Stack:** Vite, React, TypeScript, Zustand, Vitest + jsdom + Testing Library, fake-indexeddb, Netlify 브랜치 배포.

**공통 규칙:** [로드맵](2026-10-13-react-migration-roadmap.md)의 "모든 Phase 공통 규칙"을 따른다. 특히 **저장소 이름은 절대 바꾸지 않는다.**

---

## File Structure

| 파일 | 역할 |
|---|---|
| `legacy/index.html` | 기존 앱 원본(이동만, 수정 금지) |
| `scripts/extract-legacy.mjs` | legacy에서 데이터·로직·CSS를 뽑아 `src/`에 생성 |
| `src/data/conv.json`, `src/data/diary.json` | 생성됨: 회화·일기 데이터 |
| `src/core/legacy/quiz-core.js`, `voca-core.js` | 생성됨: 순수 로직(기능을 이관할 때 TS로 바꿈) |
| `src/core/legacy/*.test.js` | 기존 `tests/*.mjs`에서 옮긴 로직 테스트 |
| `src/styles/legacy/*.css`, `index.ts` | 생성됨: 기존 CSS |
| `src/storage/keys.ts` | 모든 저장소 이름(계약) |
| `src/storage/local.ts` | localStorage 안전 래퍼 |
| `src/storage/idb.ts` | IndexedDB(기존과 같은 구조) |
| `src/sync/config.ts` | Supabase 주소·키·동기화 코드 |
| `src/sync/supabase.ts` | REST 호출(upsert/select, kv) |
| `src/sync/resolve.ts` | 항목 단위 last-write-wins 판정 |
| `src/sync/queue.ts` | 푸시 큐(오프라인 보관, 0.8초 디바운스) |
| `src/sync/repo.ts` | 동기화 대상 저장소의 `idbPut`/`idbDel` |
| `src/sync/engine.ts` | pull, pushAll, autoSync, 후속 처리 훅 |
| `src/sync/bootstrap.ts` | 앱 시작 시 동기화와 이벤트 연결 |
| `src/analytics/gtm.ts` | GTM 로드(실제 사이트만), 탭 가상 페이지뷰 |
| `src/app/tabs.ts` | 탭 목록, 기본 탭 |
| `src/store/app.ts` | Zustand: 현재 탭 |
| `src/app/TabBar.tsx`, `src/app/App.tsx` | 탭바, 화면 자리 |
| `src/main.tsx` | 진입점 |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `netlify.toml` | 빌드·배포 설정 |

---

### Task 0: 작업용 worktree와 브랜치 만들기

master 작업 폴더에는 커밋하지 않은 변경(`index.html`에서 가상 페이지뷰 2줄 삭제)이 있고, 이건 그대로 둔다. 그래서 브랜치를 바꾸지 않고 **OneDrive 밖에 worktree**를 만든다.

- [ ] **Step 1: worktree 생성**

```bash
mkdir -p /c/Users/judan/dev
git -C /c/Users/judan/OneDrive/Desktop/podcast worktree add /c/Users/judan/dev/podcast-react -b react-migration master
```

Expected: `Preparing worktree (new branch 'react-migration')`. 새 폴더에는 마지막 커밋 상태(`01e6503`)가 체크아웃된다.

- [ ] **Step 2: 계획 문서 복사 후 커밋**

```bash
cp /c/Users/judan/OneDrive/Desktop/podcast/docs/superpowers/plans/2026-10-13-react-migration-*.md /c/Users/judan/dev/podcast-react/docs/superpowers/plans/
cd /c/Users/judan/dev/podcast-react
git add docs/superpowers/plans/2026-10-13-react-migration-*.md
git commit -m "docs: React 이관 로드맵과 Phase 1 계획"
```

이후 모든 Task는 `/c/Users/judan/dev/podcast-react`에서 실행한다.

---

### Task 1: 기존 앱을 legacy/로 옮기기

**Files:**
- Move: `index.html` → `legacy/index.html`
- Modify: `tests/extract.mjs:3`, `tests/voca-core.test.mjs:7`, `tests/module-refs.test.mjs` (`HTML` 상수 줄)

- [ ] **Step 1: 이동**

```bash
mkdir -p legacy
git mv index.html legacy/index.html
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL, `ENOENT ... index.html`

- [ ] **Step 3: 테스트 경로 수정**

세 파일에서 `new URL('../index.html', import.meta.url)`를 `new URL('../legacy/index.html', import.meta.url)`로 바꾼다.

```bash
sed -i "s#'../index.html'#'../legacy/index.html'#" tests/extract.mjs tests/voca-core.test.mjs tests/module-refs.test.mjs
grep -n "legacy/index.html" tests/*.mjs
```

Expected: 세 파일에서 각각 1줄씩 나온다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: `ℹ tests 64`, `ℹ pass 64`, `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
git add -A legacy tests
git commit -m "chore: 기존 단일 파일 앱을 legacy/로 이동 (참고용 고정)"
```

---

### Task 2: Vite + React + TS 프로젝트 만들기

**Files:**
- Modify: `package.json`
- Create: `index.html`, `vite.config.ts`, `tsconfig.json`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/main.tsx`, `src/app/App.tsx`, `.gitignore`

- [ ] **Step 1: 의존성 설치**

```bash
npm install react react-dom zustand
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node vitest jsdom fake-indexeddb @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: `package.json`의 scripts 교체**

`"scripts"`를 아래로 바꾼다(설치 명령이 넣은 `dependencies`/`devDependencies`는 그대로 둔다).

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "extract": "node scripts/extract-legacy.mjs",
    "test": "vitest run --passWithNoTests && npm run test:legacy",
    "test:legacy": "node --test tests/quiz-core.test.mjs tests/module-refs.test.mjs tests/voca-core.test.mjs"
  },
```

- [ ] **Step 3: `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Netlify가 빌드 때 넣어 주는 CONTEXT: production | deploy-preview | branch-deploy (로컬은 dev)
  define: { __DEPLOY_CONTEXT__: JSON.stringify(process.env.CONTEXT ?? 'dev') },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
```

- [ ] **Step 4: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowJs": true,
    "checkJs": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5: `src/vite-env.d.ts`, `src/test/setup.ts`**

```ts
/// <reference types="vite/client" />
declare const __DEPLOY_CONTEXT__: string;
```

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
// jsdom에는 scrollTo가 없다
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });
```

- [ ] **Step 6: Vite용 `index.html` (루트)**

meta/link는 `legacy/index.html` 4~11행과 같다. 복사하기 전에 그 줄과 비교해서 다르면 legacy 쪽을 따른다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#F6F3EC">
<title>Personal study notebook</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

GTM 스니펫은 여기 넣지 않는다. 실제 사이트에서만 켜기 위해 Task 9에서 코드로 불러온다. `<noscript>` iframe은 이 앱이 JS 없이는 동작하지 않으므로 생략한다.

- [ ] **Step 7: 임시 `src/app/App.tsx`, `src/main.tsx`** (Task 9에서 교체)

```tsx
export function App() {
  return <div style={{ padding: 24 }}>React 이관 작업 중</div>;
}
```

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 8: `.gitignore`** (파일이 이미 있으면 아래 줄을 덧붙인다)

```
node_modules/
dist/
_site/
.netlify/
```

- [ ] **Step 9: 빌드·테스트 확인**

Run: `npm run build`
Expected: `dist/index.html`과 `dist/assets/*.js` 생성, 에러 없음

Run: `npm test`
Expected: vitest `No test files found`(통과 처리), 이어서 legacy 테스트 `ℹ pass 64`

- [ ] **Step 10: 커밋**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json src .gitignore
git commit -m "chore: Vite + React + TS 프로젝트 기본 구성"
```

---

### Task 3: Netlify 브랜치 배포 연결

**Files:**
- Modify: `netlify.toml`

이 브랜치의 `netlify.toml`만 바뀐다. master의 `netlify.toml`은 그대로라서 실제 사이트에는 영향이 없다.

- [ ] **Step 1: `netlify.toml` 교체**

```toml
# Netlify 배포 설정 (React 이관 브랜치)
# Vite로 빌드하고 dist를 배포한다. CONTEXT 환경 변수로 실제 사이트/미리보기를 구분한다.
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

- [ ] **Step 2: 커밋 후 브랜치 푸시**

```bash
git add netlify.toml
git commit -m "chore(netlify): Vite 빌드와 dist 배포로 변경"
git push -u origin react-migration
```

- [ ] **Step 3: Netlify에서 브랜치 배포 켜기 (사용자가 대시보드에서 직접)**

Netlify → 사이트 → **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Configure**
- Branch deploys: **Let me add individual branches** → `react-migration` 추가 → Save
- 저장한 뒤 **Deploys**에서 "Trigger deploy"를 누르거나 다음 커밋을 푸시한다.

- [ ] **Step 4: 미리보기 확인**

`https://react-migration--<사이트이름>.netlify.app`를 열어 "React 이관 작업 중"이 보이는지 확인한다. 사이트 이름은 Netlify 사이트 개요에 있는 `*.netlify.app` 주소의 앞부분이다.
Expected: 문구가 보이고, Deploy log에 `vite build` 성공이 찍힌다.

---

### Task 4: legacy에서 데이터·로직·CSS 추출

**Files:**
- Create: `scripts/extract-legacy.mjs`, `src/data/data.test.ts`
- Generated: `src/data/conv.json`, `src/data/diary.json`, `src/core/legacy/quiz-core.js`, `src/core/legacy/voca-core.js`, `src/styles/legacy/*.css`, `src/styles/legacy/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/data/data.test.ts`

```ts
import { expect, it } from 'vitest';
import conv from './conv.json';
import diary from './diary.json';
import * as Q from '../core/legacy/quiz-core.js';
import * as V from '../core/legacy/voca-core.js';

it('회화 데이터에 폴더와 카드가 있다', () => {
  expect(conv.folders.length).toBeGreaterThan(0);
  expect(conv.folders[0].cards.length).toBeGreaterThan(0);
});

it('일기 데이터 제목', () => {
  expect(diary.title).toBe('매일 영어 일기');
});

it('추출한 로직 모듈이 함수를 내보낸다', () => {
  expect(typeof Q.qGrade).toBe('function');
  expect(typeof V.vkMergeState).toBe('function');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/data`
Expected: FAIL, `Failed to resolve import "./conv.json"`

- [ ] **Step 3: `scripts/extract-legacy.mjs` 작성**

```js
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
```

- [ ] **Step 4: 실행**

Run: `npm run extract`
Expected: `wrote src/data/conv.json …`부터 `wrote src/styles/legacy/index.ts`까지 출력. CSS는 7개(`base`, `conv`, `diary`, `quiz`, `write`, `video`, `voca`)

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/data`
Expected: 3 passed

- [ ] **Step 6: 커밋**

```bash
git add scripts src/data src/core src/styles
git commit -m "feat: legacy에서 데이터·순수 로직·CSS 추출 스크립트와 생성물"
```

---

### Task 5: 로직 테스트를 Vitest로 옮기기

**Files:**
- Create: `src/core/legacy/quiz-core.test.js`, `src/core/legacy/voca-core.test.js`
- Delete: `tests/` 전체
- Modify: `package.json` scripts

`tests/module-refs.test.mjs`와 보카의 "ACT 선언 순서" 테스트는 legacy 파일 구조를 검사하는 테스트다. legacy를 고정했으므로 옮기지 않는다. 나머지 57개를 옮기며, strict mode ES 모듈에서도 57개 모두 통과하는 것을 미리 확인했다.

- [ ] **Step 1: 퀴즈 테스트 옮기기**

```bash
{ cat <<'EOF'
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as C from './quiz-core.js';
import conv from '../../data/conv.json';

const FOLDERS = conv.folders;
EOF
  tail -n +7 tests/quiz-core.test.mjs; } > src/core/legacy/quiz-core.test.js
head -8 src/core/legacy/quiz-core.test.js
```

Expected: 새 헤더 6줄 다음에 빈 줄, 그다음 `test('qNorm: 소문자화 + 문장부호 제거', …`

- [ ] **Step 2: 보카 테스트 옮기기** (헤더 20줄 교체 + ACT 테스트 제거)

```bash
{ cat <<'EOF'
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as V from './voca-core.js';
import conv from '../../data/conv.json';

const FOLDERS = conv.folders;
EOF
  tail -n +21 tests/voca-core.test.mjs | tr -d '\r' | node -e "let s=require('fs').readFileSync(0,'utf8');const r=s.replace(/test\('voca-module: ACT[\s\S]*?\n\}\);\n\n?/,'');if(r===s)throw new Error('ACT 테스트를 찾지 못함');process.stdout.write(r);"; } > src/core/legacy/voca-core.test.js
grep -c "^test(" src/core/legacy/voca-core.test.js
grep -n "HTML\|voca-module" src/core/legacy/voca-core.test.js
```

Expected: `test(` 개수 = 원래 개수 − 1. 두 번째 grep 결과는 없음

- [ ] **Step 3: 옮긴 테스트 실행**

Run: `npx vitest run src/core`
Expected: 57 passed

- [ ] **Step 4: 기존 tests/ 삭제, scripts 정리**

```bash
git rm -r tests
```

`package.json`의 `"test"`를 `"vitest run"`으로 바꾸고 `"test:legacy"` 줄은 삭제한다.

Run: `npm test`
Expected: 60 passed (data 3 + core 57)

- [ ] **Step 5: 커밋**

```bash
git add -A src/core package.json tests
git commit -m "test: 순수 로직 테스트를 Vitest로 이관, legacy 구조 테스트 제거"
```

---

### Task 6: 저장소 계층 (이름 계약, localStorage, IndexedDB)

**Files:**
- Create: `src/storage/keys.ts`, `src/storage/keys.test.ts`, `src/storage/local.ts`, `src/storage/local.test.ts`, `src/storage/idb.ts`, `src/storage/idb.test.ts`

- [ ] **Step 1: 실패하는 계약 테스트** — `src/storage/keys.test.ts`

```ts
import { expect, it } from 'vitest';
import fs from 'node:fs';
import { IDB_NAME, IDB_VERSION, KV_KEYS, LS_KEYS, SETTINGS_KEYS, SYNCED_STORES } from './keys';

const LEGACY = fs.readFileSync(new URL('../../legacy/index.html', import.meta.url), 'utf8');

// 실제 사이트를 교체할 때 기존 데이터를 그대로 읽어야 한다. 이 값이 바뀌면 사용자 기록이 사라진다.
it('저장소 이름이 기존 앱과 같다', () => {
  expect(LS_KEYS).toEqual({
    tab: 'elab_tab', voice: 'elab_voice', progress: 'elab_progress_v1', diary: 'eldiary_v1',
    quiz: 'elab_quiz_v1', write: 'engWriteB1_v1', voca: 'elab_voca_v1',
  });
  expect(IDB_NAME).toBe('tabloEnglishLab');
  expect(IDB_VERSION).toBe(1);
  expect(SETTINGS_KEYS).toEqual(['activity', 'folders', 'geminiKey', 'sbKey', 'sbUrl', 'syncCode', 'syncQueue']);
  expect(KV_KEYS).toEqual({ geminiKey: 'geminiKey', voca: 'voca_v1' });
  expect(SYNCED_STORES).toEqual(['vocab', 'videos']);
});

it('모든 이름이 legacy/index.html 에 실제로 있다', () => {
  for(const v of [...Object.values(LS_KEYS), IDB_NAME, ...SETTINGS_KEYS, ...Object.values(KV_KEYS)])
    expect(LEGACY, v).toContain(`'${v}'`);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/storage/keys`
Expected: FAIL, `Failed to resolve import "./keys"`

- [ ] **Step 3: `src/storage/keys.ts`**

```ts
// 기존 앱(legacy/index.html)과 같은 저장소를 읽어야 한다. 이름을 바꾸면 사용자 기록이 사라진다.
export const LS_KEYS = {
  tab: 'elab_tab',               // 마지막 탭 (JSON 아님, 문자열 그대로)
  voice: 'elab_voice',           // TTS 음성
  progress: 'elab_progress_v1',  // 회화 진도
  diary: 'eldiary_v1',
  quiz: 'elab_quiz_v1',
  write: 'engWriteB1_v1',
  voca: 'elab_voca_v1',
} as const;

export const IDB_NAME = 'tabloEnglishLab';
export const IDB_VERSION = 1;

export const SETTINGS_KEYS = ['activity', 'folders', 'geminiKey', 'sbKey', 'sbUrl', 'syncCode', 'syncQueue'] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export const KV_KEYS = { geminiKey: 'geminiKey', voca: 'voca_v1' } as const;

export const SYNCED_STORES = ['vocab', 'videos'] as const;
export type SyncedStore = (typeof SYNCED_STORES)[number];
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/storage/keys`
Expected: 2 passed

- [ ] **Step 5: localStorage 테스트** — `src/storage/local.test.ts`

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { lsGetJSON, lsGetRaw, lsSetJSON, lsSetRaw } from './local';

beforeEach(() => localStorage.clear());

it('문자열을 그대로 읽고 쓴다', () => {
  lsSetRaw('elab_tab', 'voca');
  expect(localStorage.getItem('elab_tab')).toBe('voca');
  expect(lsGetRaw('elab_tab')).toBe('voca');
});

it('JSON 은 기존 앱처럼 JSON.stringify 로 저장한다', () => {
  lsSetJSON('elab_quiz_v1', { a: 1 });
  expect(localStorage.getItem('elab_quiz_v1')).toBe('{"a":1}');
  expect(lsGetJSON('elab_quiz_v1', null)).toEqual({ a: 1 });
});

it('없거나 깨진 값이면 기본값', () => {
  expect(lsGetJSON('none', 7)).toBe(7);
  localStorage.setItem('bad', '{oops');
  expect(lsGetJSON('bad', 7)).toBe(7);
});

it('저장소 접근이 막혀도 예외를 던지지 않는다', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => lsSetRaw('x', 'y')).not.toThrow();
  spy.mockRestore();
});
```

- [ ] **Step 6: 실패 확인 후 `src/storage/local.ts` 구현**

Run: `npx vitest run src/storage/local` → FAIL (모듈 없음)

```ts
// 사생활 보호 모드 등에서 localStorage 접근이 막혀도 앱이 멈추지 않게 감싼다.
export function lsGetRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function lsSetRaw(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* 저장 실패는 무시 (기존 앱과 동일) */ }
}
export function lsGetJSON<T>(key: string, fallback: T): T {
  const raw = lsGetRaw(key);
  if(raw == null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
export function lsSetJSON(key: string, value: unknown): void {
  lsSetRaw(key, JSON.stringify(value));
}
```

Run: `npx vitest run src/storage/local`
Expected: 4 passed

- [ ] **Step 7: IndexedDB 호환 테스트** — `src/storage/idb.test.ts`

```ts
import { beforeEach, expect, it } from 'vitest';
import { getSetting, idbAll, idbByIndex, idbDelRaw, idbGet, idbPutRaw, openDb, putSetting, resetDbForTests } from './idb';

// legacy/index.html 의 db() 와 똑같은 방식으로 만든 DB
function openLikeLegacy(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('tabloEnglishLab', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('videos', { keyPath: 'id' });
      d.createObjectStore('vocab', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

beforeEach(resetDbForTests);

it('기존 앱이 저장한 데이터를 그대로 읽는다', async () => {
  const legacy = await openLikeLegacy();
  await new Promise<void>((resolve, reject) => {
    const t = legacy.transaction(['vocab', 'settings'], 'readwrite');
    t.objectStore('vocab').put({ id: 'w1', videoId: 'v1', word: 'hit the road', updatedAt: 5 });
    t.objectStore('settings').put({ key: 'syncCode', value: 'tablo-abcd-efgh-jkmn' });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  legacy.close();

  expect(await idbGet('vocab', 'w1')).toEqual({ id: 'w1', videoId: 'v1', word: 'hit the road', updatedAt: 5 });
  expect(await idbByIndex('vocab', 'videoId', 'v1')).toHaveLength(1);
  expect(await getSetting('syncCode')).toEqual({ key: 'syncCode', value: 'tablo-abcd-efgh-jkmn' });
});

it('빈 브라우저에서는 기존과 같은 구조로 만든다', async () => {
  const d = await openDb();
  expect([...d.objectStoreNames].sort()).toEqual(['recordings', 'settings', 'videos', 'vocab']);
  const t = d.transaction(['videos', 'vocab', 'recordings', 'settings']);
  expect(t.objectStore('videos').keyPath).toBe('id');
  expect(t.objectStore('vocab').keyPath).toBe('id');
  expect([...t.objectStore('vocab').indexNames]).toEqual(['videoId']);
  expect([...t.objectStore('recordings').indexNames]).toEqual(['videoId']);
  expect(t.objectStore('settings').keyPath).toBe('key');
});

it('put / all / delete', async () => {
  await idbPutRaw('videos', { id: 'a' });
  await idbPutRaw('videos', { id: 'b' });
  expect(await idbAll('videos')).toHaveLength(2);
  await idbDelRaw('videos', 'a');
  expect(await idbAll('videos')).toEqual([{ id: 'b' }]);
  await putSetting({ key: 'activity', value: '{}' });
  expect((await getSetting<string>('activity'))?.value).toBe('{}');
});
```

- [ ] **Step 8: 실패 확인 후 `src/storage/idb.ts` 구현**

Run: `npx vitest run src/storage/idb` → FAIL (모듈 없음)

```ts
import { IDB_NAME, IDB_VERSION, type SettingsKey } from './keys';

export type StoreName = 'videos' | 'vocab' | 'recordings' | 'settings';
export interface SettingRow<V = unknown> { key: SettingsKey; value: V; updatedAt?: number }

let dbPromise: Promise<IDBDatabase> | null = null;

// legacy 의 db() 와 같은 구조. 저장소를 추가해야 하면 IDB_VERSION 을 올리고 기존 저장소는 건드리지 않는다.
export function openDb(): Promise<IDBDatabase> {
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, IDB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if(!d.objectStoreNames.contains('videos')) d.createObjectStore('videos', { keyPath: 'id' });
      if(!d.objectStoreNames.contains('vocab')) d.createObjectStore('vocab', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      if(!d.objectStoreNames.contains('recordings')) d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => { dbPromise = null; reject(r.error); };
  });
  return dbPromise;
}

function req<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(d => new Promise<T>((resolve, reject) => {
    const r = fn(d.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  }));
}

export const idbGet = <T = unknown>(s: StoreName, k: IDBValidKey) => req<T | undefined>(s, 'readonly', o => o.get(k));
export const idbAll = <T = unknown>(s: StoreName) => req<T[]>(s, 'readonly', o => o.getAll());
export const idbByIndex = <T = unknown>(s: StoreName, index: string, v: IDBValidKey) =>
  req<T[]>(s, 'readonly', o => o.index(index).getAll(v));
/** 동기화 훅 없이 저장. 동기화 대상(vocab, videos)은 src/sync/repo.ts 의 idbPut 을 쓴다. */
export const idbPutRaw = (s: StoreName, v: unknown) => req<IDBValidKey>(s, 'readwrite', o => o.put(v));
export const idbDelRaw = (s: StoreName, k: IDBValidKey) => req<undefined>(s, 'readwrite', o => o.delete(k));

export const getSetting = <V = unknown>(key: SettingsKey) => idbGet<SettingRow<V>>('settings', key);
export const putSetting = <V>(row: SettingRow<V>) => idbPutRaw('settings', row).then(() => undefined);

export async function resetDbForTests(): Promise<void> {
  if(dbPromise){ (await dbPromise).close(); dbPromise = null; }
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(IDB_NAME);
    r.onsuccess = () => resolve();
    r.onblocked = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
```

Run: `npx vitest run src/storage`
Expected: 9 passed (keys 2 + local 4 + idb 3)

- [ ] **Step 9: 커밋**

```bash
git add src/storage
git commit -m "feat(storage): 기존 앱과 같은 저장소 이름 계약, localStorage·IndexedDB 래퍼"
```

---

### Task 7: 동기화 기본 요소 (설정, Supabase REST, 충돌 판정)

**Files:**
- Create: `src/sync/resolve.ts`, `src/sync/resolve.test.ts`, `src/sync/config.ts`, `src/sync/config.test.ts`, `src/sync/supabase.ts`, `src/sync/supabase.test.ts`

- [ ] **Step 1: 충돌 판정 테스트** — `src/sync/resolve.test.ts` (legacy `runSyncSelfTest`의 5개 경우)

```ts
import { expect, it } from 'vitest';
import { syncResolve } from './resolve';

it.each([
  [100, { updated_at: 200, deleted: false }, 'put'],     // 서버가 더 새로움
  [300, { updated_at: 200, deleted: false }, 'skip'],    // 로컬이 더 새로움
  [200, { updated_at: 200, deleted: false }, 'skip'],    // 같으면 그대로
  [0, { updated_at: 50, deleted: true }, 'delete'],      // 서버의 더 새로운 삭제
  [-1, { updated_at: 0, deleted: false }, 'put'],        // 로컬에 없음
] as const)('local %i, remote %o → %s', (local, remote, expected) => {
  expect(syncResolve(local, remote)).toBe(expected);
});
```

- [ ] **Step 2: 실패 확인 후 `src/sync/resolve.ts`**

Run: `npx vitest run src/sync/resolve` → FAIL

```ts
export interface RemoteStamp { updated_at: number; deleted: boolean }
export type SyncAction = 'put' | 'delete' | 'skip';

/** 항목 단위 last-write-wins. 로컬에 없으면 localUpdatedAt = -1. */
export function syncResolve(localUpdatedAt: number, remote: RemoteStamp): SyncAction {
  if(!(remote.updated_at > localUpdatedAt)) return 'skip';
  return remote.deleted ? 'delete' : 'put';
}
```

Run: `npx vitest run src/sync/resolve`
Expected: 5 passed

- [ ] **Step 3: 설정 테스트** — `src/sync/config.test.ts`

```ts
import { beforeEach, expect, it } from 'vitest';
import { getSetting, putSetting, resetDbForTests } from '../storage/idb';
import { SB_DEFAULT_KEY, SB_DEFAULT_URL, genSyncCode, getSyncConfig, loadSyncConfig, normSbUrl, saveSyncConfig, sbReady, setSyncConfigForTests } from './config';

beforeEach(async () => {
  await resetDbForTests();
  setSyncConfigForTests({ url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY, code: '' });
});

it('저장된 값이 없으면 기본 서버, 동기화 코드 없음 → 꺼짐', async () => {
  await loadSyncConfig();
  expect(getSyncConfig()).toEqual({ url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY, code: '' });
  expect(sbReady()).toBe(false);
});

it('기존 앱이 저장한 settings 값을 읽는다', async () => {
  await putSetting({ key: 'sbUrl', value: 'https://mine.supabase.co' });
  await putSetting({ key: 'sbKey', value: 'k1' });
  await putSetting({ key: 'syncCode', value: 'tablo-aaaa-bbbb-cccc' });
  await loadSyncConfig();
  expect(getSyncConfig()).toEqual({ url: 'https://mine.supabase.co', key: 'k1', code: 'tablo-aaaa-bbbb-cccc' });
  expect(sbReady()).toBe(true);
});

it('기본 서버 값은 빈 문자열로 저장한다 (기존 앱과 동일)', async () => {
  await saveSyncConfig({ url: '', key: '', code: ' tablo-x ' });
  expect((await getSetting('sbUrl'))?.value).toBe('');
  expect((await getSetting('sbKey'))?.value).toBe('');
  expect((await getSetting('syncCode'))?.value).toBe('tablo-x');
  expect(getSyncConfig().url).toBe(SB_DEFAULT_URL);
});

it('URL 정규화', () => {
  expect(normSbUrl(' https://a.supabase.co/rest/v1/ ')).toBe('https://a.supabase.co');
});

it('동기화 코드 형식', () => {
  expect(genSyncCode()).toMatch(/^tablo-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
});
```

- [ ] **Step 4: 실패 확인 후 `src/sync/config.ts`**

Run: `npx vitest run src/sync/config` → FAIL

```ts
import { getSetting, putSetting } from '../storage/idb';

// 이 앱 전용 Supabase 프로젝트. publishable key 는 공개돼도 되는 키이고, 데이터는 RLS 정책으로
// '요청 헤더 x-sync-code 와 같은 동기화 코드의 행'만 열린다 → 동기화 코드가 곧 비밀번호.
export const SB_DEFAULT_URL = 'https://dqinuwadlythebpwpqxc.supabase.co';
export const SB_DEFAULT_KEY = 'sb_publishable_dErSr81L2hcsLRbN8tIcbQ_avmsF-eX';

export interface SyncConfig { url: string; key: string; code: string }
let cfg: SyncConfig = { url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY, code: '' };

export const getSyncConfig = (): SyncConfig => cfg;
export const sbReady = (): boolean => !!(cfg.url && cfg.key && cfg.code);
export const setSyncConfigForTests = (c: SyncConfig): void => { cfg = c; };

export function normSbUrl(s: string): string {
  return (s || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, '');
}

async function settingValue(key: 'sbUrl' | 'sbKey' | 'syncCode'): Promise<string> {
  try { return (await getSetting<string>(key))?.value || ''; } catch { return ''; }
}

export async function loadSyncConfig(): Promise<void> {
  cfg = {
    url: (await settingValue('sbUrl')) || SB_DEFAULT_URL,
    key: (await settingValue('sbKey')) || SB_DEFAULT_KEY,
    code: await settingValue('syncCode'),
  };
}

export async function saveSyncConfig(input: SyncConfig): Promise<void> {
  const url = normSbUrl(input.url) || SB_DEFAULT_URL;
  const key = input.key.trim() || SB_DEFAULT_KEY;
  cfg = { url, key, code: input.code.trim() };
  await putSetting({ key: 'sbUrl', value: url === SB_DEFAULT_URL ? '' : url });
  await putSetting({ key: 'sbKey', value: key === SB_DEFAULT_KEY ? '' : key });
  await putSetting({ key: 'syncCode', value: cfg.code });
}

export function genSyncCode(): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(12);
  crypto.getRandomValues(b);
  let s = '';
  b.forEach((x, i) => { s += a[x % a.length]; if(i === 3 || i === 7) s += '-'; });
  return 'tablo-' + s;
}
```

Run: `npx vitest run src/sync/config`
Expected: 5 passed

- [ ] **Step 5: Supabase REST 테스트** — `src/sync/supabase.test.ts`

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setSyncConfigForTests } from './config';
import { kvSelect, kvUpsert, sbSelect, sbUpsert } from './supabase';

const CFG = { url: 'https://x.supabase.co', key: 'K', code: 'tablo-a b' };
function mockFetch(body: unknown = [], status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: status < 400, status, json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => setSyncConfigForTests(CFG));
afterEach(() => vi.unstubAllGlobals());

it('upsert: 기존 앱과 같은 URL·헤더·본문', async () => {
  const f = mockFetch();
  const rows = [{ sync_code: CFG.code, id: 'w1', data: { id: 'w1' }, deleted: false, updated_at: 1 }];
  await sbUpsert('vocab', rows);
  const [url, init] = f.mock.calls[0];
  expect(url).toBe('https://x.supabase.co/rest/v1/vocab?on_conflict=sync_code,id');
  expect(init?.method).toBe('POST');
  expect(init?.headers).toEqual({
    apikey: 'K', Authorization: 'Bearer K', 'Content-Type': 'application/json',
    'x-sync-code': CFG.code, Prefer: 'resolution=merge-duplicates',
  });
  expect(JSON.parse(init?.body as string)).toEqual(rows);
});

it('select: 내 동기화 코드의 행만 요청', async () => {
  const f = mockFetch([{ id: 'w1' }]);
  expect(await sbSelect('videos')).toEqual([{ id: 'w1' }]);
  expect(f.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/videos?sync_code=eq.tablo-a%20b&select=*');
});

it('kv upsert / select', async () => {
  const f = mockFetch([{ k: 'voca_v1', v: '{}' }]);
  await kvUpsert('voca_v1', '{}', 9);
  expect(f.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/kv?on_conflict=sync_code,k');
  expect(JSON.parse(f.mock.calls[0][1]?.body as string)).toEqual([{ sync_code: CFG.code, k: 'voca_v1', v: '{}', updated_at: 9 }]);
  expect(await kvSelect()).toEqual([{ k: 'voca_v1', v: '{}' }]);
  expect(f.mock.calls[1][0]).toBe('https://x.supabase.co/rest/v1/kv?sync_code=eq.tablo-a%20b&select=*');
});

it('실패 응답이면 예외', async () => {
  mockFetch([], 401);
  await expect(sbSelect('vocab')).rejects.toThrow('sbSelect vocab 401');
});

it('동기화 코드가 없으면 요청하지 않는다', async () => {
  setSyncConfigForTests({ ...CFG, code: '' });
  const f = mockFetch();
  await sbUpsert('vocab', [{ sync_code: '', id: 'a', data: null, deleted: true, updated_at: 1 }]);
  expect(await sbSelect('vocab')).toEqual([]);
  expect(f).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: 실패 확인 후 `src/sync/supabase.ts`**

Run: `npx vitest run src/sync/supabase` → FAIL

```ts
import { getSyncConfig, sbReady } from './config';

export interface SyncRow<T = unknown> { sync_code: string; id: string; data: T | null; deleted: boolean; updated_at: number }
export interface KvRow { sync_code: string; k: string; v: string; updated_at: number }

function headers(): Record<string, string> {
  const c = getSyncConfig();
  return { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', 'x-sync-code': c.code };
}
const mine = () => 'sync_code=eq.' + encodeURIComponent(getSyncConfig().code) + '&select=*';

async function upsert(path: string, body: unknown, label: string): Promise<void> {
  const r = await fetch(`${getSyncConfig().url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(body),
  });
  if(!r.ok) throw new Error(`${label} ${r.status}`);
}

export async function sbUpsert(table: string, rows: SyncRow[]): Promise<void> {
  if(!sbReady() || !rows.length) return;
  await upsert(`${table}?on_conflict=sync_code,id`, rows, `sbUpsert ${table}`);
}

export async function sbSelect<T = unknown>(table: string): Promise<SyncRow<T>[]> {
  if(!sbReady()) return [];
  const r = await fetch(`${getSyncConfig().url}/rest/v1/${table}?${mine()}`, { headers: headers() });
  if(!r.ok) throw new Error(`sbSelect ${table} ${r.status}`);
  return r.json();
}

export async function kvUpsert(k: string, v: string, ts: number): Promise<void> {
  if(!sbReady()) return;
  await upsert('kv?on_conflict=sync_code,k', [{ sync_code: getSyncConfig().code, k, v, updated_at: ts }], 'kvUpsert');
}

export async function kvSelect(): Promise<KvRow[]> {
  if(!sbReady()) return [];
  const r = await fetch(`${getSyncConfig().url}/rest/v1/kv?${mine()}`, { headers: headers() });
  if(!r.ok) throw new Error(`kvSelect ${r.status}`);
  return r.json();
}
```

Run: `npx vitest run src/sync`
Expected: 15 passed (resolve 5 + config 5 + supabase 5)

- [ ] **Step 7: 커밋**

```bash
git add src/sync
git commit -m "feat(sync): 동기화 설정, Supabase REST 호출, 충돌 판정 이관"
```

---

### Task 8: 동기화 엔진 (큐, 저장 훅, pull/push, 시작 처리)

**Files:**
- Create: `src/sync/queue.ts`, `src/sync/repo.ts`, `src/sync/engine.ts`, `src/sync/bootstrap.ts`, `src/sync/engine.test.ts`

- [ ] **Step 1: 엔진 테스트** — `src/sync/engine.test.ts`

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getSetting, idbGet, idbPutRaw, resetDbForTests } from '../storage/idb';
import { setSyncConfigForTests } from './config';
import { autoSync, pushAll, registerSyncHook, syncPull } from './engine';
import { flushQueue, getQueue, queuePush, resetQueueForTests, restoreQueue } from './queue';
import { idbDel, idbPut } from './repo';

const CFG = { url: 'https://x.supabase.co', key: 'K', code: 'tablo-test' };
type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let tables: Record<string, unknown[]>;
let failPosts = false;

beforeEach(async () => {
  await resetDbForTests();
  resetQueueForTests();
  setSyncConfigForTests(CFG);
  calls = []; tables = { vocab: [], videos: [], kv: [] }; failPosts = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, body });
    const table = url.split('/rest/v1/')[1].split('?')[0];
    if(method === 'POST' && failPosts) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => (method === 'GET' ? tables[table] : []) };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); resetQueueForTests(); });

it('queuePush: 같은 항목은 최신 1건만 남기고 settings.syncQueue 에 보관', async () => {
  queuePush('vocab', { sync_code: CFG.code, id: 'a', data: { v: 1 }, deleted: false, updated_at: 1 });
  queuePush('vocab', { sync_code: CFG.code, id: 'a', data: { v: 2 }, deleted: false, updated_at: 2 });
  expect(getQueue()).toHaveLength(1);
  expect(getQueue()[0].row.data).toEqual({ v: 2 });
  await vi.waitFor(async () => expect((await getSetting<unknown[]>('syncQueue'))?.value).toHaveLength(1));
});

it('flushQueue: 성공하면 비우고, 실패하면 되돌려 보관', async () => {
  queuePush('videos', { sync_code: CFG.code, id: 'v1', data: { id: 'v1' }, deleted: false, updated_at: 1 });
  failPosts = true;
  await flushQueue();
  expect(getQueue()).toHaveLength(1);
  failPosts = false;
  await flushQueue();
  expect(getQueue()).toHaveLength(0);
  expect(calls.filter(c => c.method === 'POST').at(-1)?.url).toBe('https://x.supabase.co/rest/v1/videos?on_conflict=sync_code,id');
  expect((await getSetting<unknown[]>('syncQueue'))?.value).toEqual([]);
});

it('restoreQueue: 보관된 큐를 다시 읽는다', async () => {
  const item = { table: 'vocab', row: { sync_code: CFG.code, id: 'z', data: null, deleted: true, updated_at: 3 } };
  await idbPutRaw('settings', { key: 'syncQueue', value: [item] });
  await restoreQueue();
  expect(getQueue()).toEqual([item]);
});

it('idbPut: 동기화 대상은 updatedAt 을 찍고 큐에 넣는다, settings 는 넣지 않는다', async () => {
  const v = await idbPut('vocab', { id: 'w1', word: 'x' });
  expect(v.updatedAt).toEqual(expect.any(Number));
  expect(getQueue()).toEqual([{ table: 'vocab', row: { sync_code: CFG.code, id: 'w1', data: v, deleted: false, updated_at: v.updatedAt } }]);
  await idbPut('settings', { key: 'activity', value: '{}' });
  expect(getQueue()).toHaveLength(1);
  await idbDel('vocab', 'w1');
  expect(getQueue()[0].row).toMatchObject({ id: 'w1', deleted: true, data: null });
  expect(await idbGet('vocab', 'w1')).toBeUndefined();
});

it('syncPull: 서버가 더 새로우면 반영, 오래되면 무시, 삭제 표시는 지운다 (큐에는 넣지 않음)', async () => {
  await idbPutRaw('vocab', { id: 'old', updatedAt: 10 });
  await idbPutRaw('vocab', { id: 'mine', updatedAt: 99 });
  await idbPutRaw('vocab', { id: 'gone', updatedAt: 10 });
  tables.vocab = [
    { sync_code: CFG.code, id: 'old', data: { id: 'old', updatedAt: 20, w: 'new' }, deleted: false, updated_at: 20 },
    { sync_code: CFG.code, id: 'mine', data: { id: 'mine', updatedAt: 50 }, deleted: false, updated_at: 50 },
    { sync_code: CFG.code, id: 'gone', data: null, deleted: true, updated_at: 30 },
    { sync_code: CFG.code, id: 'fresh', data: { id: 'fresh', updatedAt: 5 }, deleted: false, updated_at: 5 },
  ];
  await syncPull();
  expect(await idbGet('vocab', 'old')).toEqual({ id: 'old', updatedAt: 20, w: 'new' });
  expect(await idbGet('vocab', 'mine')).toEqual({ id: 'mine', updatedAt: 99 });
  expect(await idbGet('vocab', 'gone')).toBeUndefined();
  expect(await idbGet('vocab', 'fresh')).toEqual({ id: 'fresh', updatedAt: 5 });
  expect(getQueue()).toHaveLength(0);
});

it('pushAll: updatedAt 이 없으면 찍어서 전부 올린다', async () => {
  await idbPutRaw('videos', { id: 'v1' });
  await pushAll();
  const post = calls.find(c => c.method === 'POST' && c.url.includes('/videos?'))!;
  expect(post.body).toEqual([{ sync_code: CFG.code, id: 'v1', data: { id: 'v1', updatedAt: expect.any(Number) }, deleted: false, updated_at: expect.any(Number) }]);
  expect((await idbGet<{ updatedAt?: number }>('videos', 'v1'))?.updatedAt).toEqual(expect.any(Number));
});

it('autoSync: 등록한 후속 처리를 실행하고, 동기화 코드가 없으면 아무것도 안 한다', async () => {
  const hook = vi.fn(async () => {});
  const off = registerSyncHook(hook);
  await autoSync(true);
  expect(hook).toHaveBeenCalledTimes(1);
  setSyncConfigForTests({ ...CFG, code: '' });
  calls = [];
  await autoSync(true);
  expect(calls).toEqual([]);
  expect(hook).toHaveBeenCalledTimes(1);
  off();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/sync/engine`
Expected: FAIL, `Failed to resolve import "./engine"`

- [ ] **Step 3: `src/sync/queue.ts`**

```ts
import { getSetting, putSetting } from '../storage/idb';
import { sbReady } from './config';
import { sbUpsert, type SyncRow } from './supabase';

export interface QueueItem { table: string; row: SyncRow }

let queue: QueueItem[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let applying = false;   // 서버에서 받아 반영하는 중에는 다시 올리지 않는다

export const getQueue = (): QueueItem[] => queue;
export const setApplying = (v: boolean): void => { applying = v; };

function persist(): Promise<void> {
  return putSetting({ key: 'syncQueue', value: queue }).catch(() => {});   // 오프라인 대비 영속
}

export function queuePush(table: string, row: SyncRow): void {
  if(applying || !sbReady()) return;
  queue = queue.filter(q => !(q.table === table && q.row.id === row.id));   // 같은 항목은 최신만
  queue.push({ table, row });
  void persist();
  clearTimeout(timer);
  timer = setTimeout(() => void flushQueue(), 800);
}

export async function flushQueue(): Promise<void> {
  if(!sbReady() || !queue.length) return;
  const batch = queue;
  queue = [];
  const byTable = new Map<string, Map<string, SyncRow>>();   // id별 최신 1건 (중복 키는 Supabase가 배치를 거부)
  for(const { table, row } of batch){
    if(!byTable.has(table)) byTable.set(table, new Map());
    byTable.get(table)!.set(row.id, row);
  }
  try {
    for(const [table, rows] of byTable) await sbUpsert(table, [...rows.values()]);
    await persist();
  } catch(e){
    queue = batch.concat(queue);   // 실패분 복원
    await persist();
    console.warn('flushQueue retry later:', (e as Error).message);
  }
}

export async function restoreQueue(): Promise<void> {
  try { queue = (await getSetting<QueueItem[]>('syncQueue'))?.value ?? []; } catch { queue = []; }
}

export function resetQueueForTests(): void {
  queue = []; clearTimeout(timer); applying = false;
}
```

- [ ] **Step 4: `src/sync/repo.ts`**

```ts
import { idbDelRaw, idbPutRaw, type StoreName } from '../storage/idb';
import { SYNCED_STORES } from '../storage/keys';
import { getSyncConfig } from './config';
import { queuePush } from './queue';

const isSynced = (s: StoreName): boolean => (SYNCED_STORES as readonly string[]).includes(s);
type Stamped = { id: string; updatedAt: number };

/** legacy idbPut 과 같다: 동기화 대상(vocab, videos)이면 updatedAt 을 찍고 푸시 큐에 넣는다. */
export async function idbPut<T extends object>(s: StoreName, v: T): Promise<T & { updatedAt?: number }> {
  if(!isSynced(s)){ await idbPutRaw(s, v); return v; }
  const row = v as T & Stamped;
  row.updatedAt = Date.now();
  await idbPutRaw(s, row);
  queuePush(s, { sync_code: getSyncConfig().code, id: row.id, data: row, deleted: false, updated_at: row.updatedAt });
  return row;
}

/** 동기화 대상이면 삭제 표시(tombstone)를 올린다. */
export async function idbDel(s: StoreName, id: string): Promise<void> {
  await idbDelRaw(s, id);
  if(isSynced(s)) queuePush(s, { sync_code: getSyncConfig().code, id, data: null, deleted: true, updated_at: Date.now() });
}
```

- [ ] **Step 5: `src/sync/engine.ts`**

```ts
import { idbAll, idbDelRaw, idbGet, idbPutRaw } from '../storage/idb';
import { SYNCED_STORES } from '../storage/keys';
import { getSyncConfig, sbReady } from './config';
import { flushQueue, setApplying } from './queue';
import { syncResolve } from './resolve';
import { sbSelect, sbUpsert, type SyncRow } from './supabase';

type Stamped = { id: string; updatedAt?: number };
export type SyncHook = () => Promise<void>;

// 기능별 후속 처리(Gemini 키 kv, 보카 kv 병합, 화면 다시 읽기)는 각 Phase에서 여기에 등록한다.
const hooks: SyncHook[] = [];
export function registerSyncHook(h: SyncHook): () => void {
  hooks.push(h);
  return () => { const i = hooks.indexOf(h); if(i >= 0) hooks.splice(i, 1); };
}

export async function syncPull(): Promise<void> {
  if(!sbReady()) return;
  setApplying(true);
  try {
    for(const table of SYNCED_STORES){
      let rows: SyncRow<Stamped>[];
      try { rows = await sbSelect<Stamped>(table); } catch(e){ console.warn('syncPull ' + table, (e as Error).message); continue; }
      for(const row of rows){
        const local = await idbGet<Stamped>(table, row.id);
        const action = syncResolve(local ? (local.updatedAt || 0) : -1, row);
        if(action === 'put') await idbPutRaw(table, row.data);
        else if(action === 'delete' && local) await idbDelRaw(table, row.id);
      }
    }
  } finally { setApplying(false); }
}

export async function pushAll(): Promise<void> {
  if(!sbReady()) return;
  for(const table of SYNCED_STORES){
    const rows: SyncRow[] = [];
    for(const v of await idbAll<Stamped>(table)){
      if(!v.updatedAt){ v.updatedAt = Date.now(); await idbPutRaw(table, v); }
      rows.push({ sync_code: getSyncConfig().code, id: v.id, data: v, deleted: false, updated_at: v.updatedAt });
    }
    if(rows.length) await sbUpsert(table, rows);
  }
}

let syncing = false;
/** 버튼 없이 자동 동기화 (앱 열 때 full=true, 돌아올 때 false). */
export async function autoSync(full: boolean): Promise<void> {
  if(!sbReady() || syncing) return;
  syncing = true;
  try {
    await flushQueue();
    await syncPull();
    if(full) await pushAll();
    for(const h of hooks) await h();
  } catch(e){ console.warn('autoSync', (e as Error).message); }
  finally { syncing = false; }
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/sync`
Expected: 22 passed (기존 15 + engine 7)

- [ ] **Step 7: `src/sync/bootstrap.ts`** (테스트 없음: 브라우저 이벤트 연결뿐이며 Task 10 미리보기에서 확인)

```ts
import { loadSyncConfig } from './config';
import { autoSync } from './engine';
import { flushQueue, restoreQueue } from './queue';

// legacy init() 의 동기화 부분과 같다. 동기화 코드가 없으면 아무 요청도 하지 않는다.
export async function startSync(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* 지원 안 함 */ }
  await loadSyncConfig();
  await restoreQueue();
  await autoSync(true);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') void autoSync(false); });
  window.addEventListener('focus', () => void autoSync(false));
  window.addEventListener('online', () => void flushQueue());
}
```

- [ ] **Step 8: 타입 검사 후 커밋**

Run: `npx tsc --noEmit`
Expected: 출력 없음

```bash
git add src/sync
git commit -m "feat(sync): 푸시 큐, 저장 훅, pull/pushAll/autoSync 엔진 이관"
```

---

### Task 9: 앱 뼈대 (탭, Zustand, GTM, 탭바)

**Files:**
- Create: `src/app/tabs.ts`, `src/analytics/gtm.ts`, `src/analytics/gtm.test.ts`, `src/store/app.ts`, `src/app/TabBar.tsx`, `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`, `src/main.tsx`

탭 가상 페이지뷰(`virtual_pageview`)는 커밋 `01e6503`과 같은 형식이다. master 작업 폴더에서는 이 코드를 지웠다가 커밋하지 않은 상태로 남아 있다. 이 기능을 쓰지 않기로 정했다면 `trackTabView`와 관련 테스트 1개를 빼고 진행한다.

- [ ] **Step 1: GTM 테스트** — `src/analytics/gtm.test.ts`

```ts
import { beforeEach, expect, it } from 'vitest';
import { GTM_ID, loadGtm, shouldLoadGtm, trackTabView } from './gtm';

beforeEach(() => {
  window.dataLayer = [];
  document.head.querySelectorAll('script[src*="googletagmanager"]').forEach(s => s.remove());
});

it('실제 사이트에서만 GTM 을 켠다', () => {
  expect(shouldLoadGtm('production')).toBe(true);
  expect(shouldLoadGtm('branch-deploy')).toBe(false);
  expect(shouldLoadGtm('deploy-preview')).toBe(false);
  expect(shouldLoadGtm('dev')).toBe(false);
});

it('미리보기에서는 스크립트를 넣지 않는다', () => {
  expect(loadGtm('branch-deploy')).toBe(false);
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
});

it('실제 사이트에서는 컨테이너 스크립트를 넣는다', () => {
  expect(loadGtm('production')).toBe(true);
  expect(document.querySelector<HTMLScriptElement>('script[src*="googletagmanager"]')?.src)
    .toBe(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`);
  expect(window.dataLayer?.[0]).toMatchObject({ event: 'gtm.js' });
});

it('탭 가상 페이지뷰 (기존 커밋과 같은 형식)', () => {
  trackTabView('voca');
  expect(window.dataLayer).toContainEqual({ event: 'virtual_pageview', page_path: '/voca', page_title: '보카' });
});
```

- [ ] **Step 2: 실패 확인 후 `src/app/tabs.ts`, `src/analytics/gtm.ts`**

Run: `npx vitest run src/analytics` → FAIL

```ts
// legacy #tabbar 와 같은 순서·아이콘·이름
export const TABS = [
  { id: 'voca', icon: '🔤', label: '보카' },
  { id: 'conv', icon: '💬', label: '회화' },
  { id: 'wquiz', icon: '🎯', label: '퀴즈' },
  { id: 'learn', icon: '▶', label: '학습' },
  { id: 'video', icon: '🎥', label: '영상' },
  { id: 'settings', icon: '⚙', label: '더보기' },
] as const;

export type TabId = (typeof TABS)[number]['id'];
export const DEFAULT_TAB: TabId = 'wquiz';   // legacy restoreTab() 의 기본값
export const isTabId = (v: unknown): v is TabId => TABS.some(t => t.id === v);
export const tabLabel = (id: TabId): string => TABS.find(t => t.id === id)!.label;
```

```ts
import { tabLabel, type TabId } from '../app/tabs';

export const GTM_ID = 'GTM-T3Q8WB9J';

declare global { interface Window { dataLayer?: Record<string, unknown>[] } }
const dataLayer = () => (window.dataLayer ||= []);

/** 미리보기·로컬 방문이 GA 에 쌓이지 않도록 Netlify CONTEXT 가 production 일 때만 켠다. */
export function shouldLoadGtm(context: string = __DEPLOY_CONTEXT__): boolean {
  return context === 'production';
}

export function loadGtm(context?: string): boolean {
  if(!shouldLoadGtm(context)) return false;
  dataLayer().push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
  return true;
}

/** 탭 = 가상 페이지. GTM 의 맞춤 이벤트 트리거 virtual_pageview 가 GA4 page_view 로 보낸다. */
export function trackTabView(tab: TabId): void {
  dataLayer().push({ event: 'virtual_pageview', page_path: '/' + tab, page_title: tabLabel(tab) });
}
```

Run: `npx vitest run src/analytics`
Expected: 4 passed

- [ ] **Step 3: 앱 화면 테스트** — `src/app/App.test.tsx`

```tsx
import { beforeEach, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { initialTab, useAppStore } from '../store/app';

function start(saved?: string) {
  if(saved !== undefined) localStorage.setItem('elab_tab', saved);
  useAppStore.setState({ tab: initialTab() });
  render(<App />);
}

beforeEach(() => { localStorage.clear(); window.dataLayer = []; });

it('탭 6개를 기존 순서대로 그린다', () => {
  start();
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['🔤보카', '💬회화', '🎯퀴즈', '▶학습', '🎥영상', '⚙더보기']);
});

it('저장된 탭이 없으면 퀴즈 탭', () => {
  start();
  expect(screen.getByRole('button', { name: /퀴즈/ })).toHaveClass('active');
});

it('elab_tab 에 저장된 탭을 연다', () => {
  start('voca');
  expect(screen.getByRole('button', { name: /보카/ })).toHaveClass('active');
});

it('알 수 없는 값이면 퀴즈 탭', () => {
  start('garbage');
  expect(screen.getByRole('button', { name: /퀴즈/ })).toHaveClass('active');
});

it('탭을 누르면 elab_tab 저장, 가상 페이지뷰, 화면 전환', () => {
  start();
  fireEvent.click(screen.getByRole('button', { name: /영상/ }));
  expect(localStorage.getItem('elab_tab')).toBe('video');
  expect(window.dataLayer).toContainEqual({ event: 'virtual_pageview', page_path: '/video', page_title: '영상' });
  expect(screen.getByRole('button', { name: /영상/ })).toHaveClass('active');
  expect(screen.getByTestId('screen')).toHaveTextContent('영상');
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run src/app`
Expected: FAIL, `Failed to resolve import "../store/app"`

- [ ] **Step 5: `src/store/app.ts`**

```ts
import { create } from 'zustand';
import { trackTabView } from '../analytics/gtm';
import { DEFAULT_TAB, isTabId, type TabId } from '../app/tabs';
import { LS_KEYS } from '../storage/keys';
import { lsGetRaw, lsSetRaw } from '../storage/local';

export function initialTab(): TabId {
  const v = lsGetRaw(LS_KEYS.tab);
  return isTabId(v) ? v : DEFAULT_TAB;
}

interface AppState {
  tab: TabId;
  setTab: (tab: TabId) => void;
}

export const useAppStore = create<AppState>()(set => ({
  tab: initialTab(),
  setTab: tab => {
    lsSetRaw(LS_KEYS.tab, tab);
    trackTabView(tab);
    window.scrollTo(0, 0);
    set({ tab });
  },
}));
```

- [ ] **Step 6: `src/app/TabBar.tsx`**

```tsx
import { useAppStore } from '../store/app';
import { TABS } from './tabs';

// legacy CSS(#tabbar .tab, .active, .ico, .lab)를 그대로 쓰려고 같은 마크업을 유지한다.
export function TabBar() {
  const tab = useAppStore(s => s.tab);
  const setTab = useAppStore(s => s.setTab);
  return (
    <nav id="tabbar">
      {TABS.map(t => (
        <div
          key={t.id}
          className={'tab' + (t.id === tab ? ' active' : '')}
          data-s={t.id}
          role="button"
          tabIndex={0}
          aria-current={t.id === tab ? 'page' : undefined}
          onClick={() => setTab(t.id)}
          onKeyDown={e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setTab(t.id); } }}
        >
          <div className="ico">{t.icon}</div>
          <div className="lab">{t.label}</div>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 7: `src/app/App.tsx` 교체**

```tsx
import { useAppStore } from '../store/app';
import { TabBar } from './TabBar';
import { tabLabel } from './tabs';

// 각 탭 화면은 Phase 2~7에서 이 자리를 실제 컴포넌트로 바꾼다.
export function App() {
  const tab = useAppStore(s => s.tab);
  return (
    <>
      <section className="screen active" data-testid="screen">
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          {tabLabel(tab)} 화면은 이관 중입니다.
        </div>
      </section>
      <TabBar />
    </>
  );
}
```

Run: `npx vitest run src/app`
Expected: 5 passed

- [ ] **Step 8: `src/main.tsx` 교체**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/legacy';
import { loadGtm, trackTabView } from './analytics/gtm';
import { App } from './app/App';
import { useAppStore } from './store/app';
import { startSync } from './sync/bootstrap';

loadGtm();
trackTabView(useAppStore.getState().tab);   // legacy 는 시작할 때 tabTo() 로 첫 화면을 보냈다
void startSync();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 9: 전체 테스트와 빌드**

Run: `npm test`
Expected: 100 passed (data 3 + core 57 + storage 9 + sync 22 + analytics 4 + app 5)

Run: `npm run build`
Expected: 에러 없음

- [ ] **Step 10: 커밋**

```bash
git add src
git commit -m "feat(app): 탭바 뼈대, Zustand 탭 상태(elab_tab), 실제 사이트 전용 GTM"
```

---

### Task 10: 미리보기에서 확인

- [ ] **Step 1: 로컬 확인**

Run: `npm run dev`. 브라우저에서 `http://localhost:5173`을 연다.
- 탭바 6개가 기존 사이트와 같은 모양으로 보인다(기존 CSS 적용).
- 탭을 누르면 DevTools → Application → Local Storage의 `elab_tab` 값이 바뀌고, 새로고침해도 그 탭이 열린다.
- Console에 `window.dataLayer`를 입력하면 `virtual_pageview` 항목이 보이고, Network에 `googletagmanager` 요청은 없다(로컬은 `dev`).
- Application → IndexedDB에 `tabloEnglishLab`(stores: `recordings`, `settings`, `videos`, `vocab`)이 생긴다.

- [ ] **Step 2: 푸시하고 브랜치 배포 확인**

```bash
git push
```

Netlify **Deploys**에서 `react-migration` 배포가 Published가 될 때까지 기다린 뒤 `https://react-migration--<사이트이름>.netlify.app`에서 Step 1과 같은 항목을 확인한다. 특히 Network에 `googletagmanager.com/gtm.js` 요청이 **없어야** 한다(CONTEXT=`branch-deploy`).

- [ ] **Step 3: 실제 사이트에 영향 없는지 확인**

실제 사이트 주소에 기존 앱이 그대로 떠 있고, Netlify의 Production deploy가 여전히 master 커밋인지 확인한다.

- [ ] **Step 4: Phase 1 완료 기록**

[로드맵](2026-10-13-react-migration-roadmap.md) 표에서 Phase 1의 완료 기준을 충족했는지 확인하고, 다음 Phase(일기·작문) 계획 문서를 작성한다.
