# 개선 노트 (Improvement Note) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 튜터 앱의 "개선할 점" 대화 캡처를 Gemini 비전으로 읽어 내 약점(문법·단어)을 뽑아 "개선" 탭에 저장하고, 단어·문법 모두 1문장/여러 문장 드릴로 연습한다.

**Architecture:** 캡처는 무료 Gemini 키 하나로 비전 입력(`gemini()`에 이미지 파트 추가)해 `{corrections, weaknesses}` JSON을 받는다. 추출 항목은 기존 `vocab` 저장소에 `source:'capture'`로 넣어 **영상 단어장과 화면을 분리**한다. 하단 탭을 4개(학습·개선·기록·더보기)로 재구성: 학습 탭은 `[영상|단어]` 세그먼트(기존 단어장), 개선 탭은 캡처 진입 + `[단어|문법]` 세그먼트. 연습 화면(`screen-detail`)은 문장 수(1/3/5/10) 드릴로 확장하며 단어·문법 공통으로 동작한다.

**Tech Stack:** 바닐라 JS + IndexedDB + YouTube IFrame + 무료 Gemini API(단일 `index.html`). 테스트 러너 없음 → `preview_*` 브라우저 도구 + `preview_eval`로 검증(외부 AI 호출은 `window.gemini` 스텁으로 대체).

## Global Constraints

- 모든 변경은 `C:\Users\pponi13468\Desktop\박미정\podcast\index.html` 한 파일.
- 기존 `gemini(prompt,json,maxTokens)` 호출부는 **시그니처 호환** 유지(이미지 인자는 선택 4번째).
- 캡처 추출 항목은 `source:'capture'`, 영상 단어장 항목은 `source` 없음 — **두 화면 완전 분리**.
- 캡처 이미지 자체는 저장하지 않는다(추출 텍스트만).
- 복습(퀴즈) 기능은 **하단 탭만 제거**, `srs`/`renderQuiz`/`screen-quiz` 코드·데이터는 보존.
- 단어 탭으로 모은 기존 단어장 동작(자막 탭→추가, 영상별 보기)은 깨지지 않아야 함.
- 색/폰트는 기존 토큰(`--amber`, `--teal-deep`, Fraunces/Inter) 사용. 이모지 아이콘은 기존 앱 관례 따름.
- 배포: `master` push → Netlify 자동 배포(푸시는 사용자 승인 시에만).

---

### Task 1: vcard — 문법 태그 + 캡처 출처 표시

**Files:**
- Modify: `index.html` — `vcardEl`(~1002-1015), CSS(`.tag.slang` 줄 다음 ~139)

**Interfaces:**
- Produces: `vcardEl(v)`가 `v.type==='grammar'`면 `문법` 태그, `v.source==='capture'`면 `📷 출처` 줄을 렌더. `.tag.grammar`, `.seg2` CSS.

- [ ] **Step 1: CSS 추가 (`.tag.slang{...}` 다음 줄)**

`index.html`에서 `.tag.slang{color:#7a3d86;background:#f0e6f2;}` 다음에 추가:

```css
  .tag.grammar{color:var(--teal-deep);background:#dfeee9;}
  .seg2{display:flex;background:#efe9da;border-radius:10px;padding:3px;gap:3px;margin:0 14px 12px;}
  .seg2 span{flex:1;text-align:center;font-size:12.5px;font-weight:600;color:var(--ink-soft);padding:7px 0;border-radius:8px;cursor:pointer;}
  .seg2 span.on{background:#fff;color:var(--amber-deep);}
  .capw{display:flex;align-items:center;gap:9px;border:1px solid var(--paper-line);background:#fff;border-radius:11px;padding:9px 11px;margin-top:8px;cursor:pointer;}
  .capw.on{border-color:var(--amber);background:var(--amber-soft);}
  .capw .capck{width:20px;height:20px;border-radius:6px;border:1.5px solid #cdbfa6;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;}
  .capw.on .capck{background:var(--amber);border-color:var(--amber);}
  .ddot{width:8px;height:8px;border-radius:50%;background:var(--paper-line);display:inline-block;margin-right:5px;}
  .ddot.done{background:var(--teal);}
  .ddot.cur{background:var(--amber);box-shadow:0 0 0 3px var(--amber-soft);}
  .dprog{font-size:12px;font-weight:600;color:var(--ink-soft);margin-right:9px;}
```

- [ ] **Step 2: `vcardEl`에서 문법 태그 + 출처 분기**

`index.html`의 `vcardEl`(~1002-1015) 안에서 두 줄을 교체한다.

먼저 태그 매핑 줄:
```js
  const tcls=['word','idiom','slang'].includes(v.type)?v.type:'word';const tlab={word:'단어',idiom:'관용구',slang:'슬랭'}[tcls];
```
→ 다음으로 교체:
```js
  const tcls=['word','idiom','slang','grammar'].includes(v.type)?v.type:'word';const tlab={word:'단어',idiom:'관용구',slang:'슬랭',grammar:'문법'}[tcls];
```

그리고 영상 출처 줄:
```js
  const vidLine=showVid?`<div class="vsrc" data-vid="${esc(v.videoId||'')}" title="${esc(vtitle)}">🎬 ${esc(vtitle)}</div>`:'';
```
→ 다음으로 교체(캡처 출처 우선):
```js
  const vidLine=v.source==='capture'?`<div class="vsrc" style="color:var(--teal-deep);">📷 ${esc(v.sourceLabel||'캡처')}</div>`:(showVid?`<div class="vsrc" data-vid="${esc(v.videoId||'')}" title="${esc(vtitle)}">🎬 ${esc(vtitle)}</div>`:'');
```

