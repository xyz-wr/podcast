# 기기 간 동기화 (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단어·영상·예문(텍스트) 데이터를 동기화 코드로 묶어 Supabase에 미러링해, 여러 기기에서 자동으로 같은 내용이 보이게 한다.

**Architecture:** 로컬 IndexedDB가 진실원본으로 유지된다. 중앙 헬퍼 `idbPut`/`idbDel`에 동기화 훅을 붙여, `vocab`/`videos` 변경 시 `updatedAt`을 찍고 푸시 큐에 넣는다. 큐는 Supabase REST(PostgREST)로 `fetch` upsert 한다. 앱 시작 시 내 동기화 코드의 행을 받아와 항목 단위 last-write-wins로 병합한다. 삭제는 소프트 삭제(tombstone)로 전파한다.

**Tech Stack:** 순수 브라우저 JS, IndexedDB, Supabase REST API(`fetch`). 새 라이브러리·빌드 도구 없음. 단일 `index.html` 유지.

## Global Constraints

- 단일 파일 유지: 모든 코드는 `index.html`의 기존 `<script>` 안에 추가한다. 새 파일·번들러·프레임워크 금지.
- 동기화 대상은 `vocab`, `videos` 두 스토어의 텍스트 데이터만. `recordings`(오디오)와 `settings`(Gemini 키 포함)는 동기화하지 않는다.
- 미설정 시 완전 무해(no-op): Supabase URL/키/동기화 코드가 없으면 기존 동작과 100% 동일해야 한다. 동기화는 순수 부가 기능이다.
- 오프라인에서도 앱은 정상 작동한다. 네트워크 실패는 조용히 큐에 보관 후 재시도하며, 절대 사용자 작업을 막지 않는다.
- 충돌 해결은 항목(행) 단위 last-write-wins: `updated_at`(epoch ms)이 더 큰 쪽이 이긴다.
- 테스트 러너가 없으므로 검증 사이클은 (a) 순수 함수는 브라우저 콘솔 `runSyncSelfTest()`, (b) UI/네트워크는 preview 도구(콘솔/네트워크/스냅샷)로 한다.

---

## File Structure

모든 변경은 `index.html` 한 파일 안에서 일어난다. 논리적 구획:

- **설정 UI 블록** (`#setModal`, line ~324-335): Supabase URL/키, 동기화 코드 입력 + 코드 생성 버튼 추가.
- **동기화 모듈** (IndexedDB 헬퍼 직후, line ~356 부근에 신규 `/* ===== sync ===== */` 블록): 설정 로드, REST 클라이언트, 푸시 큐, 병합, self-test.
- **헬퍼 훅** (`idbPut` line 351 / `idbDel` line 354): 동기화 큐잉 호출 삽입.
- **init** (line 796-798): 설정 로드 + 시작 시 pull.

---

## Task 1: 동기화 설정 UI + 영속화

설정 모달에 Supabase URL/키와 동기화 코드 입력란을 추가하고, IndexedDB `settings`에 저장/로드한다. 동기화 코드 자동 생성 버튼을 포함한다.

**Files:**
- Modify: `index.html` (`#setModal` 본문 ~324-335, `openSettings`/`saveKey` ~708-709, 전역 상태 ~707, `init` ~796-798)

**Interfaces:**
- Produces:
  - 전역 `SB_URL:string`, `SB_KEY:string`, `SYNC_CODE:string` (기본 `''`)
  - `async function loadSyncConfig(): Promise<void>` — settings에서 3값을 전역에 적재
  - `function genSyncCode(): string` — `'tablo-'+랜덤` 형태 코드 반환
  - settings 키: `'sbUrl'`, `'sbKey'`, `'syncCode'`

- [ ] **Step 1: 설정 모달에 입력 UI 추가**

`index.html`의 `#setModal` 안, Gemini 키 `keyStatus` div(line 334) 바로 아래에 삽입:

