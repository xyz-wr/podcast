// 자동 생성: npm run extract (scripts/extract-legacy.mjs) — 원본 legacy/index.html. 직접 수정 금지.

// ── 빈칸 생성: 표현을 슬롯으로 분해해 문장 속 위치를 찾는다 ──
const VK_IRR = {
  have:['has','had','having'], do:['does','did','done','doing'], go:['goes','went','gone','going'],
  get:['gets','got','gotten','getting'], make:['made'], take:['took','taken'], hit:['hitting'],
  cut:['cutting'], give:['gave','given'], bring:['brought'], buy:['bought'], catch:['caught'],
  sing:['sang','sung'], throw:['threw','thrown'], see:['saw','seen','seeing','sees'], find:['found'],
  feel:['felt'], keep:['kept'], lay:['laid','lays','laying'], lose:['lost'], put:['putting'],
  run:['ran','running'], say:['said','says'], sell:['sold'], set:['setting'], shoot:['shot'],
  sleep:['slept'], stand:['stood'], sweep:['swept'], tie:['tied','tying','ties'], come:['came'],
  grow:['grew','grown'], blow:['blew','blown'], break:['broke','broken'], fall:['fell','fallen'],
  hang:['hung'], leave:['left'], let:['letting'], pay:['paid','pays','paying'], spend:['spent'],
  split:['splitting'], tell:['told'], think:['thought'], meet:['met'], sit:['sat','sitting'],
  drive:['drove','driven'], eat:['ate','eaten'], know:['knew','known'], read:['reading'],
  ride:['rode','ridden'], win:['won','winning'], wear:['wore','worn'], swim:['swam','swum'],
  begin:['began','begun','beginning'], choose:['chose','chosen'], forget:['forgot','forgotten'],
  hear:['heard'], hold:['held'], lead:['led'], light:['lit'], mean:['meant'], send:['sent'],
  show:['shown'], stick:['stuck'], teach:['taught'], understand:['understood'], wake:['woke','woken'],
  write:['wrote','written'], beat:['beaten'], bite:['bit','bitten'], draw:['drew','drawn'],
  fly:['flew','flown'], shake:['shook','shaken'], steal:['stole','stolen'], swing:['swung'],
  spin:['spun'], dig:['dug'], lie:['lain','lying','lies'], die:['dying'], ring:['rang','rung'],
  sweat:['sweated'], fit:['fitting'], quit:['quitting'], forgive:['forgave','forgiven'],
  "can\u0027t":["couldn\u0027t",'cannot'], can:['could'], will:['would'], "won\u0027t":["wouldn\u0027t"]
};
const VK_BE = ['be','am','is','are','was','were','been','being'];
const VK_ART = ['a','an','the'];
const VK_POSS = ['my','your','his','her','our','their','its',"one\u0027s",'ones'];
const VK_REFL = ['myself','yourself','himself','herself','itself','ourselves','yourselves','themselves','oneself'];
const VK_OPTPRON = ['it','them','him','me','us'];
const VK_PREP = ['to','with','for','on','at','in','of','about','from','into','up'];
const VK_WILD_ALT = ['him/her','his/her','the dog/cat','date/time','he/she'];

const VK_LEMMA = Object.create(null);
Object.keys(VK_IRR).forEach(b => VK_IRR[b].forEach(x => { if(!VK_LEMMA[x]) VK_LEMMA[x] = b; }));
VK_BE.forEach(x => { VK_LEMMA[x] = 'be'; });