- [ ] **Step 3: 검증 (브라우저)**

`preview_start`(static) 후 `preview_eval`:

```js
(()=>{const a=vcardEl({id:'g1',term:'주어-동사 수일치',note:'-s',type:'grammar',source:'capture',sourceLabel:'Echo 대화',createdAt:1},false);
 const b=vcardEl({id:'w1',term:'wrap up',note:'끝내다',type:'idiom',videoId:'x',createdAt:1},true);
 return {grammarTag:a.querySelector('.tag').textContent, grammarTagClass:a.querySelector('.tag').className,
   capSrc:a.querySelector('.vsrc').textContent.trim(), wordTag:b.querySelector('.tag').textContent};})()
```

Expected: `grammarTag:"문법"`, `grammarTagClass` 에 `grammar` 포함, `capSrc` 가 `📷 Echo 대화`, `wordTag:"관용구"`. `preview_console_logs`(error) 비어 있음.

- [ ] **Step 4: 커밋**

```bash
printf 'feat(improve): grammar tag + capture source on vocab cards' > .git/COMMIT_MSG_TMP.txt
git add index.html && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

### Task 2: Gemini 비전 — `gemini()` 확장 + 이미지 헬퍼

**Files:**
- Modify: `index.html` — `gemini`(~1294-1304); 새 헬퍼는 `gemini` 함수 바로 위에 추가

**Interfaces:**
- Consumes: 기존 `GEMINI_KEY`, `GEMINI_MODEL`.
- Produces:
  - `gemini(prompt, json, maxTokens, images)` — `images`는 `[{mime, dataB64}]`(선택). 누락 시 기존과 동일.
  - `fileToVisionPart(file) -> Promise<{mime:'image/jpeg', dataB64:string}>` — 가로 ≤1000px 축소 jpeg.

- [ ] **Step 1: `fileToVisionPart` 헬퍼 추가 (`async function gemini` 줄 바로 위)**

```js
function fileToVisionPart(file){return new Promise((res,rej)=>{
  const img=new Image();const url=URL.createObjectURL(file);
  img.onload=()=>{const max=1000;let{width:w,height:h}=img;
    if(w>max){h=Math.round(h*max/w);w=max;}
    const c=document.createElement('canvas');c.width=w;c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    URL.revokeObjectURL(url);
    const d=c.toDataURL('image/jpeg',0.85);            // "data:image/jpeg;base64,XXXX"
    res({mime:'image/jpeg',dataB64:d.slice(d.indexOf(',')+1)});};
  img.onerror=e=>{URL.revokeObjectURL(url);rej(new Error('이미지를 읽지 못했어요'));};
  img.src=url;});}
```

- [ ] **Step 2: `gemini`에 이미지 파트 지원**

`gemini` 함수(~1294-1304)를 다음으로 교체:

```js
async function gemini(prompt,json,maxTokens,images){
  if(!GEMINI_KEY)throw new Error('NO_KEY');
  const gc={temperature:0.7,maxOutputTokens:maxTokens||600};
  if(json)gc.responseMimeType='application/json';
  const parts=[{text:prompt}];
  if(images&&images.length)for(const im of images)parts.push({inlineData:{mimeType:im.mime,data:im.dataB64}});
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent?key='+encodeURIComponent(GEMINI_KEY),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts}],generationConfig:gc})});
  if(!r.ok){const t=await r.text();throw new Error(r.status+' '+t.slice(0,140));}
  const j=await r.json();
  return (j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts[0].text||'').trim();
}
```

- [ ] **Step 3: 검증 — 요청 본문에 이미지 파트가 실리는지 (fetch 스텁)**

`preview_eval`로 `fetch`를 가로채 본문을 검사:

```js
(async()=>{const origFetch=window.fetch,origKey=GEMINI_KEY;GEMINI_KEY='TESTKEY';let body=null;
 window.fetch=(u,o)=>{body=JSON.parse(o.body);return Promise.resolve({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'ok'}]}}]})});};
 await gemini('hi');const textOnly=JSON.stringify(body.contents[0].parts);
 await gemini('look',false,500,[{mime:'image/jpeg',dataB64:'AAAA'}]);const withImg=body.contents[0].parts;
 window.fetch=origFetch;GEMINI_KEY=origKey;
 return {textOnlyParts:textOnly, imgPartHasInlineData:!!(withImg[1]&&withImg[1].inlineData&&withImg[1].inlineData.data==='AAAA')};})()
```

Expected: `textOnlyParts` 는 `[{"text":"hi"}]` (이미지 없을 때 파트 1개), `imgPartHasInlineData:true`.

- [ ] **Step 4: 검증 — `fileToVisionPart` 축소/인코딩**

```js
(async()=>{const c=document.createElement('canvas');c.width=2000;c.height=1000;c.getContext('2d').fillRect(0,0,2000,1000);
 const blob=await new Promise(r=>c.toBlob(r,'image/png'));
 const part=await fileToVisionPart(new File([blob],'t.png',{type:'image/png'}));
 const probe=new Image();const ok=await new Promise(r=>{probe.onload=()=>r({w:probe.width,h:probe.height});probe.src='data:image/jpeg;base64,'+part.dataB64;});
 return {mime:part.mime, b64NonEmpty:part.dataB64.length>100, width:ok.w, height:ok.h};})()
```

Expected: `mime:'image/jpeg'`, `b64NonEmpty:true`, `width:1000`, `height:500`(2:1 비율 유지, 가로 1000으로 축소).

- [ ] **Step 5: 커밋**

```bash
printf 'feat(improve): gemini vision support + image resize helper' > .git/COMMIT_MSG_TMP.txt
git add index.html && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

