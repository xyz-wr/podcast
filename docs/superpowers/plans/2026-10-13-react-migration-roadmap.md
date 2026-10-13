# React 전면 이관 로드맵

> 단일 파일 앱(`index.html`, ~5,750줄)을 **Vite + React + TypeScript + Zustand**로 다시 만든다.
> 별도 브랜치 `react-migration`에서 작업하고 **Netlify 브랜치 미리보기 배포**로 확인한 뒤, 기능을 다 따라잡았을 때만 `master`에 합쳐 실제 사이트를 교체한다.
> 각 Phase는 따로 계획 문서를 만든다. 이 문서는 전체 순서와 모든 Phase에 공통으로 적용되는 규칙만 담는다.

## 결정 사항 (2026-10-13)

| 항목 | 결정 |
|---|---|
| 프레임워크 | React + Vite |
| 언어 | TypeScript (기존 순수 로직은 처음엔 JS 그대로 옮기고, 그 기능을 이관할 때 TS로 바꾼다) |
| 상태 관리 | Zustand |
| 백엔드 | 바꾸지 않는다. Supabase(`kv`, `vocab`, `videos` 테이블 + RLS) 그대로 |
| 배포 | Netlify 그대로. 브랜치 `react-migration`은 브랜치 배포(`react-migration--<사이트이름>.netlify.app`) |
| 작업 위치 | `git worktree`로 **OneDrive 밖** 폴더(`C:/Users/judan/dev/podcast-react`)에서 작업한다. `node_modules`가 OneDrive로 동기화되지 않게 하기 위해서다. master 작업 폴더(커밋 안 된 변경 포함)는 건드리지 않는다. |

## 모든 Phase 공통 규칙

1. **저장소 이름은 절대 바꾸지 않는다.** 실제 사이트를 교체하는 순간 새 앱이 같은 도메인의 기존 데이터를 그대로 읽어야 한다.
   - localStorage: `elab_tab`, `elab_voice`, `elab_progress_v1`, `elab_quiz_v1`, `elab_voca_v1`
   - IndexedDB: 이름 `tabloEnglishLab`, 버전 `1`, 저장소 `videos`/`vocab`/`recordings`(keyPath `id`, `vocab`·`recordings`에 `videoId` 인덱스), `settings`(keyPath `key`)
   - `settings` 키: `activity`, `folders`, `geminiKey`, `sbKey`, `sbUrl`, `syncCode`, `syncQueue`
   - Supabase: 테이블 `vocab`·`videos`(`on_conflict=sync_code,id`), `kv`(`on_conflict=sync_code,k`), 요청 헤더 `x-sync-code`, kv 키 `geminiKey`·`voca_v1`
   - 모든 이름은 `src/storage/keys.ts` 한 곳에만 정의하고, 계약 테스트(`src/storage/keys.test.ts`)로 고정한다.
2. **저장 형식도 그대로 둔다.** 각 모듈의 localStorage 값은 지금과 같은 JSON 구조로 읽고 쓴다(`elab_tab`만 JSON이 아닌 문자열). 구조를 바꿔야 한다면 이전 형식을 읽어서 변환하는 코드와 테스트를 먼저 만든다.
3. **미리보기에서는 테스트용 동기화 코드를 쓴다.** 미리보기 주소는 출처(origin)가 달라서 브라우저 저장소가 비어 있고, 실제 동기화 코드를 넣으면 개발 중인 코드가 실제 학습 기록을 덮어쓸 수 있다.
4. **GA는 실제 사이트에서만 켠다.** 빌드할 때 Netlify의 `CONTEXT` 값이 `production`일 때만 GTM을 불러온다. 미리보기 방문은 GA에 쌓이지 않는다.
5. **legacy는 참고용으로 고정한다.** 브랜치에서 기존 앱은 `legacy/index.html`로 옮겨 두고 수정하지 않는다. master에서 기존 앱이 바뀌면 그 변경을 `legacy/index.html`에 반영하고 `npm run extract`를 다시 돌린다.
6. 화면 모양은 기존 CSS(`src/styles/legacy/*.css`)와 class 이름을 그대로 써서 맞춘다. 디자인 개선은 이관이 끝난 뒤에 따로 한다.

## Phase 순서

2026-10-13 결정: 일기·작문·개선·스트릭은 legacy에서 들어갈 경로가 없는 화면이라 **이관하지 않는다.** 브라우저에 남은 기록(`eldiary_v1`, `engWriteB1_v1` 등)은 읽지도 지우지도 않는다.

