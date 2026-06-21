# 보던 영상 이어보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영상마다 "나간 지점"을 자동 기억해, 다시 열면 그 지점에서 이어 보고, 학습 탭 상단의 "이어보기" 섹션에서 진행 중인 영상에 한 번에 복귀한다.

**Architecture:** 기존 단일 북마크(`bookmark`=학습 진도)는 그대로 두고, 영상 객체에 재생 위치 전용 필드 `resume={time,at}`를 추가한다. 재생 위치는 폴링 없이 "나가는 순간"(일시정지/ENDED/화면·탭 이동/백그라운드) 이벤트에서만 저장한다. `openVideo`는 `resume→bookmark→0` 우선순위로 재생을 시작하고, 학습 탭에 가로 스크롤 이어보기 섹션을 렌더한다.

**Tech Stack:** 바닐라 JS + IndexedDB(`idbPut/idbGet/idbAll`) + YouTube IFrame API, 단일 `index.html`. 테스트 러너 없음 → 검증은 `preview_*` 브라우저 도구로 수동 확인.

## Global Constraints

- 모든 변경은 `C:\Users\pponi13468\Desktop\박미정\podcast\index.html` 한 파일 안에서 한다.
- 기존 `bookmark`(학습 진도: 탭 전진/🔖 플래그/studied 음영/loopbar 🔖 칩)는 **동작 변경 금지**.
- 재생 위치 저장은 **이벤트 1회**만 — 주기적 폴링(setInterval) 추가 금지.
- `saveResume()`는 `time < 2`이면 저장 스킵.
- 저장 시 `loadAll()`/전체 재렌더 호출 금지(학습 화면 깜빡임 방지).
- 배포: `master`에 push → Netlify가 `index.html`을 자동 배포(`netlify.toml`).

---

### Task 1: 재생 위치 저장 코어 (`saveResume` / `clearResume` / 이벤트 훅)

**Files:**
- Modify: `index.html` — bookmark 섹션(~685), `mountPlayer`(~670), `pausePlayer`(~675), init(~1512)

**Interfaces:**
- Produces:
  - `saveResume()` — `currentVideo`의 현재 재생 위치를 `currentVideo.resume={time,at:Date.now()}`로 `idbPut('videos',...)`. `time<2`면 스킵.
  - `clearResume(v)` — `delete v.resume; idbPut('videos',v)`.
  - `mountPlayer`의 `onStateChange`에서 `PAUSED`/`ENDED` 시 저장, `ENDED` 시 `clearResume(currentVideo)`.

- [ ] **Step 1: bookmark 섹션에 `saveResume`/`clearResume` 추가**

`index.html` 의 `/* ============ bookmark (이어보기) ============ */` 블록 시작 직후에 삽입:

```js
function saveResume(){if(!currentVideo||!playerReady)return;let t=0;try{t=player.getCurrentTime();}catch(e){return;}
  if(!isFinite(t)||t<2)return;currentVideo.resume={time:t,at:Date.now()};idbPut('videos',currentVideo);}
function clearResume(v){if(!v||!v.resume)return;delete v.resume;idbPut('videos',v);}
```

- [ ] **Step 2: `mountPlayer`에 `onStateChange` 추가**

`index.html:672-673` 의 `events:{onReady:...}` 를 다음으로 교체:

```js
    events:{onReady:()=>{playerReady=true;try{player.setPlaybackRate(currentRate);}catch(e){}},
      onStateChange:(e)=>{const S=YT.PlayerState;
        if(e.data===S.PAUSED){saveResume();}
        else if(e.data===S.ENDED){saveResume();clearResume(currentVideo);if(typeof renderLibrary==='function'){}}}}});}
```

- [ ] **Step 3: `pausePlayer`에서 저장**

`index.html:675` 를 교체:

```js
function pausePlayer(){saveResume();if(playerReady){try{player.pauseVideo();}catch(e){}}}
```

- [ ] **Step 4: 백그라운드/탭 이탈 시 저장 (init 부근 전역 리스너)**