### Task 3: 내비게이션 재구성 + 단어/개선 뷰 분리

**Files:**
- Modify: `index.html` — `#tabbar`(~359-365), `screen-library`(~211-219), 새 `screen-improve`(`screen-library` 다음에 삽입), `tabTo`(~735-741), `updateBadges`(~1095-1099), `backFromDetail`(~1467), `openVocabDetail`(~1456), `addSelectionToVocab`(~998)·`saveMeaning`(~1046)·`cycleTag`(~1047)·`delVocab`(~1048)의 `renderVocab()` 호출, `vdSaveExample`(~1503)·`renderExamples` 핸들러(~1507)의 `renderVocab()` 호출

**Interfaces:**
- Consumes: Task 1의 `vcardEl`, `.seg2` CSS.
- Produces:
  - 하단 탭: `learn / improve / streak / settings`.
  - `renderLearnVocab()` — 학습 탭 `단어` 뷰(`source!=='capture'`), `#learnVgrid`.
  - `renderImproveVocab()` — 개선 탭(`source==='capture'`, `improveSeg` 기준), `#improveVgrid`.
  - `bindVocabGrid(grid, origin)` — 카드 클릭 핸들러 바인딩.
  - `refreshVocabViews()` — 활성 단어 뷰 재렌더.
  - `learnSegTo(v)`, `improveSegTo(v)`, `setLearnVFilter(k)`.
  - `openVocabDetail(id, origin)` — `origin` 저장(`'learn'|'improve'`).

- [ ] **Step 1: 탭바 교체 (`#tabbar` ~359-365)**

`vocab`·`quiz` 탭을 제거하고 `improve` 탭을 추가. `#tabbar` 안쪽 5줄을 다음 4줄로 교체:

```html
  <div class="tab active" data-s="learn" onclick="tabTo('learn')"><div class="ico">▶</div><div class="lab">학습</div></div>
  <div class="tab" data-s="improve" onclick="tabTo('improve')"><div class="ico">✦</div><div class="lab">개선</div></div>
  <div class="tab" data-s="streak" onclick="tabTo('streak')"><div class="ico">🔥</div><div class="lab">기록</div><span class="badge a hide" id="badgeStreak"></span></div>
  <div class="tab" data-s="settings" onclick="tabTo('settings')"><div class="ico">⚙</div><div class="lab">더보기</div></div>
```

- [ ] **Step 2: 학습 화면에 `[영상|단어]` 세그먼트 + 단어 그리드 (`screen-library` ~211-219)**

`screen-library` 섹션 본문(topbar 다음의 `resumeRow`+`libList`)을 다음으로 교체:

```html
    <div class="seg2" id="learnSeg">
      <span class="on" data-v="videos" onclick="learnSegTo('videos')">영상</span>
      <span data-v="words" onclick="learnSegTo('words')">단어</span>
    </div>
    <div id="learnVideos">
      <div id="resumeRow" style="display:none;"></div>
      <div id="libList"></div>
    </div>
    <div id="learnWords" style="display:none;">
      <div class="filterbar" id="learnVfilter"></div>
      <div class="vgrid" id="learnVgrid"></div>
      <div class="empty" id="learnVEmpty" style="display:none;">아직 영상에서 담은 단어가 없어요. 자막에서 단어를 탭해 담아보세요.</div>
    </div>
```

- [ ] **Step 3: 개선 화면 신설 (`screen-library` 섹션 닫는 `</section>` 바로 다음에 삽입)**

```html
  <!-- ===== IMPROVE (개선 노트) ===== -->
  <section id="screen-improve" class="screen">
    <div class="topbar"><div class="grow"><div class="eyebrow">Improvement</div><h1 class="serif">개선 노트</h1></div></div>
    <div style="padding:0 14px 4px;">
      <button class="secondary" style="width:100%;" onclick="document.getElementById('capInput').click()">＋ 대화 캡처 올리기</button>
      <input type="file" id="capInput" accept="image/*" multiple style="display:none;">
      <div style="font-size:11px;color:var(--ink-soft);margin-top:6px;line-height:1.5;">튜터 앱의 “개선할 점” 화면을 캡처해 올리면 내 약점을 뽑아줘요.</div>
    </div>
    <div id="capResult" style="padding:0 14px;"></div>
    <div class="seg2" id="improveSeg" style="margin-top:12px;">
      <span class="on" data-v="word" onclick="improveSegTo('word')">단어</span>
      <span data-v="grammar" onclick="improveSegTo('grammar')">문법</span>
    </div>
    <div class="vgrid" id="improveVgrid"></div>
    <div class="empty" id="improveVEmpty" style="display:none;">캡처를 올려 약점을 담아보세요.</div>
  </section>
```

- [ ] **Step 4: `tabTo` 분기 교체 (~735-741)**

```js
function tabTo(s){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.s===s));clearSelection();
  pausePlayer();
  if(s==='learn'){showScreen('library');learnSeg==='words'?renderLearnVocab():renderLibrary();}
  else if(s==='improve'){showScreen('improve');renderImproveVocab();}
  else if(s==='streak'){showScreen('streak');renderStreak();}
  else if(s==='settings'){showScreen('settings');renderSettings();}}
```

- [ ] **Step 5: 단어 뷰 렌더 함수 추가 (`function setVFilter` ~1043 직전에 삽입)**