function vkRegular(w, f){
  if(/e$/.test(w)){ f.add(w + 's'); f.add(w + 'd'); f.add(w.slice(0, -1) + 'ing'); }
  else if(/[aeiou]y$/.test(w)){ f.add(w + 's'); f.add(w + 'ed'); f.add(w + 'ing'); }
  else if(/y$/.test(w)){ f.add(w.slice(0, -1) + 'ies'); f.add(w.slice(0, -1) + 'ied'); f.add(w + 'ing'); }
  else {
    f.add(w + 's'); f.add(w + 'ed'); f.add(w + 'ing');
    if(/(s|sh|ch|x|z|o)$/.test(w)) f.add(w + 'es');
    if(/[^aeiou][aeiou][bdglmnprt]$/.test(w)){ f.add(w + w.slice(-1) + 'ing'); f.add(w + w.slice(-1) + 'ed'); }
  }
}
// 표현에 적힌 단어가 이미 변화형일 수 있어(sounds, warmed) 원형 후보도 함께 펼친다
function vkBases(w){
  const b = new Set([w]);
  if(VK_LEMMA[w]) b.add(VK_LEMMA[w]);
  if(w.length > 4){
    if(/ies$/.test(w)) b.add(w.slice(0, -3) + 'y');
    else if(/(s|sh|ch|x|z|o)es$/.test(w)) b.add(w.slice(0, -2));
    else if(/[^s]s$/.test(w)) b.add(w.slice(0, -1));
    if(/ied$/.test(w)) b.add(w.slice(0, -3) + 'y');
    else if(/ed$/.test(w)){ b.add(w.slice(0, -2)); b.add(w.slice(0, -1)); if(/([bdglmnprt])\1ed$/.test(w)) b.add(w.slice(0, -3)); }
    if(/ing$/.test(w)){ b.add(w.slice(0, -3)); b.add(w.slice(0, -3) + 'e'); if(/([bdglmnprt])\1ing$/.test(w)) b.add(w.slice(0, -4)); }
  }
  return b;
}
function vkForms(w){
  const f = new Set([w]);
  if(!/^[a-z]+(-[a-z]+)*$/.test(w)){ (VK_IRR[w] || []).forEach(x => f.add(x)); return f; }   // 축약형·숫자
  vkBases(w).forEach(b => {
    f.add(b);
    if(b === 'be') VK_BE.forEach(x => f.add(x));
    (VK_IRR[b] || []).forEach(x => f.add(x));
    vkRegular(b, f);
  });
  return f;
}

const VK_CONTR = {"\u0027s":['is','has','us'], "\u0027ve":['have'], "\u0027re":['are'], "\u0027m":['am'], "\u0027ll":['will'], "\u0027d":['would','had']};
function vkSplitContr(w){
  const m = /^(.+?)(\u0027s|\u0027ve|\u0027re|\u0027m|\u0027ll|\u0027d)$/.exec(w);
  return m ? [m[1], m[2]] : null;
}
// 단어 토큰. we've → we + 've(=have) 처럼 축약은 같은 글자 범위를 나눠 가진 두 토큰이 된다
function vkTokens(s){
  const out = [], re = /[A-Za-z0-9]+(?:[\u0027\u2019][A-Za-z]+)*(?:-[A-Za-z0-9]+(?:[\u0027\u2019][A-Za-z]+)*)*/g;
  let m;
  while((m = re.exec(String(s || '')))){
    const w = m[0].toLowerCase().replace(/\u2019/g, "\u0027"), sp = vkSplitContr(w);
    if(sp){
      const cut = m.index + sp[0].length;
      out.push({w: sp[0], ws: [sp[0]], s: m.index, e: cut});
      out.push({w: sp[1], ws: VK_CONTR[sp[1]], s: cut, e: m.index + m[0].length, host: out.length - 1});
    } else out.push({w, ws: [w], s: m.index, e: m.index + m[0].length});
  }
  return out;
}

// "A/B" 조각 길이가 다르면 짧은 쪽을 긴 쪽의 앞/뒤 단어로 보완한 후보도 만든다
function vkAltPieces(str){
  const pieces = str.split('/').map(p => p.trim()).filter(Boolean);
  const out = new Set(pieces);
  const words = pieces.map(p => p.split(/\s+/));
  const longest = words.reduce((a, b) => b.length > a.length ? b : a, []);
  words.forEach(w => {
    if(w.length >= longest.length) return;
    const k = longest.length - w.length;
    out.add(longest.slice(0, k).concat(w).join(' '));
    out.add(w.concat(longest.slice(longest.length - k)).join(' '));
  });
  return [...out];
}

