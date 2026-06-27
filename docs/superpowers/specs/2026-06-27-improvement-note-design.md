# 개선 노트 (Improvement Note) — 설계

날짜: 2026-06-27
대상: `index.html` (Tablo English Lab 앱)

## 배경 / 목표

학습자는 다른 영어 튜터 앱(예: speak 류)에서 대화하다 **"개선할 점 발견 / 수정 제안"** 화면을
자주 본다. 거기엔 *내가 틀린 원문 → 수정 문장 → 한국어 설명*이 들어 있다. 이걸 그냥 보고
넘기지 말고, 그 화면을 **캡처해서 올리면** 앱이:

1. 캡처에서 **내 약점(문법·표현)** 을 뽑아 고를 수 있게 하고,
2. 고른 항목을 **단어장에 "내 약점"으로 저장**하고,
3. 저장된 약점을 **기존 영작 연습 흐름**(한국어 문장 제시 → 영작 → 피드백 → 예문 저장)으로
   반복 연습하게 한다. 단, 약점은 **문장을 여러 개** 받아 드릴(drill)처럼 연습한다.

핵심 결정:
- **캡처 읽기 = Gemini 비전.** 이미 쓰는 무료 Gemini 키 하나로 이미지에서 텍스트를 읽고
  약점을 추출한다. 별도 OCR·서버 없음. (캡처 1장 ≈ 입력 1.5~2k 토큰, 무료 한도 안에서
  사실상 무제한.)
- **약점 = 단어장의 새 타입 `grammar`.** 단어/관용구/슬랭과 같은 저장소(`vocab`)에 넣되
  `type:'grammar'`, 출처 `source:'capture'`로 구분한다. 연습 화면을 그대로 재사용하기 위함.
- **연습 = AI가 약점에 맞는 한국어 문장을 새로 N개 생성.** 캡처 원문을 다시 풀게 하지 않고,
  같은 약점이 적용되는 새 문장들을 만들어 드릴한다.

## 비목표 (YAGNI)

- 캡처 이미지 자체를 저장/동기화하지 않는다. 추출한 텍스트·약점만 저장.
- 약점에 대한 별도 통계/마스터리 점수 — 지금은 단어장 카드 + 예문이면 충분.
- 자동 분류·자동 저장 — AI가 뽑은 항목 중 **사용자가 고른 것만** 저장(기존 중복 차단과 일관).
- 캡처 외 텍스트 붙여넣기 입력 — 1차엔 이미지만. (나중에 textarea 폴백 추가 가능.)

## 사용자 흐름

1. **단어장** 화면 상단(또는 학습 탭)에서 `＋ 개선 노트` → 캡처 1장 이상 선택.
2. Gemini 비전이 분석 → **분석 결과 화면**: 수정(원문→수정문) 미리보기 + "내가 부족한 부분"
   체크 목록(문법/표현 항목, 각각 term·note 포함).
3. 체크 후 `선택 N개 단어장에 담기` → `type:'grammar'` 항목으로 저장(이미 있는 건 제외).
4. 단어장에 `문법` 태그로 표시. 카드 탭 → **연습(드릴) 화면**.
5. 등급·문장 수 선택 → `한국어 문장 N개 받기` → 1문장씩 영작 → 피드백 → (선택) 예문 저장 →
   `다음 문장`. 끝나면 간단 요약.

## 데이터 모델 변경

`vocab` 아이템에 필드 2개를 추가(기존과 하위 호환, 기존 항목엔 없으면 word로 취급):

```js
{
  id, term, note,                 // 기존
  type: 'grammar',                // 'word'|'idiom'|'slang'|'grammar'  ← 추가 값
  source: 'capture',              // 'capture' | undefined(=자막)       ← 추가 필드
  sourceLabel: 'Echo 대화',        // 캡처 출처 표기용(선택)              ← 추가 필드
  context: 'Yes, I think he knows about this.',   // 수정문(예문) 재사용
  contextKo: '응, 그는 이걸 아는 것 같아.',
  videoId: undefined, time: undefined, end: undefined,  // 캡처 항목은 영상 없음
  srs:{box:1,dueAt:Date.now(),history:[]}, examples:[], createdAt
}
```

