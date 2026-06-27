# 개선 노트 (Improvement Note) — 설계

날짜: 2026-06-27
대상: `index.html` (Tablo English Lab 앱)

## 배경 / 목표

학습자는 다른 영어 튜터 앱(예: speak 류)에서 대화하다 **"개선할 점 발견 / 수정 제안"** 화면을
자주 본다. 거기엔 *내가 틀린 원문 → 수정 문장 → 한국어 설명*이 들어 있다. 이걸 그냥 보고
넘기지 말고, 그 화면을 **캡처해서 올리면** 앱이:

1. 캡처에서 **내 약점(문법·단어/표현)** 을 뽑아 고를 수 있게 하고,
2. 고른 항목을 **"개선" 탭에 저장**하고(기존 영상 단어장과 분리),
3. 저장된 항목을 **영작 연습 흐름**(한국어 문장 제시 → 영작 → 피드백 → 예문 저장)으로
   반복 연습하게 한다. 단어·문법 **모두** 1문장 또는 여러 문장 드릴(drill)로 연습한다.

핵심 결정:
- **캡처 읽기 = Gemini 비전.** 이미 쓰는 무료 Gemini 키 하나로 이미지에서 텍스트를 읽고
  약점을 추출한다. 별도 OCR·서버 없음. (캡처 1장 ≈ 입력 1.5~2k 토큰, 무료 한도 안에서
  사실상 무제한.)
- **개선 항목 = 같은 `vocab` 저장소 + `source:'capture'`.** 타입은 `word|idiom|slang|grammar`.
  연습 화면을 그대로 재사용하되, **출처로 영상 단어장과 화면을 분리**한다.
- **연습 = AI가 그 항목에 맞는 한국어 문장을 새로 N개 생성.** 캡처 원문을 다시 풀게 하지 않고,
  같은 약점/표현이 적용되는 새 문장들을 만들어 드릴한다. 단어·문법 공통. 문장 수 1/3/5/10 선택.

## 비목표 (YAGNI)

- 캡처 이미지 자체를 저장/동기화하지 않는다. 추출한 텍스트·항목만 저장.
- 약점 마스터리 점수·통계 — 지금은 단어장 카드 + 예문이면 충분.
- 자동 저장 — AI가 뽑은 항목 중 **사용자가 고른 것만** 저장(기존 중복 차단과 일관).
- 캡처 외 텍스트 붙여넣기 입력 — 1차엔 이미지만. (나중에 textarea 폴백 추가 가능.)
- 복습(퀴즈) 기능 자체를 삭제하진 않는다 — **하단 탭만 제거**, `srs` 데이터·코드는 유지(추후 복귀 가능).

## 내비게이션 변경

하단 탭을 **4개**로 재구성한다(기존 5개: 학습·단어장·복습·기록·더보기).

| 탭 | 내용 |
|----|------|
| **학습** | 상단 `[영상 | 단어]` 세그먼트. `영상`=기존 라이브러리/플레이어. `단어`=**기존 영상 단어장**(자막 탭으로 모은 항목, `source!=='capture'`). |
| **개선** (신규) | 상단 `＋ 대화 캡처 올리기` 버튼 + `[단어 | 문법]` 세그먼트. **캡처에서 등록한 항목만**(`source==='capture'`). `단어`=word/idiom/slang, `문법`=grammar. |
| **기록** | 기존 그대로(연속 학습). |
| **더보기** | 기존 설정 그대로. |
| ~~복습~~ | **제거.** |

- 기존 `tabTo()`/`#tabbar`에서 `quiz` 탭 항목 제거, `improve` 탭 추가.
- 단어 화면(`screen-vocab`)을 **학습 탭의 `단어` 뷰**와 **개선 탭의 `단어/문법` 뷰**가 공유하되,
  목록 필터를 `source`로 분기한다(아래 6절).
- 단어·문법 항목 모두 카드 탭 → 같은 연습(드릴) 화면(`screen-detail`).

## 사용자 흐름

1. 하단 **개선** 탭 → `＋ 대화 캡처 올리기` → 캡처 1장 이상 선택.
2. Gemini 비전 분석 → **분석 결과 화면**: 수정(원문→수정문) 미리보기 + "내가 부족한 부분"
   체크 목록(문법/단어/표현, 각각 term·note).