```html
    <hr style="border:none;border-top:1px solid var(--line);margin:16px 0;">
    <h3 style="margin:0 0 6px;">기기 간 동기화 · 선택</h3>
    <p style="font-size:12px;color:var(--ink-soft);line-height:1.55;margin:0 0 10px;">여러 기기에서 단어·영상·예문을 같이 보려면 <b>Supabase(무료)</b>에 연결하세요. 같은 <b>동기화 코드</b>를 넣은 기기끼리 데이터가 맞춰집니다. 비워두면 이 기기에만 저장돼요(기존과 동일).</p>
    <label class="fld">Supabase URL</label>
    <input id="sbUrlInput" type="text" placeholder="https://xxxx.supabase.co">
    <label class="fld">Supabase anon key</label>
    <input id="sbKeyInput" type="text" placeholder="eyJ...">
    <label class="fld">동기화 코드</label>
    <div class="row">
      <input id="syncCodeInput" type="text" placeholder="tablo-..." style="flex:1;">
      <button class="ghost sm" onclick="document.getElementById('syncCodeInput').value=genSyncCode()">새 코드</button>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="secondary grow" onclick="saveSyncConfig()">동기화 저장</button>
    </div>
    <div id="syncStatus" style="font-size:12px;color:var(--ink-soft);margin-top:8px;"></div>
```

- [ ] **Step 2: 전역 상태와 코드 생성기 추가**

line 707 `let GEMINI_KEY=...` 줄 아래에 추가:

```javascript
let SB_URL='', SB_KEY='', SYNC_CODE='';
function genSyncCode(){const r=()=>Math.random().toString(36).slice(2,6);return 'tablo-'+r()+'-'+r();}
```

- [ ] **Step 3: 저장/로드 함수 추가**

`saveKey` 함수(line 709) 아래에 추가:

```javascript
async function loadSyncConfig(){
  try{const u=await idbGet('settings','sbUrl');SB_URL=(u&&u.value)||'';}catch(e){}
  try{const k=await idbGet('settings','sbKey');SB_KEY=(k&&k.value)||'';}catch(e){}
  try{const c=await idbGet('settings','syncCode');SYNC_CODE=(c&&c.value)||'';}catch(e){}
}
async function saveSyncConfig(){
  SB_URL=document.getElementById('sbUrlInput').value.trim().replace(/\/+$/,'');
  SB_KEY=document.getElementById('sbKeyInput').value.trim();
  SYNC_CODE=document.getElementById('syncCodeInput').value.trim();
  await idbPut('settings',{key:'sbUrl',value:SB_URL});
  await idbPut('settings',{key:'sbKey',value:SB_KEY});
  await idbPut('settings',{key:'syncCode',value:SYNC_CODE});
  document.getElementById('syncStatus').textContent = sbReady()? '연결됨 ✓ (코드: '+SYNC_CODE+')' : '동기화 꺼짐 (값을 모두 입력하세요)';
  toast('동기화 설정 저장됨');
  if(sbReady()){await syncPull();await loadAll();}
}
```

> 참고: `sbReady`, `syncPull`은 Task 2·4에서 정의된다. 이 단계에서는 호출만 작성한다.

- [ ] **Step 4: 모달 열 때 현재 값 채우기**

`openSettings`(line 708)를 아래로 교체:

```javascript
function openSettings(){
  document.getElementById('geminiKeyInput').value=GEMINI_KEY;
  document.getElementById('keyStatus').textContent=GEMINI_KEY?'키 저장됨 ✓':'키 없음';
  document.getElementById('sbUrlInput').value=SB_URL;
  document.getElementById('sbKeyInput').value=SB_KEY;
  document.getElementById('syncCodeInput').value=SYNC_CODE;
  document.getElementById('syncStatus').textContent= (typeof sbReady==='function'&&sbReady())?'연결됨 ✓':'동기화 꺼짐';
  openModal('setModal');
}
```

- [ ] **Step 5: init에서 설정 로드**

line 797 (Gemini 키 로드) 다음 줄에 추가, `loadAll()` 호출 전:

```javascript
  await loadSyncConfig();
```

- [ ] **Step 6: 브라우저로 검증**

preview 서버에서 `index.html`을 열고:
- preview_eval로 설정 모달 열기: `openSettings()` → preview_snapshot으로 새 입력란 3개와 "새 코드" 버튼이 보이는지 확인.
- "새 코드" 클릭 시 `syncCodeInput`에 `tablo-xxxx-xxxx` 채워지는지 preview_eval: `document.getElementById('syncCodeInput').value`.
- 값 입력 후 `saveSyncConfig()` 호출 → 다시 `openSettings()` → 값이 유지되는지 확인.
- preview_console_logs로 에러 없는지 확인.

Expected: 입력란 표시·코드 생성·저장 후 값 유지, 콘솔 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(sync): add Supabase URL/key/sync-code settings UI and persistence"
```

---

## Task 2: Supabase REST 클라이언트 + 순수 충돌 해결기 + self-test

Supabase에 행을 upsert/select 하는 `fetch` 헬퍼와, 병합 결정을 내리는 순수 함수 `syncResolve`, 그리고 콘솔 self-test를 추가한다.

**Files:**
- Modify: `index.html` (IndexedDB 헬퍼 직후, `uid` 정의 line 356 아래에 신규 `/* ===== sync ===== */` 블록)

**Interfaces:**
- Consumes: 전역 `SB_URL`, `SB_KEY`, `SYNC_CODE` (Task 1)
- Produces:
  - `function sbReady(): boolean` — 세 값이 모두 채워졌는지
  - `async function sbUpsert(table:string, rows:Array<{sync_code,id,data,deleted,updated_at}>): Promise<void>`
  - `async function sbSelect(table:string): Promise<Array<{sync_code,id,data,deleted,updated_at}>>`
  - `function syncResolve(localUpdatedAt:number, remote:{updated_at:number,deleted:boolean}): 'put'|'delete'|'skip'`
  - `function runSyncSelfTest(): boolean`
  - 전역 `let SYNC_APPLYING=false`

- [ ] **Step 1: 순수 충돌 해결기 + self-test 작성 (test-first)**

line 356 `const uid=...` 아래에 신규 블록을 만들고 먼저 순수 함수와 테스트를 작성:

```javascript
/* ===== sync ===== */
let SYNC_APPLYING=false;
function syncResolve(localUpdatedAt, remote){
  if(!(remote.updated_at > localUpdatedAt)) return 'skip';
  return remote.deleted ? 'delete' : 'put';
}
function runSyncSelfTest(){
  const cases=[
    [syncResolve(100,{updated_at:200,deleted:false})==='put','remote newer -> put'],
    [syncResolve(300,{updated_at:200,deleted:false})==='skip','local newer -> skip'],
    [syncResolve(200,{updated_at:200,deleted:false})==='skip','equal -> skip'],
    [syncResolve(0,{updated_at:50,deleted:true})==='delete','remote newer tombstone -> delete'],
    [syncResolve(-1,{updated_at:0,deleted:false})==='put','absent local -> put'],
  ];
  const pass=cases.every(c=>c[0]);
  console.log('runSyncSelfTest:', pass?'PASS':'FAIL', cases.filter(c=>!c[0]).map(c=>c[1]));
  return pass;
}
```

- [ ] **Step 2: self-test 실행해 통과 확인**

preview 서버에서 preview_eval: `runSyncSelfTest()`
Expected: 반환값 `true`, 콘솔에 `runSyncSelfTest: PASS []`.

- [ ] **Step 3: REST 클라이언트 추가**

같은 블록에 이어서 작성:

```javascript
function sbReady(){return !!(SB_URL && SB_KEY && SYNC_CODE);}
function sbHeaders(){return {'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'};}
async function sbUpsert(table, rows){
  if(!sbReady()||!rows.length)return;
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?on_conflict=sync_code,id',{
    method:'POST',
    headers:{...sbHeaders(),'Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify(rows)});
  if(!r.ok)throw new Error('sbUpsert '+table+' '+r.status);
}
async function sbSelect(table){
  if(!sbReady())return [];
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?sync_code=eq.'+encodeURIComponent(SYNC_CODE)+'&select=*',{
    headers:sbHeaders()});
  if(!r.ok)throw new Error('sbSelect '+table+' '+r.status);
  return r.json();
}
```

- [ ] **Step 4: 미설정 시 무해함 확인**

preview_eval로 (설정 비운 상태에서):
- `sbReady()` → `false`
- `await sbSelect('vocab')` → `[]` (네트워크 호출 없음)
- `await sbUpsert('vocab',[{sync_code:'x',id:'1',data:{},deleted:false,updated_at:1}])` → 에러 없이 반환(no-op)

Expected: 셋 다 위와 같이 동작, 콘솔 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(sync): add Supabase REST client, pure conflict resolver, self-test"
```