- `type:'grammar'`이면 카드에 청록 `문법` 태그, `🎬 영상` 줄 대신 `📷 출처` 줄을 보인다.
- `time` 없으므로 `vcardEl`의 "보기" 점프는 **시간 없음** 처리(기존 분기 그대로 동작).

## 앱 변경 (index.html)

### 1. Gemini 비전 호출 — `gemini()` 확장

현재 `gemini(prompt,json,maxTokens)`는 텍스트 파트만 보낸다(`index.html:1294`). 이미지 파트를
실을 수 있게 시그니처를 넓힌다(기존 호출 100% 호환):

```js
async function gemini(prompt,json,maxTokens,images){   // images: [{mime, dataB64}] (선택)
  if(!GEMINI_KEY)throw new Error('NO_KEY');
  const gc={temperature:0.7,maxOutputTokens:maxTokens||600};
  if(json)gc.responseMimeType='application/json';
  const parts=[{text:prompt}];
  if(images&&images.length)for(const im of images)
    parts.push({inlineData:{mimeType:im.mime,data:im.dataB64}});
  const r=await fetch(...＋GEMINI_MODEL＋':generateContent?key='＋...,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts}],generationConfig:gc})});
  ...  // 이하 동일
}
```

`gemini-2.5-flash`는 비전 입력을 지원하므로 모델 변경 불필요.

### 2. 이미지 → base64 헬퍼 + (선택) 리사이즈

```js
function fileToVisionPart(file){ /* canvas로 가로 ≤1000px 축소 → image/jpeg base64 */ }
```

토큰 절약을 위해 가로 1000px로 줄여 jpeg 0.85로 인코딩. 결과 `{mime:'image/jpeg', dataB64}`.

### 3. 캡처 분석 — `analyzeCapture(images)`

```js
const p = `너는 한국어 학습자의 영어 교정 캡처를 분석하는 코치야.
이미지는 영어 튜터 앱의 "개선할 점/수정 제안" 화면이야.
다음을 JSON으로만 답해:
{
 "corrections":[{"original":"학습자 원문","corrected":"수정문","explainKo":"무엇을 왜 고쳤는지 한국어 한 줄"}],
 "weaknesses":[
   {"type":"grammar|word|idiom","term":"약점 이름(문법은 규칙명, 표현은 표제어형)",
    "note":"한국어 짧은 설명","example":"이 약점이 드러난 수정문"}
 ]
}
같은 약점은 하나로 합치고, 캡처에 없는 내용은 지어내지 마.`;
const obj = JSON.parse(await gemini(p, true, 1500, images));
```

→ 분석 결과 화면에 `corrections`(미리보기)와 `weaknesses`(체크 목록)를 렌더.

### 4. 분석 결과 화면 (신규 `screen-capture`)

- 캡처 썸네일 + `corrections` 카드(원문 취소선 → 수정문, 한국어 설명).
- `weaknesses` 체크 목록(기본 전체 체크). 각 항목: 태그(문법/표현) + term + note.
- 이미 단어장에 있는 term은 비활성("이미 있음") 표시.
- `선택 N개 단어장에 담기` → 각 항목을 아래 형태로 저장:

```js
{id:uid(), term:w.term, note:w.note||'', type:w.type==='grammar'?'grammar':w.type,
 source:'capture', sourceLabel:capLabel, context:w.example||'', contextKo:'',
 srs:{box:1,dueAt:Date.now(),history:[]}, examples:[], createdAt:Date.now()}
```

저장 후 단어장으로 이동, `logActivity('word', id)`.

### 5. 진입점

- 단어장 상단 `filterbar` 옆 또는 topbar에 `＋ 개선 노트` 버튼(숨은 `<input type=file accept="image/*" multiple>` 트리거).
- 학습 탭에서도 접근 가능하면 좋지만 1차는 단어장 한 곳.

