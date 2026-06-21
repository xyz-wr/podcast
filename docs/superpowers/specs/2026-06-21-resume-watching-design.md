# 보던 영상 이어보기 (Resume Watching) — 설계

날짜: 2026-06-21
대상: `index.html` (Tablo English Lab 단일 파일 앱)

## 배경 / 문제

현재 앱에는 영상마다 북마크가 **하나**(`bookmark = {idx, time}`)만 있다. 이 북마크는
두 가지 의미가 섞여 있다.

- 자막 줄을 탭하면 앞으로 전진하는 **학습 진도** 마커 (`markStudied`, 앞으로만)
- 영상을 다시 열 때 그 위치에서 재생되는 **재생 복귀 지점** (`openVideo`, `resumeBookmark`)

또한 앱을 켜면 라이브러리(영상 목록)가 뜨고, "내가 마지막에 보던 영상"으로 한 번에
돌아가는 입구가 없다. 사용자는 목록에서 영상을 직접 찾아 눌러야 한다.

## 목표

1. **학습 진도**와 **재생 위치 이어보기**를 별도 북마크로 분리한다.
2. 재생 위치는 유튜브/넷플릭스처럼 **자동 저장**되어, 영상을 다시 열면 그 지점에서 이어 본다.
3. 홈(학습 탭) 상단에 **"이어보기" 섹션**을 두어, 진행 중인 영상에 한 번에 복귀한다.

## 비목표 (YAGNI)

- 앱 실행 시 마지막 영상 자동 진입(자동 재생) — 하지 않는다. 사용자가 의도적으로 선택.
- 한 영상에 여러 개의 수동 그림표(다중 구간 저장) — 하지 않는다.
- 크로스 디바이스 동기화 전용 처리 — 기존 sync 흐름(`pushAll`/`syncPull`)이 영상 객체를
  통째로 올리므로 `resume` 필드도 자연히 따라간다. 별도 작업 없음.

## 데이터 모델

영상 객체에 필드 하나 추가:

```js
v.resume = { time: Number /* 초 */, at: Number /* Date.now(), 정렬용 */ }
```

- 기존 `v.bookmark = {idx, time}` 는 **학습 진도** 의미로 그대로 유지한다.
  (탭 전진, 🔖 자막 플래그, `studied` 줄 음영 — 모두 변경 없음)
- 마이그레이션 불필요: `resume`이 없는 기존 영상은 `bookmark.time`으로 폴백한다.

## 동작 설계

### 1. 이어보기 지점 = "나간 지점"만 저장

이어보기는 **영상에서 나간 그 순간의 재생 위치**만 기억하면 된다. 주기적(폴링) 저장은
하지 않는다. 영상을 벗어나는 "이벤트"에서만 `saveResume()`를 호출한다.

`saveResume()` 신설:

- `player.getCurrentTime()`을 읽어 `currentVideo.resume = {time, at: Date.now()}` 저장(`idbPut`).
- `time < 2` 이면 스킵(시작 직후/잡음 방지).
- 저장 시 `loadAll` 재렌더는 하지 않는다(학습 화면 깜빡임 방지). 홈 섹션은 다음
  `renderLibrary` 때 갱신.

저장을 호출하는 "나가는" 지점:

- 플레이어 `onStateChange`(`mountPlayer`의 events) 추가 → `PAUSED` / `ENDED` 시 즉시 `saveResume()`
  - `ENDED` → `resume` 제거(`delete v.resume`) 후 저장 → 다 본 영상은 이어보기 목록에서 빠짐
- `pausePlayer()` 내부에서 `saveResume()` 호출
- 다른 영상으로 `openVideo` 진입 직전 현재 영상 저장
- `tabTo()`(학습 화면을 떠날 때) — 이미 `pausePlayer()`를 호출하므로 자동 포함
- `document` `visibilitychange`(hidden) / `pagehide` — 앱/탭을 떠나거나 백그라운드로 갈 때
  현재 위치 저장(모바일에서 갑작스런 종료 대비). 폴링이 아니라 이벤트 1회.