```js
let learnSeg='videos', learnVFilter='all', improveSeg='word';
function bindVocabGrid(grid,origin){
  grid.querySelectorAll('.vsrc').forEach(s=>s.onclick=()=>{if(s.dataset.vid&&videos.some(x=>x.id===s.dataset.vid))openVideo(s.dataset.vid);});
  grid.querySelectorAll('.vterm').forEach(t=>t.onclick=()=>openVocabDetail(t.dataset.id,origin));
  grid.querySelectorAll('.note').forEach(n=>n.onclick=()=>editNote(n.dataset.id));
  grid.querySelectorAll('.jump').forEach(j=>j.onclick=()=>jumpToVocab(j.dataset.id));
  grid.querySelectorAll('.del').forEach(d=>d.onclick=()=>delVocab(d.dataset.id));}
function renderLearnVocab(){
  const grid=document.getElementById('learnVgrid'),empty=document.getElementById('learnVEmpty'),fb=document.getElementById('learnVfilter');
  const tags=[['all','전체'],['word','단어'],['idiom','관용구'],['slang','슬랭']];
  fb.innerHTML=tags.map(([k,l])=>`<span class="chip ${learnVFilter===k?'on':''}" onclick="setLearnVFilter('${k}')">${l}</span>`).join('');
  let list=vocab.filter(v=>v.source!=='capture').sort((a,b)=>b.createdAt-a.createdAt);
  if(learnVFilter!=='all')list=list.filter(v=>v.type===learnVFilter);
  empty.style.display=list.length?'none':'block';grid.innerHTML='';
  list.forEach(v=>grid.appendChild(vcardEl(v,true)));bindVocabGrid(grid,'learn');}
function setLearnVFilter(k){learnVFilter=k;renderLearnVocab();}
function learnSegTo(v){learnSeg=v;
  document.querySelectorAll('#learnSeg span').forEach(s=>s.classList.toggle('on',s.dataset.v===v));
  document.getElementById('learnVideos').style.display=v==='videos'?'':'none';
  document.getElementById('learnWords').style.display=v==='words'?'':'none';
  v==='words'?renderLearnVocab():renderLibrary();}
function renderImproveVocab(){
  const grid=document.getElementById('improveVgrid'),empty=document.getElementById('improveVEmpty');
  let list=vocab.filter(v=>v.source==='capture').sort((a,b)=>b.createdAt-a.createdAt);
  list=list.filter(v=>improveSeg==='grammar'?v.type==='grammar':v.type!=='grammar');
  empty.style.display=list.length?'none':'block';grid.innerHTML='';
  list.forEach(v=>grid.appendChild(vcardEl(v,false)));bindVocabGrid(grid,'improve');}
function improveSegTo(v){improveSeg=v;
  document.querySelectorAll('#improveSeg span').forEach(s=>s.classList.toggle('on',s.dataset.v===v));
  renderImproveVocab();}
function refreshVocabViews(){
  if(document.getElementById('screen-library').classList.contains('active')&&learnSeg==='words')renderLearnVocab();
  if(document.getElementById('screen-improve').classList.contains('active'))renderImproveVocab();}
```

- [ ] **Step 6: 기존 `renderVocab()` 호출을 `refreshVocabViews()`로 교체**

다음 위치의 `renderVocab()` 를 모두 `refreshVocabViews()` 로 바꾼다(파일 내 정확히 이 호출들):
- `addSelectionToVocab` 끝부분(~998): `if(document.getElementById('screen-vocab')...renderVocab();}` 줄을 다음으로 교체:
  ```js
  refreshVocabViews();}
  ```
- `saveMeaning`(~1046): `...await idbPut('vocab',v);renderVocab();}` → `renderVocab()`만 `refreshVocabViews()`로.
- `cycleTag`(~1047): 끝의 `renderVocab();}` → `refreshVocabViews();}`.
- `delVocab`(~1048): `...vocab=vocab.filter(...);renderVocab();updateBadges();...` 의 `renderVocab()` → `refreshVocabViews()`.
- `vdSaveExample`(~1503): `...renderExamples(v);renderVocab();toast(...)` 의 `renderVocab()` → `refreshVocabViews()`.
- `renderExamples` 삭제 핸들러(~1507): `...renderExamples(v);renderVocab();});` 의 `renderVocab()` → `refreshVocabViews()`.

(주: 구버전 `renderVocab`/`setVFilter`/`toggleVByVideo` 함수 정의 자체는 남겨둬도 무방 — 더 이상 호출되지 않음. `screen-vocab` 마크업도 그대로 두되 탭에서 진입 불가.)

- [ ] **Step 7: `updateBadges`에서 제거된 배지 참조 정리 (~1095-1099)**

`badgeVocab`/`badgeQuiz` 요소가 사라졌으므로 교체:

```js
function updateBadges(){const st=calcStreak(),bs=document.getElementById('badgeStreak');if(bs){bs.textContent=st;bs.classList.toggle('hide',!st);}}
```

- [ ] **Step 8: `openVocabDetail`에 origin + `backFromDetail` 복귀 분기**

`openVocabDetail`(~1456) 시그니처와 첫 줄 교체:

```js
function openVocabDetail(id,origin){const v=vocab.find(x=>x.id===id);if(!v)return;vdOrigin=origin||'learn';
```

`backFromDetail`(~1467) 교체:

```js
function backFromDetail(){voiceOn=false;if(recog){try{recog.stop();}catch(e){}recog=null;}
  if(vdOrigin==='improve'){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.s==='improve'));showScreen('improve');renderImproveVocab();}
  else{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.s==='learn'));showScreen('library');renderLearnVocab();}}
```

그리고 `let vdId=null` 가 있는 상태 줄(~1455)에 `vdOrigin` 추가: 줄 끝에 `, vdOrigin='learn'` 를 더한다.

- [ ] **Step 9: 검증 (브라우저)**

`preview_eval`로 탭/세그먼트/필터 분리 확인(임시 vocab 주입):