| Phase | 내용 | 계획 문서 | 완료 기준 |
|---|---|---|---|
| 1 | 기반 작업: 브랜치·worktree, Vite 프로젝트, Netlify 브랜치 배포, 데이터·순수 로직·CSS 추출, 저장소·동기화 계층, 앱 뼈대(탭바) | `2026-10-13-react-migration-phase1.md` | 완료 |
| 2 | 화면 구조(`<main>` 안/밖, `screen-` id) + 영작 퀴즈(`wquiz`) + TTS 모듈(`elab_voice`) | `2026-10-13-react-migration-phase2.md` | 완료 |
| 3 | 회화 탭(홈·카테고리·주제·북마크, `elab_progress_v1`) + 퀴즈 표현 모드(세션별 스토어) | `2026-10-13-react-migration-phase3.md` | 완료 |
| 4a | 학습 탭 목록: 영상·폴더·이어보기 줄·단어 목록, 영상 추가(oEmbed 제목)/이동/삭제, 공용 확인창·입력창·토스트 | `2026-10-13-react-migration-phase4a.md` | 완료 |
| 4b | 자막 처리: SRT/VTT/일반 텍스트(챕터)/한영 교차/JSON 쌍 파싱, 문장 병합·한국어 정렬(순수 함수 + 테스트), Gemini 공용 클라이언트(`gemini`, `aiErr`)와 AI 보조 정렬, 자막 입력 창 | 추후 작성 | 같은 자막 입력으로 legacy와 같은 `lines` |
| 4c | 학습 화면: YouTube 플레이어(하나만 만들고 재사용), 속도·구간 반복, 이어보기 저장(일시정지·탭 이동·화면 숨김·페이지 닫기), 북마크(탭/길게 누르기), 자막 표시(챕터·한국어 토글·관용구 묶음·학습 표시) | 추후 작성 | StrictMode에서도 플레이어 중복 생성 없음 |
| 4d | 단어: 자막 단어 선택·선택 막대·담기(Gemini 표제어 정리, 없으면 Google 번역), 단어 카드의 구간 이동, 단어 상세(뜻 수정, CEFR 예문 생성·피드백·저장, 음성 입력) | 추후 작성 | `vocab` 기록이 legacy와 같음 |
| 5 | 영상 탭(`VideoApp`, 회화 카테고리를 쓰는 약 480줄 모듈. 세부 내용은 계획 때 확인) | 추후 작성 | |
| 6 | 보카(가장 큼): 학습 단계, 복습, 캘린더, `voca_v1` kv 병합 동기화 | 추후 작성 | `elab_voca_v1`과 kv 병합 결과가 기존과 같음 |
| 7 | 더보기: 동기화 설정 UI, Gemini 키(kv `geminiKey`), 백업, 목소리 선택 | 추후 작성 | 테스트 코드로 기기 2대 동기화 확인 |
| 8 | 동등성 검증과 교체: 기능 체크리스트, 실제 데이터 사본으로 확인, master 병합 | 추후 작성 | 아래 "교체 절차" 완료 |
| 9 | 통계 리포트: Supabase Edge Function(GA4 Data API) + 리포트 화면 | 추후 작성 | |

## Phase 1 리뷰에서 넘어온 할 일

동기화 계층 리뷰(Task 7–8)와 최종 리뷰에서 나온 항목 중 이후 Phase에서 처리할 것. 대부분 legacy에도 있는 동작이라 Phase 1에서는 그대로 두었다.

| 항목 | 처리할 Phase |
|---|---|
| `registerSyncHook`에 단계 구분 추가(예: `postPull` → `reload`). Gemini 키·보카 kv 병합이 끝난 뒤 화면 다시 읽기가 실행되도록, 등록 순서에 기대지 않게 한다. | 6 또는 7 (첫 훅을 붙일 때) |
| "지금 동기화" 버튼(`syncNow`)과 설정 저장 시 연결 테스트(`sbSelect` 후 전체 동기화) | 7 |
| 동기화 코드를 바꾸면 큐에 남은 항목의 `sync_code`가 옛 값이라 RLS에 계속 거부됨 → 코드 변경 시 큐 정리 또는 flush 때 현재 코드로 바꿔 쓰기 | 7 |
| 서버에서 `deleted:false`인데 `data:null`인 행이 오면 pull 전체가 멈춤 → 해당 행 건너뛰고 경고 | 7 |
| 동시 flush(타이머 + autoSync)로 오래된 묶음이 나중에 도착할 수 있음 → flush 직렬화. 근본 해결은 서버 쪽 `updated_at` 비교 upsert(트리거/RPC)를 두 앱 공통으로 적용하는 것 | 7 |
| `repo.idbPut` 타입 강화(동기화 대상은 `id` 필수) | 기능에서 처음 쓸 때 |
| ~~화면을 `<main>` 안/밖 `<section id="screen-…">`으로~~ | 2 (Task 2) |
| 탭 id와 화면 id 분리 → 숨은 화면을 이관하지 않기로 해서 필요 없어짐. 학습 탭 안의 하위 화면(`study`, `detail`)은 학습 스토어의 `screen` 상태로 다룬다 | 4a (완료) |
| 추출 스크립트: `<style>` 개수 검증, 같은 이름 중복 시 오류 | 다음에 `npm run extract`를 고칠 때 |
| master에서 기존 앱이 바뀌면 브랜치의 루트 `index.html`과 충돌한다 → 그 변경을 `legacy/index.html`에 적용하고 `npm run extract` 실행 | master를 브랜치에 합칠 때마다 |