function vkWordSlot(w){
  if(VK_POSS.includes(w)) return {k:'poss', opt:true};
  if(VK_REFL.includes(w)) return {k:'refl', opt:true};
  if(VK_ART.includes(w)) return {k:'lit', forms:new Set(VK_ART), opt:true, blank:true};
  if(VK_OPTPRON.includes(w)) return {k:'lit', forms:new Set([w]), opt:true, blank:true};
  return {k:'lit', forms:vkForms(w), opt:false, blank:true};
}

function vkSlots(piece){
  const slots = [], re = /\(([^)]*)\)|[a-z0-9]+(?:\u0027[a-z]+)*(?:-[a-z0-9]+)*/g;
  let m;
  while((m = re.exec(piece))){
    if(m[1] != null){
      const c = m[1].trim();
      if(c === "one\u0027s" || c === 'ones') slots.push({k:'poss', opt:true});
      else if(c === 'oneself') slots.push({k:'refl', opt:true});
      else if(c.includes('/') && !VK_WILD_ALT.includes(c))
        slots.push({k:'alt', opt:true, blank:true,
          seqs: vkAltPieces(c).map(p => p.split(/\s+/).map(w => vkForms(w)))});
      else slots.push({k:'wild', opt:true});
    } else if(m[0] === "let\u0027s" && !slots.length){
      // Let's kick things off…: 문장에서는 We kick things off… 로 자주 바뀐다
      slots.push({k:'lit', forms:new Set(['let']), opt:true, blank:true});
      slots.push({k:'lit', forms:new Set(['us']), opt:true, blank:true});
    } else {
      const sp = VK_POSS.includes(m[0]) ? null : vkSplitContr(m[0]);
      if(sp){
        slots.push(vkWordSlot(sp[0]));
        const f = new Set();
        VK_CONTR[sp[1]].forEach(x => vkForms(x).forEach(y => f.add(y)));
        slots.push({k:'lit', forms:f, opt:false, blank:true});
      } else slots.push(vkWordSlot(m[0]));
    }
  }
  // diagnose (someone) with (something): 자리표시 앞 마지막 전치사는 문장에서 빠지기도 한다
  const lastReq = slots.map(x => x.k === 'lit' && !x.opt).lastIndexOf(true);
  if(lastReq > 0 && lastReq < slots.length - 1 && slots.slice(lastReq + 1).every(x => !x.blank) &&
     VK_PREP.includes([...slots[lastReq].forms][0]) && slots.slice(0, lastReq).some(x => x.k === 'lit' && !x.opt))
    slots[lastReq].opt = true;
  while(slots.length && !slots[0].blank) slots.shift();
  while(slots.length && !slots[slots.length - 1].blank) slots.pop();
  return slots;
}

