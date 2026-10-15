// GA4 Data API 프록시 (Supabase Edge Function)
// 서비스 계정 키는 Secret(GA_SERVICE_ACCOUNT)에만 있고, 브라우저에는 집계 수치만 나간다.
// 대시보드에서 "Enforce JWT verification" 을 꺼 두고 쓴다 (앱의 sb_publishable 키는 JWT 가 아님).

const PROPERTY = Deno.env.get('GA_PROPERTY_ID') ?? '';
const SA = JSON.parse(Deno.env.get('GA_SERVICE_ACCOUNT') ?? '{}');
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const CACHE_MS = 5 * 60 * 1000;   // GA 할당량 보호: 같은 인스턴스에서 5분간 재사용

let token = { v: '', exp: 0 };
const cache = new Map<number, { at: number; body: string }>();

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 서비스 계정 JWT 로 OAuth 액세스 토큰을 받는다 (1시간 유효, 만료 1분 전까지 재사용)
async function accessToken(): Promise<string> {
  if (token.exp > Date.now() + 60_000) return token.v;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = String(SA.private_key).replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error('token: ' + (j.error_description || j.error || res.status));
  token = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.v;
}

type Row = Record<string, string | number>;

// runReport / runRealtimeReport 를 호출해 행을 {측정기준명: 값, 측정항목명: 숫자} 객체로 펼친다
async function ga(method: string, body: unknown): Promise<Row[]> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:${method}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(method + ': ' + (j.error?.message || res.status));
  const dims = (j.dimensionHeaders ?? []).map((h: { name: string }) => h.name);
  const mets = (j.metricHeaders ?? []).map((h: { name: string }) => h.name);
  return (j.rows ?? []).map((r: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => {
    const o: Row = {};
    dims.forEach((d: string, i: number) => { o[d] = r.dimensionValues![i].value; });
    mets.forEach((m: string, i: number) => { o[m] = Number(r.metricValues![i].value); });
    return o;
  });
}

// 로컬 테스트 접속은 통계에서 뺀다 (실시간 API 는 hostName 을 지원하지 않아 제외 불가)
const NOT_LOCAL = {
  notExpression: { filter: { fieldName: 'hostName', inListFilter: { values: ['localhost', '127.0.0.1'] } } },
};
const STEP_EVENTS = ['fill_complete', 'out_complete', 'quiz_complete'];

async function collect(days: number) {
  // 1일 = 오늘(집계 중, GA 처리가 끝나지 않아 나중에 늘어날 수 있음) → 직전 기간 비교는 하지 않는다
  // 7·30·90일 = 어제까지의 확정치 + 직전 같은 길이 기간과 비교
  const live = days === 1;
  const cur = live ? { startDate: 'today', endDate: 'today' } : { startDate: `${days}daysAgo`, endDate: 'yesterday' };
  const prev = { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` };
  const [realtime, summary, pages, steps, monthly] = await Promise.all([
    // 최근 30분 (오늘 "지금" 수치)
    ga('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }),
    // 기간 요약 + 직전 같은 길이 기간 (증감 비교용, 오늘 보기에서는 생략)
    ga('runReport', {
      dateRanges: live ? [{ ...cur, name: 'cur' }] : [{ ...cur, name: 'cur' }, { ...prev, name: 'prev' }],
      metrics: [{ name: 'activeUsers' }, { name: 'userEngagementDuration' }, { name: 'screenPageViews' }],
      dimensionFilter: NOT_LOCAL,
    }),
    // 탭(가상 페이지)별 조회수 · 참여 시간 · 사용자
    ga('runReport', {
      dateRanges: [cur],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }, { name: 'activeUsers' }],
      dimensionFilter: NOT_LOCAL,
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 30,
    }),
    // 보카 단계 완료 이벤트별 사용자 수 (순서는 반영하지 않음 — 정확한 유입경로는 GA 탐색에서)
    ga('runReport', {
      dateRanges: [cur],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }],
      dimensionFilter: { andGroup: { expressions: [
        { filter: { fieldName: 'eventName', inListFilter: { values: STEP_EVENTS } } },
        NOT_LOCAL,
      ] } },
    }),
    // 최근 12개월 월별 사용자 · 참여 시간
    ga('runReport', {
      dateRanges: [{ startDate: '365daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'yearMonth' }],
      metrics: [{ name: 'activeUsers' }, { name: 'userEngagementDuration' }],
      dimensionFilter: NOT_LOCAL,
      orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    }),
  ]);
  const zero = { activeUsers: 0, userEngagementDuration: 0, screenPageViews: 0 };
  const pick = (name: string) => {
    // 기간이 하나면 GA 가 dateRange 열을 붙이지 않는다 → 첫 행이 곧 cur
    const r = live ? (name === 'cur' ? summary[0] : undefined) : summary.find((x) => x.dateRange === name);
    return r ? { activeUsers: r.activeUsers, userEngagementDuration: r.userEngagementDuration, screenPageViews: r.screenPageViews } : zero;
  };
  return {
    generatedAt: new Date().toISOString(),
    days,
    live,
    realtime: { activeUsers: realtime[0]?.activeUsers ?? 0 },
    week: pick('cur'),   // 예전 응답과 이름을 맞춰 둔다 (값은 선택한 기간)
    prev: live ? null : pick('prev'),
    pages,
    steps,
    monthly,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const headers = { ...CORS, 'Content-Type': 'application/json' };
  if (!PROPERTY || !SA.client_email) {
    return new Response(JSON.stringify({ error: 'GA_PROPERTY_ID / GA_SERVICE_ACCOUNT secret 이 비어 있어요' }), { status: 500, headers });
  }
  const asked = Number(new URL(req.url).searchParams.get('days'));
  const days = [1, 7, 30, 90].includes(asked) ? asked : 7;
  try {
    let hit = cache.get(days);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      hit = { at: Date.now(), body: JSON.stringify(await collect(days)) };
      cache.set(days, hit);
    }
    return new Response(hit.body, { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 502, headers });
  }
});