### 6. 단어장 표시 — `vcardEl`, 필터

- 태그 매핑에 `grammar:'문법'` 추가, CSS `.tag.grammar{color:var(--teal-deep);background:var(--teal-soft);}`
  (관용구와 구분되게 살짝 다른 톤 또는 아이콘 📷).
- `source==='capture'`이면 `🎬 영상` 줄 대신 `📷 ${sourceLabel||'캡처'}`.
- 필터 탭에 `['grammar','문법']` 추가.

### 7. 연습 화면 = 드릴 (다중 문장)

`openVocabDetail`/`vdGenerate`/`vdFeedback`/`vdSaveExample`(`index.html:1455~1504`)을 확장.

- **상태 추가:** `vdSet=[]`(생성된 한국어 문장 배열), `vdIdx=0`, `vdCount=5`.
- **개수 선택 UI:** CEFR 칩 옆에 `3 / 5 / 10` 칩.
- **`vdGenerateSet()`** — 1문장 대신 N문장 생성:

```js
const p=`학습자가 약점 "${v.term}"(${v.note||''})를 연습해.
CEFR ${vdCefr} 수준의 자연스러운 한국어 문장 ${vdCount}개를 만들어줘.
각 문장을 영어로 옮기면 이 약점/표현을 꼭 쓰게 되도록.
JSON으로만: {"sentences":["...","..."]}`;
vdSet=JSON.parse(await gemini(p,true,1200)).sentences||[];
vdIdx=0; renderDrill();
```

- **`renderDrill()`** — 진행 점(●●○…) + `vdIdx+1 / vdSet.length`, 현재 문장을 `vdKoSentence`로
  세팅하고 영작/피드백/저장 영역 초기화. `건너뛰기`·`다음 문장` 버튼.
- **`vdFeedback()`** — 기존 그대로(현재 `vdKoSentence` 기준). 약점을 의식한 평가가 되도록
  프롬프트에 `약점: ${v.term}` 한 줄 추가, 같은 실수면 짚어주게.
- **`vdNext()`** — `vdIdx++`. 끝이면 요약(맞은 수/저장 예문 수) 표시 후 종료 버튼.
- **`vdSaveExample()`** — 기존 그대로(현재 문장 기준으로 예문 저장).

단어 타입(word/idiom/slang) 항목은 **기존 단일 문장 흐름 그대로** 두거나, 같은 드릴 UI에서
`vdCount=1` 기본으로 동작해도 무방. 1차는 **grammar 타입일 때만 개수 선택 노출**, 나머지는
기존과 동일하게 1문장.

## 엣지 케이스

- **키 없음** → `aiErr`로 설정 안내(기존 동작 재사용).
- **분석 JSON 깨짐** → `try/catch` 후 "다시 시도" 안내, 부분 파싱 시도.
- **캡처에 약점이 없음**(완벽한 문장) → `weaknesses` 빈 배열 → "고칠 점이 없네요 👍" 빈 상태.
- **중복 약점** → 저장 시 `termInVocab`로 제외(기존 헬퍼).
- **여러 장 업로드** → `images` 배열로 한 요청에 전송(프롬프트 1회분만 토큰).
- **동기화** — `vocab`은 이미 동기화 대상. 새 필드(type/source)는 그대로 함께 동기화됨.

## 테스트 (수동)

1. 무료 키 설정 → `개선 노트` → 예시 캡처 2장 업로드 → 약점 3개 추출 확인.
2. 2개 체크 → 단어장에 `문법` 태그 + `📷 출처`로 저장, 1개는 미저장 확인.
3. 같은 캡처 재업로드 → 중복 약점은 "이미 있음" 처리.
4. 약점 카드 탭 → 5문장 받기 → 점/진행 표시, 영작→피드백→예문 저장→다음 문장 동작.
5. 드릴 끝 → 요약. 단어장 카드에 예문 수 증가 확인.
6. 키 제거 → 안내 토스트. JSON 깨짐 모의 → 재시도 안내.