const VK_EXPR_CACHE = Object.create(null);
function vkParseExpr(expr){
  const key = String(expr || '');
  if(VK_EXPR_CACHE[key]) return VK_EXPR_CACHE[key];
  let e = key.toLowerCase().replace(/[\u2018\u2019]/g, "\u0027").replace(/[\u0022\u201C\u201D]/g, ' ')
    .replace(/[.?!,]+/g, ' ').replace(/\s+/g, ' ').trim();
  // 괄호 밖의 / 만 대안으로 나눈다
  const outer = e.replace(/\([^)]*\)/g, m => m.replace(/\//g, '\u0001'));
  const pieces = outer.includes('/') ? vkAltPieces(outer) : [outer];
  const cands = pieces.map(p => vkSlots(p.replace(/\u0001/g, '/'))).filter(s => s.some(x => x.blank));
  return (VK_EXPR_CACHE[key] = cands);
}

function vkHas(f, t){ return !!t && t.ws.some(x => f.has(x)); }
function vkSlotLens(sl, toks, p){
  const t = toks[p];
  if(!t) return [];
  if(sl.k === 'lit') return vkHas(sl.forms, t) ? [1] : [];
  if(sl.k === 'poss'){
    if(VK_POSS.includes(t.w)) return [1];
    const nx = toks[p + 1];
    return nx && nx.host === p && nx.w === "\u0027s" ? [2] : [];
  }
  if(sl.k === 'refl') return VK_REFL.includes(t.w) ? [1] : [];
  if(sl.k === 'alt'){
    const out = [];
    sl.seqs.forEach(seq => {
      if(seq.every((f, i) => vkHas(f, toks[p + i])) && !out.includes(seq.length)) out.push(seq.length);
    });
    return out;
  }
  return [];
}

const VK_MAXGAP = 3;
function vkMatchSlots(slots, toks){
  let best = null;
  const n = toks.length;
  function rec(si, ti, started, picked, gaps, start){
    if(si === slots.length){
      if(!picked.length) return;
      const score = picked.length - 1.5 * gaps;
      if(!best || score > best.score || (score === best.score && start < best.start))
        best = {score, idx: picked.slice(), start, gaps};
      return;
    }
    const sl = slots[si];
    if(sl.opt) rec(si + 1, ti, started, picked, gaps, start);
    if(sl.k === 'wild'){
      if(started) for(let m = 1; m <= 4 && ti + m <= n; m++) rec(si + 1, ti + m, started, picked, gaps, start);
      return;
    }
    const maxG = started ? VK_MAXGAP : 0;
    for(let g = 0; g <= maxG && ti + g < n; g++){
      const p = ti + g;
      vkSlotLens(sl, toks, p).forEach(L => {
        const add = [];
        if(sl.blank) for(let i = p; i < p + L; i++) add.push(i);
        rec(si + 1, p + L, true, picked.concat(add), gaps + g, start < 0 ? p : start);
      });
    }
  }
  for(let s = 0; s < n; s++) rec(0, s, false, [], 0, -1);
  return best;
}

// 문장 → [{t:'x', v:'보이는 글'} | {t:'b', v:'정답'}]. 못 찾으면 null
function vkBlank(en, expr){
  const toks = vkTokens(en);
  let best = null;
  vkParseExpr(expr).forEach(slots => {
    const m = vkMatchSlots(slots, toks);
    if(m && (!best || m.score > best.score || (m.score === best.score && m.start < best.start))) best = m;
  });
  if(!best) return null;
  const on = new Set(best.idx);
  toks.forEach((t, i) => { if(t.host != null){ if(on.has(t.host)) on.add(i); else on.delete(i); } });
  const idx = [...on].sort((a, b) => a - b);
  if(!idx.length) return null;
  const groups = [];
  idx.forEach(i => {
    const g = groups[groups.length - 1];
    if(g && g[1] === i - 1 && /^\s*$/.test(en.slice(toks[i - 1].e, toks[i].s))) g[1] = i;
    else groups.push([i, i]);
  });
  const segs = [];
  let pos = 0;
  groups.forEach(g => {
    const s = toks[g[0]].s, e = toks[g[1]].e;
    if(s > pos) segs.push({t:'x', v: en.slice(pos, s)});
    segs.push({t:'b', v: en.slice(s, e)});
    pos = e;
  });
  if(pos < en.length) segs.push({t:'x', v: en.slice(pos)});
  return segs;
}


// ── 채점 · 간격 반복 · 날짜 (순수 함수) ──
const VK_DAY = 864e5;
function vkRe(src){ return new RegExp(src, 'g'); }
const VK_CONTRACTIONS = [
  [vkRe('\\bwon\u0027t\\b'), 'will not'],
  [vkRe('\\bcan\u0027t\\b'), 'cannot'],
  [vkRe('\\bshan\u0027t\\b'), 'shall not'],
  [vkRe('n\u0027t\\b'), ' not'],
  [vkRe('\\bi\u0027m\\b'), 'i am'],
  [vkRe('\\blet\u0027s\\b'), 'let us'],
  [vkRe('\\b(i|we|you|they|he|she|it|that|there|who|what)\u0027ll\\b'), '$1 will'],
  [vkRe('\\b(i|we|you|they|there|who|what)\u0027ve\\b'), '$1 have'],
  [vkRe('\\b(we|you|they|there|who|what)\u0027re\\b'), '$1 are'],
  [vkRe('\\b(i|we|you|they|he|she|it|there|who|what)\u0027d\\b'), '$1 would'],
  [vkRe('\\b(he|she|it|that|there|here|what|who|everyone|everything)\u0027s\\b'), '$1 is']
];
function vkNorm(s){
  let t = (s == null ? '' : String(s)).toLowerCase().replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, '\u0027');
  VK_CONTRACTIONS.forEach(function(p){ t = t.replace(p[0], p[1]); });
  return t.replace(/\u0027/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function vkWords(s){ const n = vkNorm(s); return n ? n.split(' ') : []; }
// 빈칸 정답 비교: 대소문자·문장부호·축약형만 무시하고 나머지는 정확히
function vkSameAnswer(user, answer){ const a = vkNorm(answer); return a !== '' && vkNorm(user) === a; }
function vkHintOf(answer){
  return String(answer).replace(/\S+/g, function(w){
    const i = w.search(/[A-Za-z]/);
    return i < 0 ? w : w.slice(0, i + 1) + w.slice(i + 1).replace(/[A-Za-z]/g, '_');
  });
}

const VK_STOP = new Set(['ones','someone','something','the','a','an','to','of','for','with','my','your','his','her','our','their','i']);
function vkContent(t){ return t.filter(function(w){ return !VK_STOP.has(w); }); }
// a 의 내용어 중 b 에 없는 것 (다중집합 차집합)
function vkDiff(a, b){
  const bag = Object.create(null), out = [];
  vkContent(b).forEach(function(w){ bag[w] = (bag[w] || 0) + 1; });
  vkContent(a).forEach(function(w){ if(bag[w] > 0) bag[w]--; else out.push(w); });
  return out;
}
// 회화 로컬 채점 (퀴즈 탭 qGrade 와 같은 기준: 표현 사용 + 내용어 80%)
function vkGrade(userText, expression, modelEn){
  const u = vkWords(userText), m = vkWords(modelEn);
  const missing = vkDiff(m, u), extra = vkDiff(u, m);
  const mc = vkContent(m).length;
  const ratio = mc ? (mc - missing.length) / mc : 1;
  const hasExpr = u.length > 0 && !!vkBlank(String(userText), expression);
  return {ok: hasExpr && ratio >= 0.8, perfect: hasExpr && !missing.length && !extra.length,
          ratio: ratio, hasExpr: hasExpr, missing: missing, extra: extra};
}

// 간격 반복: 5분 → 1일 → 3일 → 1주 → 2주 → 1개월 → 2개월 → 4개월
const VK_STEPS = [5 * 60 * 1000, VK_DAY, 3 * VK_DAY, 7 * VK_DAY, 14 * VK_DAY, 30 * VK_DAY, 60 * VK_DAY, 120 * VK_DAY];
const VK_STEP_KO = ['5분','1일','3일','1주','2주','1개월','2개월','4개월'];
const VK_KNOWN_STEP = 2;
function vkReview(rec, ok, now, opts){
  const o = opts || {};
  const r = rec ? Object.assign({}, rec) : {s:0, due:0, n:0, ok:0, ng:0, first:now};
  r.n++; r.last = now;
  if(ok){
    r.ok++;
    if(o.failed) r.s = 1;                                   // 이번 세션에 틀렸던 카드
    else if(o.hinted) r.s = Math.max(1, rec ? rec.s : 1);   // 힌트를 봤으면 단계 유지
    else r.s = rec ? Math.min(VK_STEPS.length - 1, rec.s + 1) : VK_KNOWN_STEP;  // 처음 보고 맞히면 이미 아는 표현
  } else { r.ng++; r.s = 0; }
  r.due = now + VK_STEPS[r.s];
  return r;
}

function vkPad(n){ return (n < 10 ? '0' : '') + n; }
function vkDay(ts){ const d = new Date(ts); return d.getFullYear() + '-' + vkPad(d.getMonth() + 1) + '-' + vkPad(d.getDate()); }
function vkAddDays(ts, n){ const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }
function vkWeekStart(ts){ const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); }
// 오늘(아직 안 했으면 어제)부터 거꾸로 이어진 학습일 수
function vkStreak(days, now){
  let t = now, n = 0;
  if(!days.has(vkDay(t))) t = vkAddDays(t, -1);
  while(days.has(vkDay(t))){ n++; t = vkAddDays(t, -1); }
  return n;
}

// 따라 말하기: 모범 문장 단어마다 말한 문장에 있었는지
function vkShadow(model, said){
  const bag = Object.create(null);
  vkWords(said).forEach(function(w){ bag[w] = (bag[w] || 0) + 1; });
  let hit = 0, tot = 0;
  const parts = String(model).split(/\s+/).filter(Boolean).map(function(p){
    const ws = vkWords(p);
    if(!ws.length) return {p: p, ok: true};
    tot++;
    const ok = ws.every(function(w){ return bag[w] > 0; });
    if(ok){ ws.forEach(function(w){ bag[w]--; }); hit++; }
    return {p: p, ok: ok};
  });
  return {parts: parts, score: tot ? hit / tot : 0};
}
function vkShuffle(arr, rand){
  const r = rand || Math.random, a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// 순서 맞추기 타일: 앞뒤 문장부호를 떼고, 단어 안의 아포스트로피·하이픈은 둔다
function vkTileWords(en){
  return String(en).split(/\s+/).map(function(w){
    return w.replace(/^[^A-Za-z0-9\u0027\u2019]+/, '').replace(/[^A-Za-z0-9\u0027\u2019]+$/, '');
  }).filter(Boolean);
}
// 그날 학습한 표현: 일별 기록(log[day].k) + 이 기능 전 기록 복원(복습 기록의 처음/마지막 학습일, 오답 노트)
// s 는 출처 글자 모음: f 채우기 · c 회화 · q 퀴즈 · l 리스닝
function vkDayItems(dayLog, srs, wrongs, k){
  const map = Object.create(null);
  const add = function(key, src){
    const e = map[key] || (map[key] = {key: key, s: '', ok: 0, ng: 0});
    if(src && e.s.indexOf(src) < 0) e.s += src;
    return e;
  };
  Object.keys(srs || {}).forEach(function(key){
    const r = srs[key];
    if((r.first && vkDay(r.first) === k) || (r.last && vkDay(r.last) === k)) add(key, 'f');
  });
  (wrongs || []).forEach(function(w){ if(w.at && vkDay(w.at) === k) add(w.k, w.conv ? 'c' : 'f').ng++; });
  if(dayLog && dayLog.k) Object.keys(dayLog.k).forEach(function(key){
    const x = dayLog.k[key], e = add(key, '');
    String(x.s || '').split('').forEach(function(ch){ if(e.s.indexOf(ch) < 0) e.s += ch; });
    e.ok = Math.max(e.ok, x.ok || 0);
    e.ng = Math.max(e.ng, x.ng || 0);
  });
  return Object.keys(map).map(function(key){ return map[key]; });
}
// 달력 칸 색 단계: 그날 학습한 표현 수
function vkHeat(n){ return !n ? 0 : n < 5 ? 1 : n < 10 ? 2 : n < 20 ? 3 : 4; }
function vkMonth(ts){
  const d = new Date(ts), y = d.getFullYear(), m = d.getMonth();
  return {y: y, m: m, lead: new Date(y, m, 1).getDay(), days: new Date(y, m + 1, 0).getDate()};
}
// 두 기기의 보카 기록 합치기 (같은 결과를 다시 합쳐도 그대로 = 반복 동기화에 안전)
// 복습 단계: 더 나중에 학습한 쪽 · 날짜 기록/시제 집계: 큰 값 + 표현 목록 합집합 · 오답/테스트: 합집합
// 설정: 나중에 바꾼 쪽(setAt) · 퀴즈 최고 기록/회화 진도: 큰 값
function vkMergeState(a, b){
  const A = a || {}, B = b || {}, out = {};
  const both = function(f, fn){ [A[f] || {}, B[f] || {}].forEach(function(src){ Object.keys(src).forEach(function(k){ fn(k, src[k]); }); }); };
  out.srs = {};
  both('srs', function(k, x){
    const y = out.srs[k];
    if(!y || (x.last || 0) > (y.last || 0) || ((x.last || 0) === (y.last || 0) && (x.n || 0) > (y.n || 0))) out.srs[k] = x;
  });
  out.log = {};
  both('log', function(d, x){
    const y = out.log[d] || (out.log[d] = {});
    ['sec', 'xp', 'ok', 'ng', 'newc', 'known'].forEach(function(f){ if(x[f] != null) y[f] = Math.max(y[f] || 0, x[f]); });
    if(x.k){
      y.k = y.k || {};
      Object.keys(x.k).forEach(function(key){
        const p = x.k[key], q = y.k[key] || (y.k[key] = {s: '', ok: 0, ng: 0});
        String(p.s || '').split('').forEach(function(ch){ if(q.s.indexOf(ch) < 0) q.s += ch; });
        q.ok = Math.max(q.ok, p.ok || 0);
        q.ng = Math.max(q.ng, p.ng || 0);
      });
    }
  });
  out.ten = {};
  both('ten', function(t, x){
    const y = out.ten[t] || (out.ten[t] = {ok: 0, ng: 0});
    y.ok = Math.max(y.ok, x.ok || 0);
    y.ng = Math.max(y.ng, x.ng || 0);
  });
  const seenW = {};
  out.wrongs = (A.wrongs || []).concat(B.wrongs || []).filter(function(w){
    const id = w.k + '|' + w.at + '|' + (w.conv ? 'c' : 'f');
    if(seenW[id]) return false;
    seenW[id] = true;
    return true;
  }).sort(function(x, y){ return (y.at || 0) - (x.at || 0); }).slice(0, 60);
  const useB = !!B.set && (!A.set || (B.setAt || 0) >= (A.setAt || 0));
  out.set = Object.assign({}, useB ? B.set : A.set);
  out.setAt = Math.max(A.setAt || 0, B.setAt || 0);
  const qa = A.quiz || {}, qb = B.quiz || {};
  out.quiz = {best: Math.max(qa.best || 0, qb.best || 0), plays: Math.max(qa.plays || 0, qb.plays || 0)};
  out.conv = {};
  both('conv', function(fid, x){
    const y = out.conv[fid] || (out.conv[fid] = {best: 0, n: 0, at: 0});
    y.best = Math.max(y.best, x.best || 0);
    y.n = Math.max(y.n, x.n || 0);
    y.at = Math.max(y.at, x.at || 0);
  });
  const seenT = {};
  out.tests = (A.tests || []).concat(B.tests || []).filter(function(t){
    const id = t.day + '|' + t.est + '|' + t.lvl + '|' + JSON.stringify(t.acc || []);
    if(seenT[id]) return false;
    seenT[id] = true;
    return true;
  }).sort(function(x, y){ return String(x.day).localeCompare(String(y.day)); }).slice(-30);
  return out;
}

export { vkBlank, vkParseExpr, vkNorm, vkSameAnswer, vkHintOf, vkGrade, vkReview, VK_STEPS, VK_STEP_KO, VK_KNOWN_STEP, vkDay, vkAddDays, vkWeekStart, vkStreak, vkShadow, vkShuffle, VK_DAY, vkTileWords, vkDayItems, vkHeat, vkMonth, vkMergeState };