```js
(async()=>{const log=[];
 vocab=[{id:'a',term:'wrap up',type:'idiom',note:'끝내다',videoId:'x',createdAt:3},
        {id:'b',term:'주어-동사 수일치',type:'grammar',source:'capture',sourceLabel:'cap',note:'-s',createdAt:2},
        {id:'c',term:'be in a position',type:'word',source:'capture',sourceLabel:'cap',note:'',createdAt:1}];
 tabTo('improve');improveSegTo('grammar');const g=[...document.querySelectorAll('#improveVgrid .term')].map(t=>t.textContent.trim().split(' ✎')[0]);
 improveSegTo('word');const w=[...document.querySelectorAll('#improveVgrid .term')].map(t=>t.textContent.trim().split(' ✎')[0]);
 tabTo('learn');learnSegTo('words');const lw=[...document.querySelectorAll('#learnVgrid .term')].map(t=>t.textContent.trim().split(' ✎')[0]);
 const tabCount=document.querySelectorAll('#tabbar .tab').length;
 return {tabCount, improveGrammar:g, improveWord:w, learnWords:lw};})()
```

Expected: `tabCount:4`, `improveGrammar:["주어-동사 수일치"]`, `improveWord:["be in a position"]`, `learnWords:["wrap up"]`(캡처 항목은 학습 단어 뷰에 안 보임). `preview_console_logs`(error) 비어 있음.

- [ ] **Step 10: 커밋**

```bash
printf 'feat(improve): 4-tab nav, split video/capture vocab views' > .git/COMMIT_MSG_TMP.txt
git add index.html && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

### Task 4: 캡처 분석 → 결과 → 저장

**Files:**
- Modify: `index.html` — 새 함수들을 `renderImproveVocab` 정의 다음에 추가; `capInput` change 바인딩을 init부에 추가(아래 Step 4)

**Interfaces:**
- Consumes: Task 2 `gemini(...,images)`/`fileToVisionPart`, Task 3 `renderImproveVocab`/`improveSegTo`, 기존 `termInVocab`/`uid`/`idbPut`/`logActivity`/`aiErr`/`esc`/`toast`.
- Produces:
  - `analyzeCapture(images) -> Promise<{corrections:[], weaknesses:[]}>`
  - `onCaptureFiles(files)`, `renderCaptureResult(corrections,weaknesses)`, `saveCaptureChosen()`
  - 모듈 변수 `capWeak`.

- [ ] **Step 1: 분석 + 결과 + 저장 함수 추가 (`renderImproveVocab` 다음)**

```js
let capWeak=[];
async function analyzeCapture(images){
  const p=`너는 한국어 학습자의 영어 교정 캡처를 분석하는 코치야.
이미지는 영어 튜터 앱의 "개선할 점/수정 제안" 화면이야. JSON으로만 답해:
{"corrections":[{"original":"학습자 원문","corrected":"수정문","explainKo":"무엇을 왜 고쳤는지 한국어 한 줄"}],
 "weaknesses":[{"type":"grammar|word|idiom","term":"항목 이름(문법은 규칙명, 표현은 표제어형)","note":"한국어 짧은 설명","example":"이 약점이 드러난 수정문"}]}
같은 항목은 하나로 합치고, 캡처에 없는 내용은 지어내지 마.`;
  const obj=JSON.parse(await gemini(p,true,1500,images));
  return {corrections:Array.isArray(obj.corrections)?obj.corrections:[],weaknesses:Array.isArray(obj.weaknesses)?obj.weaknesses:[]};
}
async function onCaptureFiles(files){
  if(!files||!files.length)return;
  const res=document.getElementById('capResult');res.innerHTML='<div class="empty">캡처 분석 중…</div>';
  try{const parts=[];for(const f of files)parts.push(await fileToVisionPart(f));
    const {corrections,weaknesses}=await analyzeCapture(parts);renderCaptureResult(corrections,weaknesses);
  }catch(e){res.innerHTML='';aiErr(e,res);}
}
function renderCaptureResult(corrections,weaknesses){
  const res=document.getElementById('capResult');
  capWeak=weaknesses.map(w=>({type:w.type,term:(w.term||'').trim(),note:w.note||'',example:w.example||'',chosen:!termInVocab((w.term||'').trim())}));
  const tagOf=t=>t==='grammar'?'문법':(t==='idiom'?'관용구':'단어');
  const tcls=t=>t==='grammar'?'grammar':(['idiom','slang'].includes(t)?t:'word');
  const corrHtml=corrections.map(c=>`<div class="panel" style="margin:11px 0 0;"><div style="color:var(--ink-soft);font-size:13px;"><s>${esc(c.original||'')}</s></div><div style="font-weight:600;margin-top:6px;">${esc(c.corrected||'')}</div><div style="font-size:11.5px;color:#7a7468;margin-top:6px;line-height:1.5;">${esc(c.explainKo||'')}</div></div>`).join('');
  const weakHtml=capWeak.length?capWeak.map((w,i)=>{const dup=termInVocab(w.term);
    return `<div class="capw ${w.chosen?'on':''}" data-i="${i}" style="${dup?'opacity:.5;':''}"><span class="capck">${w.chosen?'✓':''}</span><span class="tag ${tcls(w.type)}">${tagOf(w.type)}</span><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:13px;">${esc(w.term)}</div><div style="font-size:11px;color:var(--ink-faint);">${dup?'이미 있음':esc(w.note)}</div></div></div>`;}).join(''):'<div class="empty">고칠 점이 없네요 👍</div>';
  res.innerHTML=`${corrHtml}<div style="font-size:12px;font-weight:600;color:var(--ink-soft);margin:13px 0 5px;">내가 부족한 부분 — 담을 항목 선택</div><div id="capWeakList">${weakHtml}</div>${capWeak.some(w=>!termInVocab(w.term))?'<button class="secondary" style="width:100%;margin-top:11px;" onclick="saveCaptureChosen()">선택 항목 담기</button>':''}`;
  res.querySelectorAll('.capw').forEach(el=>el.onclick=()=>{const i=+el.dataset.i;if(termInVocab(capWeak[i].term))return;
    capWeak[i].chosen=!capWeak[i].chosen;el.classList.toggle('on',capWeak[i].chosen);el.querySelector('.capck').textContent=capWeak[i].chosen?'✓':'';});
}
async function saveCaptureChosen(){
  const chosen=capWeak.filter(w=>w.chosen&&!termInVocab(w.term));
  if(!chosen.length){toast('담을 항목을 선택하세요');return;}
  let lastGrammar=false;
  for(const w of chosen){
    const item={id:uid(),term:w.term,note:w.note||'',
      type:['grammar','word','idiom','slang'].includes(w.type)?w.type:'word',
      source:'capture',sourceLabel:'캡처',context:w.example||'',contextKo:'',
      srs:{box:1,dueAt:Date.now(),history:[]},examples:[],createdAt:Date.now()};
    if(item.type==='grammar')lastGrammar=true;
    await idbPut('vocab',item);vocab.push(item);logActivity('word',item.id);
  }
  document.getElementById('capResult').innerHTML='';capWeak=[];
  toast(chosen.length+'개 담았어요');
  improveSegTo(lastGrammar&&chosen.every(w=>w.type==='grammar')?'grammar':'word');
  updateBadges();
}
```

- [ ] **Step 2: `capInput` change 바인딩 (init/부트스트랩부)**

파일 마지막 초기화 영역(예: `DOMContentLoaded` 또는 즉시 실행 init)에서 한 줄 추가. `tabTo`/`updateBadges` 가 처음 호출되는 init 함수 안, 안전하게는 `boot()`/`init()` 류 끝에:

```js
  const capIn=document.getElementById('capInput');
  if(capIn)capIn.onchange=e=>{onCaptureFiles(e.target.files);e.target.value='';};