---

## Task 3: 변경 시 푸시 — idbPut/idbDel 훅 + 영속 큐

`vocab`/`videos`가 바뀔 때 `updatedAt`을 찍고, Supabase 푸시를 큐에 넣어 디바운스 후 전송한다. 오프라인이면 큐를 IndexedDB에 보관한다.

**Files:**
- Modify: `index.html` (`idbPut` line 351, `idbDel` line 354, sync 블록)

**Interfaces:**
- Consumes: `sbReady`, `sbUpsert` (Task 2), `SYNC_APPLYING`
- Produces:
  - `function queuePush(table:string, row:object): void`
  - `async function flushQueue(): Promise<void>`
  - settings 키 `'syncQueue'` = `Array<{table,row}>`
  - `const SYNCED_STORES = ['vocab','videos']`

- [ ] **Step 1: 큐 헬퍼 추가**

sync 블록에 이어서 작성:

```javascript
const SYNCED_STORES=['vocab','videos'];
let _queue=[], _flushT=null;
function queuePush(table,row){
  if(SYNC_APPLYING || !sbReady())return;
  _queue.push({table,row});
  idbPut('settings',{key:'syncQueue',value:_queue});   // 영속(오프라인 대비)
  clearTimeout(_flushT); _flushT=setTimeout(flushQueue,800);
}
async function flushQueue(){
  if(!sbReady()||!_queue.length)return;
  const batch=_queue; _queue=[];
  const byTable={};
  for(const {table,row} of batch){(byTable[table]=byTable[table]||[]).push(row);}
  try{
    for(const t of Object.keys(byTable)) await sbUpsert(t,byTable[t]);
    await idbPut('settings',{key:'syncQueue',value:[]});
  }catch(e){
    _queue=batch.concat(_queue);                          // 실패분 복원
    await idbPut('settings',{key:'syncQueue',value:_queue});
    console.warn('flushQueue retry later:',e.message);
  }
}
```

> `queuePush`가 settings에 쓰는 `idbPut('settings',...)`는 `SYNCED_STORES`에 없으므로 재귀 큐잉되지 않는다(Step 2 가드 참조).

- [ ] **Step 2: idbPut 훅 추가**

line 351을 아래로 교체:

```javascript
const idbPut=(s,v)=>{
  if(SYNCED_STORES.includes(s)) v.updatedAt=Date.now();
  return idbReq(s,'readwrite',o=>o.put(v)).then(()=>{
    if(SYNCED_STORES.includes(s)) queuePush(s,{sync_code:SYNC_CODE,id:v.id,data:v,deleted:false,updated_at:v.updatedAt});
    return v;
  });
};
```

- [ ] **Step 3: idbDel 훅 추가**

line 354를 아래로 교체:

```javascript
const idbDel=(s,k)=>idbReq(s,'readwrite',o=>o.delete(k)).then(r=>{
  if(SYNCED_STORES.includes(s)) queuePush(s,{sync_code:SYNC_CODE,id:k,data:null,deleted:true,updated_at:Date.now()});
  return r;
});
```