`index.html` 의 init IIFE 아래(파일 끝 `document.querySelectorAll('.modal-bg')...` 줄 옆)에 추가:

```js
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveResume();});
window.addEventListener('pagehide',()=>{saveResume();});
```

- [ ] **Step 5: 검증 (브라우저)**

`preview_start` 후 영상 추가/열기 → 재생 → 5초쯤에서 일시정지 → `preview_eval`로
`(await (async()=>{const d=await idbAllVideosDebug?.();})())` 대신 콘솔에서 확인이 어려우므로,
일시정지 후 학습 화면을 나갔다가 같은 영상 다시 열어 그 지점에서 재생되는지 육안 확인(Task 2 적용 후 최종 확인). 콘솔 에러 없는지 `preview_console_logs`.

- [ ] **Step 6: 커밋**

```bash
git add index.html
git commit -F .git/COMMIT_MSG_TMP.txt   # "feat(resume): auto-save exit playback position"
```

---

### Task 2: 영상 열 때 이어보기 우선 + 이어보기 칩을 resume 기준으로

**Files:**
- Modify: `index.html` — `openVideo`(~779-786), `updateResume`/`resumeBookmark`(~694-697)

**Interfaces:**
- Consumes: Task 1의 `resume` 필드.
- Produces: `openVideo`가 `resume.time→bookmark.time→0` 순으로 시작. `resumeChip`/`resumeBookmark`가 `resume` 기준.

- [ ] **Step 1: `openVideo` 시작 위치 우선순위 변경**

`index.html:784` 의 mountPlayer 호출을 교체:

```js
  const startAt=(currentVideo.resume&&currentVideo.resume.time!=null)?currentVideo.resume.time
    :(currentVideo.bookmark&&currentVideo.bookmark.time!=null)?currentVideo.bookmark.time:0;
  mountPlayer(currentVideo.youtubeId,startAt);
```

- [ ] **Step 2: `updateResume`를 resume 기준으로 변경**

`index.html:694-695` 교체:

```js
function updateResume(){const c=document.getElementById('resumeChip');if(!c)return;const r=currentVideo&&currentVideo.resume;
  if(r&&r.time!=null){c.style.display='';c.textContent='🔖 이어보기 '+fmt(r.time);}else c.style.display='none';}
```

- [ ] **Step 3: `resumeBookmark`를 resume 기준으로 변경**

`index.html:697` 교체:

```js
function resumeBookmark(){const r=currentVideo&&currentVideo.resume;if(!r)return;if(r.time!=null)seekTo(r.time);}
```

- [ ] **Step 4: `openVideo`에서 `updateResume()` 호출 보장**

`openVideo` 끝부분(스크롤 처리 부근, ~785)에 `updateResume();` 가 호출되는지 확인하고 없으면 추가. (mountPlayer 직후)

```js
  updateResume();
```

- [ ] **Step 5: 검증 (브라우저)**

영상 재생 → 임의 위치에서 일시정지 → 학습 탭으로 나갔다가 같은 영상 다시 열기 →
그 지점에서 재생되는가. substrip의 `🔖 이어보기 mm:ss` 가 그 시각을 보여주는가.
`preview_console_logs` 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add index.html
git commit -F .git/COMMIT_MSG_TMP.txt   # "feat(resume): openVideo + chip use resume position"
```

---

### Task 3: 학습 탭 상단 "이어보기" 섹션

**Files:**
- Modify: `index.html` — `#screen-library` 마크업, CSS, `renderLibrary`(~727), 신설 함수

**Interfaces:**
- Consumes: `videos`(전역, lastStudiedAt desc 정렬됨), `resume` 필드, `openVideo`, `fmt`, `esc`.
- Produces: `renderResumeRow()`, `resumeCardHTML(v)`, `removeResume(id)`.

- [ ] **Step 1: 라이브러리 화면에 컨테이너 추가**

`#screen-library` 안, `#libList`(영상 목록) **바로 위**에 삽입:

```html
    <div id="resumeRow" class="resume-row" style="display:none;"></div>
```

- [ ] **Step 2: CSS 추가 (style 블록 안)**