```

(찾는 법: `grep -n "addEventListener('DOMContentLoaded'\|function boot\|function init\|loadAll()" index.html` 로 부트 위치 확인 후 그 안에 삽입.)

- [ ] **Step 3: 검증 — 분석 결과 렌더 + 저장 (gemini 스텁)**

키 없이 흐름을 검증. `preview_eval`:

```js
(async()=>{const orig=window.gemini;
 window.gemini=async()=>JSON.stringify({corrections:[{original:'I think he know',corrected:'I think he knows',explainKo:'주어-동사 수일치'}],
   weaknesses:[{type:'grammar',term:'주어-동사 수일치',note:'3인칭 단수 -s',example:'he knows'},{type:'word',term:'be in a position to',note:'~할 입장',example:'in a position to'}]});
 vocab=[];tabTo('improve');
 const {corrections,weaknesses}=await analyzeCapture([]);renderCaptureResult(corrections,weaknesses);
 const cards=document.querySelectorAll('#capWeakList .capw').length;
 await saveCaptureChosen();
 window.gemini=orig;
 const saved=vocab.map(v=>({term:v.term,type:v.type,source:v.source}));
 return {weakCards:cards, savedCount:vocab.length, saved};})()
```

Expected: `weakCards:2`, `savedCount:2`, `saved` 의 두 항목 모두 `source:'capture'` (하나 `type:'grammar'`, 하나 `type:'word'`). `preview_console_logs`(error) 비어 있음.

- [ ] **Step 4: 검증 — 중복 차단**

```js
(async()=>{const orig=window.gemini;
 vocab=[{id:'x',term:'주어-동사 수일치',type:'grammar',source:'capture',createdAt:1}];
 renderCaptureResult([],[{type:'grammar',term:'주어-동사 수일치',note:'-s',example:''}]);
 const dupText=document.querySelector('#capWeakList .capw .vmeta, #capWeakList .capw div div:last-child');
 const chosen=capWeak[0].chosen;window.gemini=orig;
 return {dupChosenFalse:chosen===false};})()
```

Expected: `dupChosenFalse:true` (이미 있는 항목은 기본 미선택).

- [ ] **Step 5: 커밋**

```bash
printf 'feat(improve): capture analyze, result UI, save selected weaknesses' > .git/COMMIT_MSG_TMP.txt
git add index.html && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

### Task 5: 드릴 연습 — 단어·문법 공통, 문장 수 선택

**Files:**
- Modify: `index.html` — `screen-detail`(~278-291), `vdGenerate`(~1470-1474)→`vdGenerateSet`, `vdFeedback` 프롬프트(~1478-1485), `openVocabDetail`(~1456-1466), 상태 줄(~1455)

**Interfaces:**
- Consumes: 기존 `gemini`, `vdCefr`, `vdKoSentence`, `vdFeedback`, `vdSaveExample`, `aiErr`.
- Produces:
  - 모듈 상태 `vdSet=[]`, `vdIdx=0`, `vdCount=1`.
  - `vdGenerateSet()`, `renderDrill()`, `vdNext()`, `setVdCount(n)`.

- [ ] **Step 1: 상태 변수 추가 (~1455)**

`let vdId=null, vdCefr='A2', ...` 상태 줄 끝(이미 Task 3에서 `vdOrigin='learn'` 추가됨)에 이어서 추가:

```js
let vdSet=[], vdIdx=0, vdCount=1;
```

- [ ] **Step 2: 연습 화면 마크업 — 문장 수 칩 + 드릴 진행 + 다음 버튼**

