// 자동 생성: npm run extract (scripts/extract-legacy.mjs) — 원본 legacy/index.html. 직접 수정 금지.

const STOP = new Set(['ones',"one's",'someone','something','the','a','an','to','of','for','with','my','your','his','her','our','their','i']);
function exprWords(expr){
  return expr.toLowerCase().replace(/\([^)]*\)/g,' ').replace(/["“”.,]/g,' ')
    .split(/\s+/).filter(w=>w && !STOP.has(w) && w.length>1);
}
function variants(w){
  const v=new Set([w]);
  if(w.endsWith('e')){ v.add(w.slice(0,-1)+'ing'); v.add(w+'d'); v.add(w+'s'); }
  else if(w.endsWith('y')){ v.add(w.slice(0,-1)+'ies'); v.add(w.slice(0,-1)+'ied'); v.add(w+'ing'); }
  else { v.add(w+'s'); v.add(w+'ed'); v.add(w+'ing'); v.add(w+w.slice(-1)+'ing'); v.add(w+w.slice(-1)+'ed'); }
  return [...v];
}


// 기기마다 음성 품질 편차가 크다. 신경망(Natural/Neural/Online) 음성을 최우선으로,
// 구형 저품질 음성(compact, eSpeak, 구 SAPI)을 뒤로 보낸다.
function voiceScore(v){
  const n=(v.name||'').toLowerCase(), lang=(v.lang||'').replace('_','-').toLowerCase();
  let s=0;
  if(/natural|neural/.test(n)) s+=100;
  if(/online/.test(n)) s+=60;
  if(/google/.test(n)) s+=55;
  if(/siri/.test(n)) s+=50;
  if(/premium|enhanced/.test(n)) s+=45;
  if(/samantha|ava|allison|serena|zoe|evan|nathan|joelle/.test(n)) s+=35;
  if(/compact|eloquence|espeak|pico/.test(n)) s-=60;
  if(/\b(david|zira|mark|hazel)\b/.test(n)) s-=25;
  if(v.localService===false) s+=8;
  if(/^en-us/.test(lang)) s+=12;
  else if(/^en-(gb|au|ca|ie|nz)/.test(lang)) s+=6;
  return s;
}
function rankVoices(voices){
  return voices.filter(v=>/^en/i.test(v.lang||''))
    .map(function(v,i){ return {v:v, s:voiceScore(v), i:i}; })
    .sort(function(a,b){ return b.s-a.s || a.i-b.i; })
    .map(function(x){ return x.v; });
}


const QTENSES = ['present','past','future','progressive'];
const QLEVEL = 'B1';
const QSIZE = 5;
const QPASS = 0.8;

const QCONTRACTIONS = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'],
  [/\bi'm\b/g, 'i am'],
  [/\blet's\b/g, 'let us'],
  [/\b(i|we|you|they|he|she|it|that|there|who|what)'ll\b/g, '$1 will'],
  [/\b(i|we|you|they|there|who|what)'ve\b/g, '$1 have'],
  [/\b(we|you|they|there|who|what)'re\b/g, '$1 are'],
  [/\b(i|we|you|they|he|she|it|there|who|what)'d\b/g, '$1 would'],
  [/\b(he|she|it|that|there|here|what|who|everyone|everything)'s\b/g, '$1 is']
];

function qNorm(s){
  let t = (s == null ? '' : String(s)).toLowerCase().replace(/[\u2018\u2019\u02BC`\u00B4]/g, "'");
  for(const [re, rep] of QCONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/'/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function qTokens(s){
  const n = qNorm(s);
  return n ? n.split(' ') : [];
}

function qContent(tokens){ return tokens.filter(w => !STOP.has(w)); }

function qBag(tokens){
  const b = Object.create(null);
  for(const w of tokens) b[w] = (b[w] || 0) + 1;
  return b;
}

// 모범답안 내용어 중 사용자가 쓰지 못한 것 (다중집합 차집합)
function qMissing(userT, modelT){
  const bag = qBag(qContent(userT)), out = [];
  for(const w of qContent(modelT)){
    if(bag[w] > 0) bag[w]--; else out.push(w);
  }
  return out;
}

// 사용자가 썼지만 모범답안에 없는 내용어
function qExtra(userT, modelT){
  const bag = qBag(qContent(modelT)), out = [];
  for(const w of qContent(userT)){
    if(bag[w] > 0) bag[w]--; else out.push(w);
  }
  return out;
}

function qRatio(userT, modelT){
  const model = qContent(modelT);
  if(!model.length) return 1;
  return (model.length - qMissing(userT, modelT).length) / model.length;
}

// 핵심 표현 단어가 어형변화를 포함해 모두 들어있는가
function qHasExpression(userT, expression){
  const words = exprWords(expression || '');
  if(!words.length) return true;
  const set = new Set(userT);
  return words.every(w => variants(w).some(v => set.has(qNorm(v))));
}

function qGrade(userText, expression, modelEn){
  const u = qTokens(userText);
  if(!u.length) return {ok:false, ratio:0, hasExpr:false, missing:qContent(qTokens(modelEn)), extra:[]};
  const m = qTokens(modelEn);
  const hasExpr = qHasExpression(u, expression);
  const ratio = qRatio(u, m);
  return {ok: hasExpr && ratio >= QPASS, ratio, hasExpr, missing: qMissing(u, m), extra: qExtra(u, m)};
}

// 문장 id = "<folderId>|<cardIndex>|<tense>"
function qBuildPool(folders){
  const out = [];
  folders.forEach(f => f.cards.forEach((c, i) => {
    if(!c.practice || !c.practice[QLEVEL]) return;
    QTENSES.forEach(t => { if(c.practice[QLEVEL][t]) out.push(f.id + '|' + i + '|' + t); });
  }));
  return out;
}

function qLookup(folders, id){
  const parts = String(id).split('|');
  if(parts.length !== 3) return null;
  const f = folders.find(x => x.id === parts[0]);
  if(!f) return null;
  const c = f.cards[+parts[1]];
  if(!c || !c.practice || !c.practice[QLEVEL]) return null;
  const cell = c.practice[QLEVEL][parts[2]];
  if(!cell) return null;
  return {id:String(id), folderId:f.id, titleKo:f.titleKo, expression:c.expression,
          meaningKo:c.meaningKo, tense:parts[2], ko:cell.ko, en:cell.en};
}

// 큐를 QSIZE개로 채운다. 이미 큐에 있거나 완료한 문장은 제외.
// 남은 문장이 부족하면 QSIZE 미만으로 둔다.
function qRefill(queue, pool, completed, rand){
  const r = rand || Math.random;
  const used = new Set(queue);
  for(const k in completed) used.add(k);
  const avail = pool.filter(id => !used.has(id));
  const q = queue.slice();
  while(q.length < QSIZE && avail.length){
    q.push(avail.splice(Math.floor(r() * avail.length), 1)[0]);
  }
  return q;
}

function qShuffle(arr, rand){
  const r = rand || Math.random, a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(r() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}


// 타일에는 문장부호를 떼고 보여준다 (정답 비교도 같은 기준)
function qzWords(en){
  return String(en).split(/\s+/)
    .map(function(w){ return w.replace(/^[^A-Za-z0-9']+/, '').replace(/[^A-Za-z0-9']+$/, ''); })
    .filter(Boolean);
}

export { STOP, exprWords, variants, qNorm, qTokens, qContent, qRatio, qHasExpression, qMissing, qExtra, qGrade, QTENSES, qBuildPool, qLookup, qRefill, qShuffle, qzWords, voiceScore, rankVoices };