### 2. 영상 열 때 (`openVideo`)

재생 시작 위치 우선순위를 변경:

```
resume.time  →  bookmark.time  →  0
```

- 학습 진도 스크롤(`scrollToLine(bookmark.idx)`)과 자막 플래그는 그대로 유지.
- `mountPlayer(youtubeId, startSeconds)` 의 `startSeconds`만 위 우선순위로 결정.

### 3. 학습 화면 칩

- substrip의 `🔖 이어보기` 칩(`resumeChip` / `resumeBookmark`):
  이제 **`resume`** 기준으로 동작/표시. `resume`이 있으면 `🔖 이어보기 mm:ss` 표시 후 탭 시
  `resume.time`으로 점프. 없으면 숨김. (기존 `updateResume`/`resumeBookmark`를 `resume` 사용으로 수정)
- loopbar의 `🔖`(현재 위치 북마크 = `bookmarkCurrent`) = **학습 진도** → 변경 없음.

### 4. 홈(학습 탭) 상단 "이어보기" 섹션

- `#screen-library` 안, `#libList` **위**에 가로 스크롤 섹션(`#resumeRow`) 추가.
- 표시 대상: `v.resume && v.resume.time != null` 인 영상, `resume.at` **내림차순**, 최대 **8개**.
- 카드 구성: 썸네일 + 제목 + `이어보기 mm:ss`. 탭 → `openVideo(id)` (resume 지점에서 재생).
  (진행% 등 부가 표시는 없음 — 나간 지점만 보여준다)
- 카드에 **✕** 버튼 = 이어보기에서 제거(`delete v.resume` 후 저장 + 재렌더). 학습 진도는 보존.
- 진행 중 영상이 없으면 섹션 전체 숨김(빈 영역 없음).
- `renderLibrary()`에서 `renderResumeRow()`를 함께 호출.

## 영향 범위 (index.html)

| 위치 | 변경 |
|--|--|
| `mountPlayer` (~670) | `onStateChange` 이벤트 추가(PAUSED/ENDED 시 저장) |
| `pausePlayer` (~675) | `saveResume()` 호출 추가 |
| bookmark 섹션 (~685) | `saveResume`/`clearResume` 신설, `updateResume`/`resumeBookmark`를 `resume` 기준으로 변경 |
| `openVideo` (~779) | 시작 위치 우선순위 `resume → bookmark → 0` |
| `renderLibrary` (~727) | `renderResumeRow()` 호출 |
| `init`/전역 | `visibilitychange`/`pagehide` 리스너에서 `saveResume()` |
| 신설 | `renderResumeRow()`, `resumeCardHTML()`, `removeResume(id)` |
| `#screen-library` 마크업 | `#resumeRow` 컨테이너 + 섹션 제목 |
| CSS | 가로 스크롤 행 / 이어보기 카드 스타일 |

## 엣지 케이스

- `resume.time`이 영상 길이를 넘는 경우: 유튜브 플레이어가 알아서 클램프. 별도 처리 불필요.
- 자막(`lines`)이 없는 영상도 재생 위치 저장은 동작(진행%만 생략).
- 동일 영상을 학습 중 자동 저장 → 홈 섹션 순서는 다음 진입 시 갱신(실시간 재정렬 불필요).
- `resume`과 `bookmark`가 가리키는 위치가 달라도 정상(서로 독립).

## 테스트 관점

- 영상 재생 → 잠시 본 뒤 떠남(탭 이동/뒤로/일시정지) → 다시 열면 나간 지점에서 재생되는가.
- 일시정지 / 백그라운드 전환(visibilitychange) 시 그 지점이 저장되는가.
- 끝까지 본 영상이 이어보기 목록에서 사라지는가(ENDED).
- 홈 "이어보기" 섹션이 최신순으로 뜨고, ✕로 제거되며, 학습 진도는 보존되는가.
- 자막 줄 탭(학습 진도)이 resume과 충돌하지 않는가.
