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
   - localStorage: `elab_tab`, `elab_voice`, `elab_progress_v1`, `eldiary_v1`, `elab_quiz_v1`, `engWriteB1_v1`, `elab_voca_v1`
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

| Phase | 내용 | 계획 문서 | 완료 기준 |
|---|---|---|---|
| 1 | 기반 작업: 브랜치·worktree, Vite 프로젝트, Netlify 브랜치 배포, 데이터·순수 로직·CSS 추출, 저장소·동기화 계층, 앱 뼈대(탭바) | `2026-10-13-react-migration-phase1.md` | 미리보기 주소에서 탭바가 뜨고, 탭 전환이 `elab_tab`에 저장되고, 모든 테스트 통과 |
| 2 | 일기, 작문 (작은 모듈) | 추후 작성 | 기존 데이터(`eldiary_v1`, `engWriteB1_v1`)가 그대로 보임 |
| 3 | 퀴즈(`wquiz`): 문장 퀴즈, 리스닝, 음성 선택(`elab_voice`) | 추후 작성 | `elab_quiz_v1` 유지, TTS 동작 |
| 4 | 회화·학습·상세: 회화 카드, 진도(`elab_progress_v1`), 라이브러리 | 추후 작성 | |
| 5 | 영상: YouTube 플레이어, 자막, 구간 반복, 녹음(`recordings`), 이어보기 | 추후 작성 | StrictMode에서도 플레이어 중복 생성 없음 |
| 6 | 보카(가장 큼): 학습 단계, 복습, 캘린더, `voca_v1` kv 병합 동기화 | 추후 작성 | `elab_voca_v1`과 kv 병합 결과가 기존과 같음 |
| 7 | 더보기: 동기화 설정 UI, Gemini 키(kv `geminiKey`), 백업, 스트릭, 개선 노트 | 추후 작성 | 테스트 코드로 기기 2대 동기화 확인 |
| 8 | 동등성 검증과 교체: 기능 체크리스트, 실제 데이터 사본으로 확인, master 병합 | 추후 작성 | 아래 "교체 절차" 완료 |
| 9 | 통계 리포트: Supabase Edge Function(GA4 Data API) + 리포트 화면 | 추후 작성 | |

## 교체 절차 (Phase 8)

1. 미리보기에서 Phase 2~7의 체크리스트를 모두 통과한다.
2. 실제 사이트에서 "더보기 → 백업"으로 내보내기를 해 둔다(되돌릴 때를 대비).
3. `react-migration`을 `master`에 병합하고 푸시한다. Netlify가 실제 사이트에 배포한다.
4. 실제 사이트에서 기존 기록(보카, 퀴즈, 일기, 영상, 동기화 코드)이 그대로 보이는지 확인한다.
5. 문제가 있으면 Netlify **Deploys**에서 직전 배포를 "Publish deploy"로 즉시 되돌린다. 저장소 이름을 바꾸지 않았기 때문에 데이터는 그대로 남아 있다.