```css
.resume-row{display:flex;gap:10px;overflow-x:auto;padding:4px 16px 10px;-webkit-overflow-scrolling:touch;}
.resume-sec-t{font-size:12px;color:var(--ink-soft);padding:8px 16px 2px;font-weight:600;}
.rcard{position:relative;flex:0 0 auto;width:150px;cursor:pointer;}
.rcard .rthumb{width:150px;height:84px;border-radius:10px;background-size:cover;background-position:center;position:relative;}
.rcard .rt{font-size:12px;margin-top:4px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.rcard .rtime{font-size:11px;color:var(--ink-soft);margin-top:2px;}
.rcard .rx{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;line-height:1;}
.rcard .rplay{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.55);color:#fff;border-radius:6px;padding:1px 6px;font-size:11px;}
```

- [ ] **Step 3: 신설 함수 추가 (library 섹션 부근)**

```js
function resumeCardHTML(v){return `<div class="rcard" onclick="openVideo('${v.id}')">
  <div class="rthumb" style="background-image:url(https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg)">
    <button class="rx" title="이어보기에서 제거" onclick="event.stopPropagation();removeResume('${v.id}')">✕</button>
    <span class="rplay">▶ ${fmt(v.resume.time)}</span>
  </div>
  <div class="rt">${esc(v.title||'제목 없음')}</div>
  <div class="rtime">이어보기 ${fmt(v.resume.time)}</div>
</div>`;}
function renderResumeRow(){const el=document.getElementById('resumeRow');if(!el)return;
  const list=videos.filter(v=>v.resume&&v.resume.time!=null)
    .sort((a,b)=>(b.resume.at||0)-(a.resume.at||0)).slice(0,8);
  if(!list.length){el.style.display='none';el.innerHTML='';return;}
  el.style.display='';
  el.innerHTML='<div class="resume-sec-t">이어보기</div><div class="resume-row" style="padding:0;">'
    +list.map(resumeCardHTML).join('')+'</div>';}
async function removeResume(id){const v=videos.find(x=>x.id===id);if(!v)return;delete v.resume;await idbPut('videos',v);renderResumeRow();}
```

(주: 위 `renderResumeRow`는 제목줄+행을 함께 만든다. `#resumeRow` 자체는 래퍼이므로 안쪽 `.resume-row`의 `padding:0`로 중복 패딩 제거.)

- [ ] **Step 4: `renderLibrary`에서 호출**

`index.html:727` `renderLibrary` 함수 본문 맨 앞(또는 끝)에 추가:

```js
  renderResumeRow();
```

빈 라이브러리 early-return 보다 **앞**에 둬서 영상이 폴더로만 있어도 이어보기 행이 뜨게 한다.

- [ ] **Step 5: 검증 (브라우저)**

- 두 개 영상을 각각 다른 지점까지 보고 나오기 → 학습 탭 상단에 "이어보기" 카드 2개가 최신순으로.
- 카드 탭 → 그 지점에서 재생.
- 카드 ✕ → 목록에서 사라지고, 해당 영상의 학습 진도(🔖)는 그대로 유지.
- `preview_screenshot`로 결과 캡처. `preview_console_logs` 에러 없음.

- [ ] **Step 6: 커밋 + 푸시(배포)**

```bash
git add index.html
git commit -F .git/COMMIT_MSG_TMP.txt   # "feat(resume): continue-watching shelf on library"
git push
```

---

## Self-Review

- **Spec coverage:** 데이터 모델(`resume`)=T1, 자동 저장(이벤트)=T1, 영상 열 때 우선순위=T2, 학습 칩=T2, 홈 섹션=T3, ENDED 제거=T1, ✕ 제거=T3. 전 항목 매핑됨.
- **Placeholder scan:** 모든 코드 단계에 실제 코드 포함, TBD 없음.
- **Type consistency:** `resume={time,at}` 필드명, `saveResume/clearResume/renderResumeRow/resumeCardHTML/removeResume` 일관. `fmt`, `esc`, `idbPut`, `openVideo`, `videos` 기존 심볼 사용.