3. 체크 후 `선택 N개 담기` → `source:'capture'` 항목으로 저장(이미 있는 건 제외) → 개선 탭으로.
4. 개선 탭 `단어`/`문법` 세그먼트에서 항목 확인 → 카드 탭 → **연습(드릴) 화면**.
5. 등급·문장 수 선택 → `한국어 문장 N개 받기` → 1문장씩 영작 → 피드백 → (선택) 예문 저장 →
   `다음 문장`. 끝나면 간단 요약.

## 데이터 모델 변경

`vocab` 아이템에 필드를 추가(하위 호환, 기존 항목엔 없으면 `word`/영상 출처로 취급):

```js
{
  id, term, note,                 // 기존
  type: 'grammar',                // 'word'|'idiom'|'slang'|'grammar'  ← 'grammar' 추가
  source: 'capture',              // 'capture' | undefined(=영상 자막)   ← 추가
  sourceLabel: 'Echo 대화',        // 캡처 출처 표기(선택)                 ← 추가
  context: 'Yes, I think he knows about this.',   // 수정문(예문) 재사용
  contextKo: '',
  videoId: undefined, time: undefined, end: undefined,  // 캡처 항목은 영상 없음
  srs:{box:1,dueAt:Date.now(),history:[]}, examples:[], createdAt
}
```

- `source==='capture'` → 개선 탭에만, 그 외 → 학습 탭 `단어` 뷰에만 노출.
- `type:'grammar'` → 청록 `문법` 태그, 카드에 `🎬 영상` 대신 `📷 출처`.
- `time` 없으므로 카드 "보기" 점프는 **시간 없음** 처리(기존 분기 그대로).

## 앱 변경 (index.html)

### 1. Gemini 비전 — `gemini()` 확장

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
  const r=await fetch(/* …+GEMINI_MODEL+':generateContent?key='+… */,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts}],generationConfig:gc})});
  /* …이하 동일… */
}
```

`gemini-2.5-flash`는 비전 입력 지원 → 모델 변경 불필요.

### 2. 이미지 → base64 헬퍼 (+리사이즈)

```js
function fileToVisionPart(file){ /* canvas로 가로 ≤1000px 축소 → image/jpeg 0.85 base64 */ }
```

토큰 절약을 위해 가로 1000px로 줄여 인코딩 → `{mime:'image/jpeg', dataB64}`.

### 3. 캡처 분석 — `analyzeCapture(images)`

```js
const p = `너는 한국어 학습자의 영어 교정 캡처를 분석하는 코치야.
이미지는 영어 튜터 앱의 "개선할 점/수정 제안" 화면이야. JSON으로만 답해:
{
 "corrections":[{"original":"학습자 원문","corrected":"수정문","explainKo":"무엇을 왜 고쳤는지 한국어 한 줄"}],
 "weaknesses":[
   {"type":"grammar|word|idiom","term":"항목 이름(문법은 규칙명, 표현은 표제어형)",
    "note":"한국어 짧은 설명","example":"이 약점이 드러난 수정문"}
 ]
}
같은 항목은 하나로 합치고, 캡처에 없는 내용은 지어내지 마.`;
const obj = JSON.parse(await gemini(p, true, 1500, images));
```

### 4. 개선 탭 + 분석 결과 화면

- **개선 탭(`screen-improve` 또는 vocab 화면 재사용)**: 상단 `＋ 대화 캡처 올리기`(숨은
  `<input type=file accept="image/*" multiple>` 트리거) + `[단어|문법]` 세그먼트 + 카드 그리드.
- **분석 결과(모달 또는 `screen-capture`)**: 캡처 썸네일 + `corrections` 카드(원문 취소선→수정문,
  한국어 설명) + `weaknesses` 체크 목록(기본 전체 체크, 태그+term+note). 이미 있는 term은
  "이미 있음" 비활성.
- `선택 N개 담기` → 각 항목 저장:

```js
{id:uid(), term:w.term, note:w.note||'',
 type:['grammar','word','idiom','slang'].includes(w.type)?w.type:'word',
 source:'capture', sourceLabel:capLabel, context:w.example||'', contextKo:'',
 srs:{box:1,dueAt:Date.now(),history:[]}, examples:[], createdAt:Date.now()}