- [ ] **Step 4: 시작 시 미전송 큐 복원 + init 훅**

sync 블록에 추가:

```javascript
async function restoreQueue(){
  try{const q=await idbGet('settings','syncQueue');_queue=(q&&q.value)||[];}catch(e){_queue=[];}
}
window.addEventListener('online',flushQueue);
```

`init`(line 796), `await loadSyncConfig();` 다음 줄에 추가:

```javascript
  await restoreQueue();
```

- [ ] **Step 5: 검증 — 변경이 큐/네트워크로 이어지는지**

preview 서버 + 콘솔. (Supabase 실프로젝트가 없으면 fetch를 가로채 검증.)

preview_eval로 stub 설치 후 동작 확인:
```javascript
SB_URL='https://stub.test';SB_KEY='k';SYNC_CODE='tablo-test';
window._sent=[];const _f=window.fetch;window.fetch=(u,o)=>{window._sent.push({u,o});return Promise.resolve({ok:true,json:()=>Promise.resolve([])});};
await idbPut('vocab',{id:'t1',term:'hello',videoId:'v1'});
await new Promise(r=>setTimeout(r,1000));
JSON.stringify({sent:window._sent.length, url:window._sent[0]&&window._sent[0].u, body:window._sent[0]&&window._sent[0].o.body});
```
Expected: `sent>=1`, url에 `/rest/v1/vocab?on_conflict=sync_code,id` 포함, body에 `"term":"hello"`와 `"updated_at"` 포함. 끝나면 `window.fetch=_f`로 복원.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(sync): push vocab/video changes to Supabase via persisted debounced queue"
```

---

## Task 4: 시작 시 pull + 항목 단위 병합

앱 시작 시(및 설정 저장 직후) Supabase에서 내 코드의 행을 받아와, `syncResolve`로 항목별 last-write-wins 병합한다. 원격 적용 중에는 재푸시를 막는다.

**Files:**
- Modify: `index.html` (sync 블록, `init` line 796-798)

**Interfaces:**
- Consumes: `sbSelect`, `syncResolve`, `SYNC_APPLYING`, `idbGet`, `SYNCED_STORES`, `loadAll`
- Produces: `async function syncPull(): Promise<void>`

- [ ] **Step 1: pull/병합 함수 작성**

sync 블록에 추가:

```javascript
async function syncPull(){
  if(!sbReady())return;
  SYNC_APPLYING=true;
  try{
    for(const table of SYNCED_STORES){
      let rows; try{rows=await sbSelect(table);}catch(e){console.warn('syncPull '+table,e.message);continue;}
      for(const row of rows){
        const local=await idbGet(table,row.id);
        const localT=local?(local.updatedAt||0):-1;
        const action=syncResolve(localT,row);
        if(action==='put') await idbReq(table,'readwrite',o=>o.put(row.data));
        else if(action==='delete' && local) await idbReq(table,'readwrite',o=>o.delete(row.id));
      }
    }
  }finally{SYNC_APPLYING=false;}
}
```

> 병합은 `idbPut`/`idbDel`이 아니라 원시 `idbReq`를 직접 써서 푸시 훅을 우회한다. `SYNC_APPLYING` 가드는 이중 안전장치다.

- [ ] **Step 2: init에서 pull 호출 + 큐 flush**

`init`(line 798) `await loadAll();`을 아래로 교체:

```javascript
  await loadAll();
  if(sbReady()){await syncPull();await flushQueue();await loadAll();}