`screen-detail`에서 다음 블록(~278-281):

```html
      <label class="fld">CEFR 등급으로 연습</label>
      <div class="row" id="vdCefr" style="gap:6px;"></div>
      <button class="secondary" style="width:100%;margin-top:10px;" onclick="vdGenerate()">이 등급의 한국어 문장 제시</button>
      <div id="vdKo" style="font-size:15px;line-height:1.6;margin:10px 0;padding:11px;background:var(--amber-bg);border-radius:9px;min-height:10px;color:#5b5446;">등급을 고르고 “문장 제시”를 눌러보세요.</div>
```

→ 다음으로 교체:

```html
      <label class="fld">CEFR 등급으로 연습</label>
      <div class="row" id="vdCefr" style="gap:6px;"></div>
      <label class="fld">문장 수</label>
      <div class="row" id="vdCount" style="gap:6px;">
        <span class="chip on" data-n="1" onclick="setVdCount(1)">1문장</span>
        <span class="chip" data-n="3" onclick="setVdCount(3)">3</span>
        <span class="chip" data-n="5" onclick="setVdCount(5)">5</span>
        <span class="chip" data-n="10" onclick="setVdCount(10)">10</span>
      </div>
      <button class="secondary" style="width:100%;margin-top:10px;" onclick="vdGenerateSet()">한국어 문장 받기</button>
      <div id="vdDrill" style="display:none;align-items:center;margin:11px 0 0;"></div>
      <div id="vdKo" style="font-size:15px;line-height:1.6;margin:10px 0;padding:11px;background:var(--amber-bg);border-radius:9px;min-height:10px;color:#5b5446;">등급과 문장 수를 고르고 “문장 받기”를 눌러보세요.</div>
```

그리고 `vdSaveExample` 버튼(~289) 다음 줄에 `다음 문장` 버튼을 추가:

```html
      <button style="width:100%;" onclick="vdSaveExample()">＋ 이 영작을 예문으로 저장</button>
      <button class="secondary" id="vdNextBtn" style="width:100%;margin-top:8px;display:none;" onclick="vdNext()">다음 문장 →</button>
```

- [ ] **Step 3: `vdGenerate` → `vdGenerateSet` 교체 (~1470-1474)**

`async function vdGenerate(){...}` 전체를 다음으로 교체:

```js
function setVdCount(n){vdCount=n;document.querySelectorAll('#vdCount .chip').forEach(c=>c.classList.toggle('on',+c.dataset.n===n));}
async function vdGenerateSet(){const v=vocab.find(x=>x.id===vdId);const ko=document.getElementById('vdKo');
  vdLastFeedback=null;ko.textContent='문장 생성 중…';document.getElementById('vdFeedback').innerHTML='';
  const kind=v.type==='grammar'?'문법':'표현';
  try{
    if(vdCount===1){
      const p=`너는 한국어-영어 학습 코치야. 학습자가 "${v.term}"(뜻: ${v.note||'?'})를 연습해.${v.type==='grammar'?' 이건 학습자의 약점 문법이야.':''}\nCEFR ${vdCefr} 수준의 자연스러운 한국어 문장 1개만 만들어줘. 영어로 옮기면 이 ${kind}을 자연스럽게 쓰게 되도록.\n설명·따옴표 없이 한국어 문장 한 줄만 출력.`;
      vdSet=[(await gemini(p)).trim()].filter(Boolean);
    }else{
      const p=`학습자가 "${v.term}"(${v.note||''})를 연습해.${v.type==='grammar'?' 이건 학습자의 약점 문법이야.':''}\nCEFR ${vdCefr} 수준의 자연스러운 한국어 문장 ${vdCount}개를 만들어줘. 각 문장을 영어로 옮기면 이 ${kind}을 꼭 쓰게 되도록.\nJSON으로만: {"sentences":["...","..."]}`;
      const arr=JSON.parse(await gemini(p,true,1200)).sentences;
      vdSet=(Array.isArray(arr)?arr:[]).map(s=>String(s).trim()).filter(Boolean);
    }
    if(!vdSet.length){ko.textContent='(생성 실패)';return;}
    vdIdx=0;renderDrill();
  }catch(e){ko.textContent='';aiErr(e,ko);}}
function renderDrill(){
  vdKoSentence=vdSet[vdIdx]||'';vdLastFeedback=null;
  document.getElementById('vdKo').textContent=vdKoSentence||'(문장 없음)';
  document.getElementById('vdEn').value='';document.getElementById('vdFeedback').innerHTML='';
  const d=document.getElementById('vdDrill'),nb=document.getElementById('vdNextBtn');
  if(vdSet.length>1){d.style.display='flex';
    d.innerHTML=`<span class="dprog">${vdIdx+1} / ${vdSet.length}</span>`+vdSet.map((_,i)=>`<span class="ddot ${i<vdIdx?'done':(i===vdIdx?'cur':'')}"></span>`).join('');
    nb.style.display=vdIdx<vdSet.length-1?'':'none';
  }else{d.style.display='none';nb.style.display='none';}}
function vdNext(){if(vdIdx<vdSet.length-1){vdIdx++;renderDrill();}}
```

- [ ] **Step 4: `openVocabDetail` 초기화에 드릴 상태 리셋 추가 (~1456-1466)**

`openVocabDetail` 안에서 기존
```js
  document.getElementById('vdKo').textContent='등급을 고르고 "문장 제시"를 눌러보세요.';
```
줄을 다음으로 교체:
```js
  vdSet=[];vdIdx=0;vdCount=1;setVdCount(1);
  document.getElementById('vdDrill').style.display='none';document.getElementById('vdNextBtn').style.display='none';
  document.getElementById('vdKo').textContent='등급과 문장 수를 고르고 "문장 받기"를 눌러보세요.';
```