```

저장 후 개선 탭으로 이동, `logActivity('word', id)`.

### 5. 목록 분기 — `renderVocab`, `vcardEl`, 세그먼트

- 현재 단일 `renderVocab`(`index.html:1016`)에 **컨텍스트 인자**를 둔다: 학습>단어 뷰는
  `source!=='capture'`, 개선 뷰는 `source==='capture'`로 사전 필터.
- 개선 뷰 세그먼트: `단어`=type∈{word,idiom,slang}, `문법`=type==='grammar'.
- `vcardEl`(`index.html:1002`): 태그 맵에 `grammar:'문법'` 추가, CSS
  `.tag.grammar{color:var(--teal-deep);background:var(--teal-soft);}`.
  `source==='capture'`면 `🎬 영상` 줄 대신 `📷 ${sourceLabel||'캡처'}`.

### 6. 연습 드릴 (단어·문법 공통, 다중 문장)

`openVocabDetail`/`vdGenerate`/`vdFeedback`/`vdSaveExample`(`index.html:1455~1504`) 확장.

- **상태 추가:** `vdSet=[]`(생성된 한국어 문장 배열), `vdIdx=0`, `vdCount=1`(기본).
- **개수 선택 UI:** CEFR 칩 옆에 `1 / 3 / 5 / 10` 칩. `1`이면 기존 단일 흐름과 동일.
- **`vdGenerateSet()`** — N문장 생성:

```js
const p=`학습자가 "${v.term}"(${v.note||''})를 연습해. ${v.type==='grammar'?'이건 약점 문법이야.':''}
CEFR ${vdCefr} 수준의 자연스러운 한국어 문장 ${vdCount}개를 만들어줘.
각 문장을 영어로 옮기면 이 ${v.type==='grammar'?'문법':'표현'}을 꼭 쓰게 되도록.
JSON으로만: {"sentences":["...","..."]}`;
vdSet=JSON.parse(await gemini(p,true,1200)).sentences||[];
vdIdx=0; renderDrill();
```

- **`renderDrill()`** — 진행 점(●●○…) + `vdIdx+1 / vdSet.length`, 현재 문장을 `vdKoSentence`로
  세팅하고 영작/피드백/저장 영역 초기화. `건너뛰기`·`다음 문장` 버튼. (`vdCount===1`이면 진행
  표시·다음 버튼 숨김.)
- **`vdFeedback()`** — 기존 그대로. 프롬프트에 `약점/표현: ${v.term}` 한 줄 추가 → 같은 실수면
  짚어주게.
- **`vdNext()`** — `vdIdx++`. 끝이면 요약(맞은 수/저장 예문 수) 후 종료.
- **`vdSaveExample()`** — 기존 그대로(현재 문장 기준).

## 엣지 케이스

- **키 없음** → `aiErr`로 설정 안내(기존 재사용).
- **분석 JSON 깨짐** → `try/catch` 후 "다시 시도" 안내, 부분 파싱 시도.
- **약점 없음**(완벽한 문장) → `weaknesses` 빈 배열 → "고칠 점이 없네요 👍" 빈 상태.
- **중복** → 저장 시 `termInVocab`로 제외(단, 영상 단어장과 개선은 별개로 보고 싶으면 source까지
  비교 — 1차는 term 동일하면 제외).
- **여러 장 업로드** → `images` 배열로 한 요청에 전송(프롬프트 토큰 1회분).
- **동기화** — `vocab`은 이미 동기화 대상. 새 필드(type/source/sourceLabel)도 함께 동기화됨.
- **복습 탭 제거** → 기존 `badgeQuiz`/`quiz` 진입만 숨김, SRS 데이터 보존.

## 테스트 (수동)

1. 무료 키 설정 → 개선 탭 → `캡처 올리기` → 예시 캡처 2장 → 약점/단어 추출 확인.
2. 일부 체크 → 개선 탭 `문법`/`단어` 세그먼트에 `📷 출처`로 저장, 학습>단어엔 안 보임 확인.
3. 같은 캡처 재업로드 → 중복은 "이미 있음" 처리.
4. 항목 탭 → 문장 수 5 선택 → 5문장 받기 → 점·진행 표시, 영작→피드백→예문 저장→다음 문장.
5. 문장 수 1 → 기존 단일 흐름과 동일(진행 표시 없음).
6. 학습 탭 `[영상|단어]` 전환 정상, 기존 영상 단어장 그대로.
7. 하단 탭 4개(학습·개선·기록·더보기), 복습 사라짐, 기록·더보기 정상.
8. 키 제거 → 안내 토스트. JSON 깨짐 모의 → 재시도 안내.