```

- [ ] **Step 3: 검증 — 원격 행이 로컬에 병합되는지**

preview_eval로 sbSelect를 stub 처리해 병합 검증:
```javascript
SB_URL='https://stub.test';SB_KEY='k';SYNC_CODE='tablo-test';
const _f=window.fetch;
window.fetch=(u,o)=>{
  if(String(u).includes('/rest/v1/vocab')) return Promise.resolve({ok:true,json:()=>Promise.resolve([
    {sync_code:'tablo-test',id:'remote1',deleted:false,updated_at:Date.now(),data:{id:'remote1',term:'pulled',videoId:'v9',updatedAt:Date.now()}}
  ])});
  return Promise.resolve({ok:true,json:()=>Promise.resolve([])});
};
await syncPull();
const got=await idbGet('vocab','remote1');
window.fetch=_f;
JSON.stringify({term:got&&got.term});
```
Expected: `{"term":"pulled"}` — 원격 단어가 로컬 IndexedDB에 들어옴.

- [ ] **Step 4: 검증 — 더 오래된 원격은 무시**

preview_eval:
```javascript
await idbReq('vocab','readwrite',o=>o.put({id:'c1',term:'LOCAL_NEW',updatedAt:5000}));
SYNC_APPLYING=true; // 직접 호출이라 무관하지만 명시
const remote={sync_code:'tablo-test',id:'c1',deleted:false,updated_at:1000,data:{id:'c1',term:'REMOTE_OLD',updatedAt:1000}};
const act=syncResolve(5000,remote); // 'skip'
SYNC_APPLYING=false;
act;
```
Expected: `'skip'` — 더 최신 로컬이 보존됨.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(sync): pull and item-wise last-write-wins merge on startup"
```

---

## Task 5: 수동 동기화 버튼 + 엔드투엔드 교차기기 검증

사용자가 즉시 동기화할 수 있는 "지금 동기화" 버튼을 넣고, 두 브라우저 프로필로 실제 교차기기 시나리오를 검증한다.

**Files:**
- Modify: `index.html` (`#setModal` 동기화 블록, sync 블록)

**Interfaces:**
- Consumes: `syncPull`, `flushQueue`, `loadAll`, `sbReady`
- Produces: `async function syncNow(): Promise<void>`

- [ ] **Step 1: syncNow 함수 추가**

sync 블록에 추가:

```javascript
async function syncNow(){
  if(!sbReady()){toast('동기화 설정을 먼저 입력하세요');return;}
  try{await flushQueue();await syncPull();await loadAll();toast('동기화 완료');}
  catch(e){toast('동기화 실패: '+e.message);}
}
```

- [ ] **Step 2: 버튼 추가**

Task 1에서 추가한 `#syncStatus` div 바로 위(동기화 저장 버튼 row 안)에 버튼 추가 — 해당 row를 아래로 교체:

```html
    <div class="row" style="margin-top:10px;">
      <button class="ghost sm grow" onclick="syncNow()">지금 동기화</button>
      <button class="secondary grow" onclick="saveSyncConfig()">동기화 저장</button>
    </div>
```

- [ ] **Step 3: 단일 기기 회귀 검증 (미설정 시 무해)**

preview_eval로 설정을 모두 비우고:
```javascript
SB_URL='';SB_KEY='';SYNC_CODE='';
await idbPut('vocab',{id:'reg1',term:'offline-ok',videoId:'v1'});
const g=await idbGet('vocab','reg1');
JSON.stringify({saved:g.term, queued:_queue.length});
```
Expected: `{"saved":"offline-ok","queued":0}` — 미설정이면 큐잉 없이 정상 저장.

- [ ] **Step 4: 엔드투엔드 교차기기 검증 (실제 Supabase 필요)**

전제: 사용자가 Supabase 프로젝트 + 테이블(Task 6 SQL)을 만들고 URL/anon 키를 제공.

1. 브라우저 프로필 A(또는 일반 창)에서 `index.html` 열기 → 설정에 URL/키 입력, "새 코드"로 코드 생성 후 저장. 단어 1개 추가.
2. 프로필 B(또는 시크릿 창)에서 같은 `index.html` 열기 → 설정에 같은 URL/키 + **같은 코드** 입력, 저장.
3. B에서 "지금 동기화" → A에서 추가한 단어가 B 라이브러리에 나타나는지 확인.
4. B에서 단어 1개 추가 → A에서 "지금 동기화" → A에 나타나는지 확인.
5. A에서 단어 1개 삭제 → B에서 "지금 동기화" → B에서도 사라지는지 확인(소프트 삭제 전파).