## Phase 2 리뷰에서 넘어온 할 일

| 항목 | 처리할 Phase |
|---|---|
| 퀴즈 표현 모드(`runExpression`): 스토어 하나에 넣으면 회화 탭에서 표현 연습을 시작할 때 퀴즈 탭의 진행 화면·복습 세션이 덮어써진다(legacy도 같음). 세션별 스토어(예: `createQuizSession(kind)`)로 분리하고, 끝났을 때 콜백(`onExit`)은 상태가 아니라 동작 인자로 넘긴다. `settle`은 표현 모드에서 라운드를 다시 채우지 않는다 | 3 (완료) |
| 회화 데이터(515KB)가 메인 번들에 들어가 JS가 913KB(gzip 258KB)다. legacy도 HTML에 같은 데이터를 담고 있어 회귀는 아니지만, 지연 로딩(`import()`)으로 첫 화면을 가볍게 할 수 있다 | 8 이후 (개선) |
| **legacy 채점기 한계:** 핵심 표현이 불규칙 활용(made, laid, got …)으로 바뀌면 모범 답안도 오답 처리된다(1,284문장 중 227개, 약 18%). "사실 맞았어요"로 넘길 수는 있다. 이관 범위에서는 legacy와 똑같이 두었고, 고치려면 `exprWords`/`variants`에 불규칙 동사표를 더한다(보카의 `VK_IRR` 재사용 가능) | 이관 후 개선 (사용자 결정) |

## Phase 8 교체 체크리스트에 추가

- 병합 배포 후 실제 사이트에서 `gtm.js` 요청과 `dataLayer`를 확인한다. GTM은 Netlify 빌드의 `CONTEXT=production`에만 의존하므로, Netlify가 아닌 곳에서 빌드한 결과를 배포하면 GA가 꺼진 채로 나간다.
- Netlify 환경 변수에 `NODE_ENV=production`을 넣지 않는다. 넣으면 빌드에 필요한 devDependencies(tsc, vite)가 설치되지 않는다.

## 교체 절차 (Phase 8)

1. 미리보기에서 Phase 2~7의 체크리스트를 모두 통과한다.
2. 실제 사이트에서 "더보기 → 백업"으로 내보내기를 해 둔다(되돌릴 때를 대비).
3. `react-migration`을 `master`에 병합하고 푸시한다. Netlify가 실제 사이트에 배포한다.
4. 실제 사이트에서 기존 기록(보카, 퀴즈, 일기, 영상, 동기화 코드)이 그대로 보이는지 확인한다.
5. 문제가 있으면 Netlify **Deploys**에서 직전 배포를 "Publish deploy"로 즉시 되돌린다. 저장소 이름을 바꾸지 않았기 때문에 데이터는 그대로 남아 있다.

## Phase 4 조사·리뷰에서 넘어온 할 일

| 항목 | 처리할 Phase |
|---|---|
| legacy 학습 탭에서 쓰이지 않는 코드는 옮기지 않는다: 옛 단어 퀴즈(`screen-quiz`, SRS `updateSRS`), 녹음(쓰는 코드 없음), 스트릭 기록(`logActivity`, `settings.activity`), `updateBadges`(대상 요소 없음), 캡처 단어 | 결정됨 |
| `pausePlayer`·선택 해제가 legacy에선 **모든 탭 이동**과 단어 상세 열기에서 실행된다 → 플레이어 소유자가 앱 수준 탭 이동에 일시정지 훅을 제공해야 한다. 학습 화면 ‹ 뒤로 가기도 일시정지(legacy는 계속 재생되는 버그) | 4c |
| `#ytPlayer` 노드를 YT가 iframe으로 바꾼다 → React가 그 노드를 다시 그리지 않도록 고정하고, 영상이 바뀌면 `cueVideoById`로 재사용 | 4c |
| 이어보기 저장은 일시정지·끝·화면 숨김·페이지 닫기에서 2초 이상일 때만, `idbPut`이라 매번 동기화 큐에 들어간다(legacy와 같음) | 4c |
| Gemini 클라이언트는 학습 탭 전용이 아니라 공용(보카 탭도 `window.gemini` 사용). 키 없음 오류는 더보기로 이동(legacy `aiErr`) | 4b |
| gemini-2.5-flash의 "생각" 토큰이 `maxOutputTokens`(기본 600)에 포함돼 JSON이 잘릴 수 있다는 의심 → 실제 응답으로 확인 후 필요하면 토큰을 늘리거나 thinking 예산을 0으로 | 4b |
| 단어 중복 검사는 현재 영상 안에서만, Gemini가 표제어로 바꾼 뒤엔 자막의 "담은 단어" 표시와 중복 검사가 어긋날 수 있다(legacy와 같음) | 4d (그대로 두고 메모) |
| 백업 내보내기/가져오기는 더보기 화면. legacy 가져오기는 성공해도 `bkModal`이 없어 "파일을 읽지 못했어요"가 뜨는 버그 | 7 |
