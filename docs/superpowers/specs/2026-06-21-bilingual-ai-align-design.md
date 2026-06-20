# 인앱 양방향 자막 AI 정렬 — 설계

날짜: 2026-06-21
대상 파일: `index.html` (단일 파일 앱)

## 배경 / 문제
YouTube 자동 자막을 가져오면 영어가 타임스탬프 줄마다 끊겨 흐르고, 같은 줄의
한국어는 보통 **1~2큐 앞선 영어의 번역**(지연/lag)이라 짝이 어긋난다. 또한 음성
인식 오류(예: `it's adinga` ← 실제 `it's Ariannita la Gringa`)와 `[Music]`·시간
라벨 같은 노이즈가 섞인다.

현재 [`applyTranscript`](../../../index.html) 흐름은 번갈아형(interleaved)으로
감지되면 "이미 정렬됨"으로 보고 **AI 정렬을 건너뛴 채** `parseBilingual` 결과를
그대로 저장한다. `parseBilingual`은 "영어 덩어리 → 바로 뒤 한국어 = 그 번역"을
가정하므로 지연이 있는 실제 자막에서 짝이 어긋난다.

## 목표
번갈아형 양방향 자막을 가져올 때, Gemini 키가 있으면 AI가 분리·교정·문장정렬·
1:1 짝·시간배정까지 처리해 깨끗한 정렬을 만든다. 키가 없거나 AI가 실패하면 현행
휴리스틱(`parseBilingual`)으로 조용히 폴백한다.

## 비목표 (YAGNI)
- 폴백 경로에 오프셋 자동보정 같은 복잡한 휴리스틱을 넣지 않는다(불안정·가치 낮음).
- 새 저장 포맷/스키마를 만들지 않는다. 기존 `videos.lines` 배열을 그대로 쓴다.
- `koSegmented`, `looksUnpunctuated` 등 다른 가져오기 경로는 건드리지 않는다.

## 설계

### ① 통합 지점
변경은 `applyTranscript`의 AI 분기 한 곳에 집중한다. 현재 `interleaved`일 때
아무 것도 하지 않던 가지를 다음으로 바꾼다:

```
interleaved 감지 && GEMINI_KEY 있음
  → lines = await aiAlignInterleaved(raw)   // 성공 시 교체
  → 실패/빈결과면 기존 parseBilingual 결과(lines) 유지
interleaved 감지 && 키 없음
  → 기존 parseBilingual 결과 그대로 + "키 넣으면 더 깔끔" 토스트 1회
```

`buildLines`의 번갈아형 처리(`parseBilingual` 호출)는 그대로 두어, AI 실패 시
fallback 결과가 항상 존재하도록 한다.

### ② 새 함수 `aiAlignInterleaved(raw)`
- 입력: 어긋난 양방향 원문 통짜 텍스트(타임스탬프 포함).
- AI가 하는 일:
  1. 영어/한국어 스트림 분리
  2. 명백한 ASR 오류 교정 (예: `adinga`→`Ariannita la Gringa`,
     `saw problem`→`solve a problem`)
  3. `[Music]`·`0:11 11초` 류 노이즈 제거
  4. 영어를 문장 단위로 묶고 한국어와 **의미 기반 1:1** 짝
  5. 각 쌍에 원문 타임스탬프 중 그 영어 첫 단어가 등장하는 시각을 시작 시간으로 배정
- 출력: `[{time, end, en, ko, chapter}]` — 앱이 이미 쓰는 라인 배열. 새 포맷 없음.
- 구현: 기존 [`callGemini`](../../../index.html) 재사용, JSON 배열 응답을 강제.
  파싱 실패/빈 응답이면 예외를 던져 호출부에서 폴백.

JSON 응답 형태(모델에 요구):
```json
[{"start":"0:00","en":"...","ko":"..."}, ...]
```
`start`는 호출부에서 초로 변환(`tcToSec`), `end`는 다음 쌍의 start(마지막은 +3초)로
채운다 — 기존 `parseBilingual`의 end 보간과 동일 규칙.

### ③ 폴백 (키 없음 / AI 실패)
현행 `parseBilingual` 결과를 그대로 사용. 동작은 보장하되 지연은 못 고친다.
키가 없을 때만 토스트로 "AI 키를 넣으면 더 깔끔히 정렬돼요" 안내(1회).

### ④ UX / 진행표시 / 에러
- 트리거: 가져오기 시 자동. 버튼 텍스트 `AI가 영어·한국어 정렬 중…`(기존 패턴).
- 에러: 기존 `try/catch + aiErr`로 감싸 실패해도 원문(휴리스틱 결과) 유지.
- 정렬 후 영어만 있고 한국어가 빈 줄이 있으면 기존 `aiTranslateLines` 보강 단계가
  그대로 처리.

### ⑤ 테스트 / 검증
단일 HTML 앱이라 자동 테스트 인프라가 없으므로 픽스처 기반 수동 검증:
- 입력: `samples/`의 원본(어긋난) 자동자막 텍스트.
- 기대: 출력이 12쌍으로 정렬되고, `samples/ariannita-cincinnati.json`의 정답과
  의미상 일치(ASR 교정·노이즈 제거 포함).
- 폴백: 키 비활성 상태에서 같은 입력 → 깨지지 않고 라인 생성.

## 변경 파일
- `index.html`: `aiAlignInterleaved` 함수 추가, `applyTranscript`의 interleaved 분기 수정.
- (검증용) `samples/ariannita-cincinnati.*` — 픽스처/정답으로 사용.

## 영향 / 리스크
- 토큰 사용: 번갈아형 + 키 있을 때 1회 추가 호출. 기존 AI 자동흐름과 동일 수준.
- 실패 모드: AI 오류·잘못된 JSON → 폴백으로 항상 사용 가능한 결과 유지.
