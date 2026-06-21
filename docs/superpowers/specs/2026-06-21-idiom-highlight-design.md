# 관용구 하이라이트 (Idiom Highlight) — 설계

날짜: 2026-06-21
대상: `index.html` (Tablo English Lab 앱) + `subtitle-to-aligned-json` 스킬 + `samples/` 기존 4개

## 배경 / 목표

자막이 화면에 나올 때 **관용구(idiom)를 자동으로 하이라이트**해 학습자가 통째로 외워야 할
표현을 눈에 띄게 한다. 단어 추가(탭→단어장)는 **지금 그대로 수동**으로 둔다. 관용구는
시각 표시일 뿐, 탭 동작·단어장 추가에는 영향을 주지 않는다.

핵심 결정: 관용구 **감지는 빌드 시점에 한다.** 앱에 사전을 내장하거나 Gemini로 실시간
감지하지 않는다. `/subtitle-to-aligned-json` 스킬로 JSON을 만들 때 작성자(assistant)가
관용구를 직접 식별해 JSON에 박아 넣고, 앱은 **미리 표시된 관용구만** 하이라이트한다.
→ 오프라인·즉시·429 없음, 앱은 단순.

## 비목표 (YAGNI)

- 관용구 뜻 팝업/툴팁 — 지금은 하이라이트만. (데이터 확장으로 나중에 가능)
- 앱 내장 관용구 사전 / 런타임 자동 감지 — 하지 않는다.
- 직접 SRT로 추가한 영상의 하이라이트 — `idioms` 데이터가 없으므로 자동으로 표시 없음.

## 데이터 형식

aligned JSON의 각 쌍에 선택적 `idioms` 배열을 추가한다. 값은 **그 줄(`en`)에 실제로
등장하는 관용구 표현을 원문 그대로** 담는다.

```json
{ "i": 12, "start": "00:00:31,000", "end": "00:00:34,500",
  "en": "it's a piece of cake once you get the hang of it",
  "ko": "요령만 익히면 식은 죽 먹기야",
  "idioms": ["a piece of cake", "get the hang of it"] }
```

- `idioms` 없거나 빈 배열 → 그 줄은 하이라이트 없음.
- 기존 JSON(이 필드 없음)도 그대로 유효 — 하위 호환.

## 앱 변경 (index.html)

### 1. `parseAlignedJson` — 필드 보존
라인 매핑 객체에 한 줄 추가:

```js
idioms: Array.isArray(p.idioms) ? p.idioms.filter(x=>typeof x==='string' && x.trim()) : [],
```

### 2. `renderTranscript` — 토큰 매칭 후 클래스 부여
영어 단어 span을 만들 때, 그 줄의 `idioms`를 토큰 열에 매칭해 해당 토큰 인덱스에
`idiom` 클래스를 추가한다.

- 토큰 정규화: 기존 `cleanTerm(token).toLowerCase()`.
- 관용구 정규화: 소문자 + 공백 분리 → 단어 배열.
- **슬라이딩 윈도우**로 연속 일치 검색 → 일치 구간의 토큰 인덱스를 `Set`에 모은다(여러
  관용구·복수 출현 허용).
- 헬퍼 `idiomIdxSet(tokens, idioms)` 신설 → `Set<number>`.
- span 생성 시 `idiomSet.has(i)`면 클래스에 ` idiom` 추가.

단어 탭/선택/추가(`toggleWord`)는 **변경 없음** — 관용구 토큰도 탭하면 그 단어 하나만 선택.

### 3. CSS — `.word.idiom`
은은한 amber 계열 밑줄로 표시. 저장된 단어(`.saved`)와 겹쳐도 구분되게(밑줄=관용구,
기존 saved 표시는 유지). 예:

```css
.word.idiom{ text-decoration:underline; text-decoration-color:var(--amber); text-decoration-thickness:2px; text-underline-offset:2px; }
```

(정확한 변수/색은 구현 시 팔레트에 맞춰 조정)

## 스킬 변경 (subtitle-to-aligned-json)

- `SKILL.md` 출력 형식·빌드 템플릿에 `idioms` 추가.
- 빌드 스크립트는 `EN[]`/`KO[]`와 나란히 **`IDIOMS[]`** (줄별 관용구 목록, 대부분 `[]`)를
  둔다. 작성자가 변환할 때 관용구를 직접 식별해 채운다.
- 길이 검증: `assert len(EN)==len(KO)==len(IDIOMS)==len(ko_cues)`.
- pairs 생성 시 `"idioms": IDIOMS[i]` 포함. 빈 배열인 줄도 그대로 둔다(또는 생략 가능 —
  앱이 둘 다 허용).

## 기존 샘플 백필 (samples/ 4개)

- **build 스크립트 있는 3개** (`restaurant-order`/`build_restaurant.py`,
  `experiences-part1`/`build_experiences.py`, `asking-living`/`build_meaning.py`):
  각 스크립트에 `IDIOMS[]`를 추가하고 재실행해 `.json` 재생성.
  - 전제: 각 스크립트의 원본 SRT(`KO_SRC`/`EN_SRC`, Downloads 경로)가 존재해야 재실행 가능.
    없으면 그 영상은 `.json`을 직접 편집해 `idioms`만 추가(스크립트는 다음 빌드 때 반영).
- **build 스크립트 없는 1개** (`ariannita-cincinnati`): 빌드 스크립트가 없으므로
  `ariannita-cincinnati.json`을 **직접 편집**해 각 쌍에 `idioms` 추가.

## 영향 범위

| 위치 | 변경 |
|--|--|
| `parseAlignedJson` (~1390) | `idioms` 필드 매핑 추가 |
| `renderTranscript` (~876) | `idiomIdxSet()` 호출 → 토큰 span에 `idiom` 클래스 |
| 신설 | `idiomIdxSet(tokens, idioms)` |
| CSS | `.word.idiom` 스타일 |
| `subtitle-to-aligned-json/SKILL.md` | 출력 형식·템플릿에 `idioms`/`IDIOMS[]`/assert |
| `samples/*/build_*.py` (3개) | `IDIOMS[]` 추가 + 재실행 |
| `samples/ariannita-cincinnati.json` | `idioms` 직접 추가 |

## 엣지 케이스

- 관용구가 줄 안에 없거나 토큰 매칭 실패 → 그 관용구는 그냥 무시(에러 없음).
- 토큰의 구두점은 `cleanTerm`으로 제거 후 매칭 → "ice." 도 "ice"로 매칭.
- 대소문자 무시.
- 관용구가 겹치면 두 구간의 토큰 인덱스 합집합을 하이라이트.
- `idioms`가 없는 기존/raw 영상 → 빈 Set → 하이라이트 없음(정상).

## 테스트 관점

- `idioms` 있는 JSON import → 해당 단어들에 밑줄, 나머지 단어는 그대로.
- 관용구 단어 탭 → 그 단어 하나만 선택(단어장 추가 동작 불변).
- `idioms` 없는 영상 → 하이라이트 0, 콘솔 에러 0.
- 백필한 샘플 4개를 앱에 import → 관용구가 보이는가.