- [ ] **Step 5: `vdFeedback` 프롬프트에 약점 의식 한 줄 추가 (~1478-1485)**

`vdFeedback` 안 프롬프트 문자열에서
```js
  const p=`학습자가 영어 표현 "${v.term}"를 사용해 영작했어.
```
를 다음으로 교체:
```js
  const p=`학습자가 ${v.type==='grammar'?'약점 문법':'영어 표현'} "${v.term}"를 사용해 영작했어.${v.type==='grammar'?' 이 문법을 맞게 적용했는지 꼭 확인하고, 같은 실수가 또 나오면 짚어줘.':''}
```

- [ ] **Step 6: 검증 — 다중 문장 드릴 (gemini 스텁)**

`preview_eval`:

```js
(async()=>{const orig=window.gemini;
 window.gemini=async(p,json)=>json?JSON.stringify({sentences:['그는 매일 커피를 마셔.','그녀는 학교에 가.','우리는 영화를 봐.']}):'한 문장';
 vocab=[{id:'g',term:'주어-동사 수일치',type:'grammar',note:'-s',createdAt:1}];
 openVocabDetail('g','improve');
 setVdCount(3);await vdGenerateSet();
 const p1=document.getElementById('vdDrill').textContent.includes('1 / 3');
 const ko1=document.getElementById('vdKo').textContent;
 vdNext();const ko2=document.getElementById('vdKo').textContent;const p2=document.getElementById('vdDrill').textContent.includes('2 / 3');
 vdNext();vdNext();const nextHidden=document.getElementById('vdNextBtn').style.display==='none';
 window.gemini=orig;backFromDetail();
 return {p1,ko1,p2,ko2,setLen:vdSet.length,nextHiddenAtEnd:nextHidden};})()
```

Expected: `p1:true`, `ko1:"그는 매일 커피를 마셔."`, `p2:true`, `ko2:"그녀는 학교에 가."`, `setLen:3`, `nextHiddenAtEnd:true`(마지막 문장에서 다음 버튼 숨김).

- [ ] **Step 7: 검증 — 1문장 모드 (드릴 표시 없음)**

```js
(async()=>{const orig=window.gemini;window.gemini=async()=>'그는 커피를 마셔.';
 vocab=[{id:'w',term:'drink',type:'word',note:'마시다',createdAt:1}];
 openVocabDetail('w','learn');setVdCount(1);await vdGenerateSet();
 const drillHidden=document.getElementById('vdDrill').style.display==='none';
 const ko=document.getElementById('vdKo').textContent;window.gemini=orig;backFromDetail();
 return {drillHidden, ko, setLen:vdSet.length};})()
```

Expected: `drillHidden:true`, `ko:"그는 커피를 마셔."`, `setLen:1`.

- [ ] **Step 8: 커밋**

```bash
printf 'feat(improve): multi-sentence drill practice for words & grammar' > .git/COMMIT_MSG_TMP.txt
git add index.html && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

## Self-Review

**Spec coverage:**
- 캡처=Gemini 비전 → T2(`gemini` 확장·`fileToVisionPart`) + T4(`analyzeCapture`). ✓
- `source:'capture'` 분리 저장 → T4 저장 + T3 뷰 필터(`source!=='capture'` vs `==='capture'`). ✓
- 4탭 내비(복습 제거) → T3 Step1·4·7. SRS 코드 보존(screen-quiz/renderQuiz 미삭제). ✓
- 학습 `[영상|단어]` → T3 Step2·5. 개선 `[단어|문법]` → T3 Step3·5. ✓
- 문법 태그 + 캡처 출처 표시 → T1. ✓
- 드릴(단어·문법 공통, 1/3/5/10) → T5. ✓
- 분석 결과(원문→수정문 + 약점 체크 + 중복 차단 + 빈 상태) → T4 Step1·3·4. ✓
- 엣지: 키 없음(`aiErr`), JSON 깨짐(try/catch+`aiErr`), 약점 없음("고칠 점이 없네요"), 여러 장(한 요청) → T2/T4. ✓

**Placeholder scan:** 모든 코드 단계에 실제 코드 포함. T4 Step2의 init 위치는 `grep`으로 찾는 구체 지시(부트 함수 내 한 줄). 커밋 메시지는 각 단계에 실문구 명시. placeholder 없음.

**Type consistency:**
- `gemini(prompt,json,maxTokens,images)` — T2 정의, T4 `analyzeCapture`/T5 `vdGenerateSet`에서 동일 시그니처 사용. ✓
- `fileToVisionPart -> {mime,dataB64}` — T2 정의, T4 `onCaptureFiles`에서 `analyzeCapture(parts)`로 전달, `gemini`의 `images:[{mime,dataB64}]`와 일치. ✓
- `vcardEl(v, showVid)` — T1 확장, T3 `renderLearnVocab(...,true)`/`renderImproveVocab(...,false)`에서 사용. ✓
- `openVocabDetail(id, origin)` — T3 정의, `bindVocabGrid`가 `'learn'|'improve'` 전달, `backFromDetail`이 `vdOrigin`로 복귀. ✓
- `vdSet/vdIdx/vdCount` + `vdGenerateSet/renderDrill/vdNext/setVdCount` — T5 내부 일관. `vdKoSentence`(기존)·`vdFeedback`·`vdSaveExample`는 현재 문장 기준으로 그대로 연동. ✓
- 태그 클래스 `grammar` — T1 CSS·`vcardEl`, T4 결과 목록 `tcls()` 동일 사용. ✓