Expected: 양방향 추가·삭제가 모두 반대 기기에 반영됨.

> 실 Supabase가 없으면 이 스텝은 Task 6 설정 완료 후로 보류하고, Step 3 회귀 검증 통과로 코드 머지는 진행 가능.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(sync): add manual 'sync now' button and finalize sync flow"
```

---

## Task 6: Supabase 설정 가이드 문서

사용자가 따라할 수 있는 Supabase 프로젝트·테이블 생성 가이드를 작성한다(복붙용 SQL 포함).

**Files:**
- Create: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: 없음 (문서)
- Produces: 없음

- [ ] **Step 1: 가이드 문서 작성**

`docs/supabase-setup.md` 생성:

````markdown
# Supabase 동기화 설정 (1회)

## 1. 프로젝트 만들기
1. https://supabase.com 가입(무료) → "New project" 생성.
2. 프로젝트 생성 후 **Settings → API**에서 두 값을 복사:
   - **Project URL** (예: `https://abcd1234.supabase.co`)
   - **anon public** key (긴 `eyJ...` 문자열)

## 2. 테이블 만들기
좌측 **SQL Editor → New query**에 아래를 붙여넣고 **Run**:

```sql
create table if not exists vocab (
  sync_code text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at bigint not null,
  primary key (sync_code, id)
);
create table if not exists videos (
  sync_code text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at bigint not null,
  primary key (sync_code, id)
);
-- 단일 사용자 개인 앱: anon 키로 읽기/쓰기 허용
alter table vocab  enable row level security;
alter table videos enable row level security;
create policy vocab_all  on vocab  for all using (true) with check (true);
create policy videos_all on videos for all using (true) with check (true);
```

## 3. 앱에 연결
1. 앱 우측 상단 **설정(⚙️)** 열기 → "기기 간 동기화" 섹션.
2. **Supabase URL**, **anon key** 붙여넣기.
3. **새 코드** 버튼으로 동기화 코드 생성(예: `tablo-7h3k-9m2x`) → **동기화 저장**.
4. 다른 기기에서 같은 화면에 같은 URL·키·**같은 코드**를 입력하면 데이터가 맞춰집니다.

## 보안 메모
- 동기화 코드가 곧 접근 열쇠입니다. 길고 랜덤이라 추측은 어렵지만, 코드를 아는 사람은 데이터를 볼 수 있습니다.
- 더 강한 보안(이메일 로그인/코드 기반 RLS)은 추후 확장 항목입니다.
````

- [ ] **Step 2: Commit**

```bash
git add docs/supabase-setup.md
git commit -m "docs: add Supabase cross-device sync setup guide"
```

---

## Self-Review 결과

- **Spec coverage:** 동기화 코드(Task 1), 텍스트만(SYNCED_STORES=vocab/videos, Task 3), Supabase 2테이블+컬럼(Task 6 SQL), 시작 시 pull/변경 시 push(Task 3·4), 항목 단위 LWW(syncResolve, Task 2·4), 소프트 삭제(Task 3 idbDel/ Task 4 delete), 오프라인 큐(Task 3), REST fetch·새 라이브러리 없음(Task 2), 키/녹음 제외(SYNCED_STORES로 한정), 설정 단계 안내(Task 6) — 스펙 항목 모두 태스크에 매핑됨.
- **Placeholder scan:** "추후/TBD"는 스펙의 비목표(향후 항목)로만 등장. 모든 코드 스텝에 실제 코드 포함. 없음.
- **Type consistency:** 행 형태 `{sync_code,id,data,deleted,updated_at}`가 sbUpsert/sbSelect/queuePush/syncPull/syncResolve 전반에서 일치. 로컬 타임스탬프 필드는 `updatedAt`(객체 내부), 원격 컬럼은 `updated_at`로 일관 구분. `SYNCED_STORES`, `SYNC_APPLYING`, `sbReady` 명칭 전 태스크 동일.
