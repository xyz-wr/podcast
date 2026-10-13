# Supabase 동기화 설정 (1회)

여러 기기(컴퓨터·핸드폰)에서 단어·영상·예문과 보카 학습 기록을 같이 보려면 한 번만 아래 설정을 하면 됩니다.
녹음(오디오)은 동기화되지 않고, 텍스트 데이터(단어·영상·예문, Gemini 키, 보카 기록)만 기기 간에 맞춰집니다.

> SQL은 반드시 **Supabase 웹 화면의 SQL Editor**에서 실행하세요. MySQL Workbench 같은 다른 DB 도구에서 실행하면
> `Error Code: 1046` 등으로 실패하고, 만들어져도 앱이 그 DB에 연결하지 못합니다.

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
-- Gemini 키, 보카 학습 기록(k = 'voca_v1') 등 키-값 저장
create table if not exists kv (
  sync_code text not null,
  k text not null,
  v text,
  updated_at bigint not null,
  primary key (sync_code, k)
);
-- 앱이 모든 요청에 보내는 x-sync-code 헤더와 같은 동기화 코드의 행만 읽고 쓸 수 있게 한다.
-- (anon key 가 코드에 공개돼 있어도 동기화 코드를 모르면 아무 데이터도 볼 수 없음)
-- 정책을 지웠다가 다시 만들어서 여러 번 실행해도 오류가 나지 않음
alter table vocab  enable row level security;
alter table videos enable row level security;
alter table kv     enable row level security;
drop policy if exists vocab_all  on vocab;
drop policy if exists videos_all on videos;
drop policy if exists kv_all     on kv;
drop policy if exists vocab_by_code  on vocab;
drop policy if exists videos_by_code on videos;
drop policy if exists kv_by_code     on kv;
create policy vocab_by_code on vocab for all
  using      (sync_code = current_setting('request.headers', true)::json->>'x-sync-code')
  with check (sync_code = current_setting('request.headers', true)::json->>'x-sync-code');
create policy videos_by_code on videos for all
  using      (sync_code = current_setting('request.headers', true)::json->>'x-sync-code')
  with check (sync_code = current_setting('request.headers', true)::json->>'x-sync-code');
create policy kv_by_code on kv for all
  using      (sync_code = current_setting('request.headers', true)::json->>'x-sync-code')
  with check (sync_code = current_setting('request.headers', true)::json->>'x-sync-code');
```

이 정책은 x-sync-code 헤더를 보내는 앱 버전(2026-10-03 이후 배포)에서만 동작합니다. 예전 버전 탭이 열려 있으면 새로고침하세요.

SQL Editor는 붙여넣은 문장을 한 번에 실행해서, 중간에 하나라도 실패하면 앞의 테이블 생성까지 모두 취소됩니다.
같은 `create policy`를 두 번 넣지 마세요(위 스크립트는 그대로 여러 번 실행해도 됩니다).
실행 후 **Table Editor**에 `vocab`, `videos`, `kv` 세 테이블이 보이면 성공입니다.

## 3. 앱에 연결
1. 앱에서 **설정** 화면(⚙️)을 열고 "기기 간 동기화" 섹션으로 이동.
2. **Supabase URL**, **anon key** 붙여넣기.
3. **새 코드** 버튼으로 동기화 코드 생성(예: `tablo-7h3k-9m2x`) → **동기화 저장**.
4. 다른 기기에서도 같은 화면에 같은 URL·키·**같은 코드**를 입력하면 데이터가 맞춰집니다.
5. 바로 맞추고 싶으면 **지금 동기화** 버튼을 누르세요. (평소엔 앱을 켤 때 자동으로 맞춰집니다.)

## 동작 방식 (참고)
- 단어·영상·예문을 추가/수정/삭제하면 자동으로 Supabase에 올라갑니다.
- 앱을 켤 때 내 동기화 코드의 데이터를 받아와 합칩니다(항목 단위로 더 최신 것이 이김).
- 인터넷이 없을 땐 변경이 잠시 보관됐다가, 연결되면 자동으로 올라갑니다.
- **보카 학습 기록**(복습 단계, 날짜별 학습 기록·달력, 오답 노트, 레벨 테스트, 퀴즈 최고 기록, 설정)은
  `kv` 테이블의 `voca_v1` 한 줄에 저장됩니다. 학습하면 몇 초 뒤 자동으로 받아와 합친 뒤 올리고,
  앱을 켜거나 돌아올 때·**지금 동기화** 때도 맞춥니다. 보카 홈의 "학습 설정" 카드에 동기화 상태가 보입니다.
  두 기기에서 따로 공부해도 덮어쓰지 않고 합칩니다(복습 단계는 더 나중에 학습한 쪽, 날짜 기록·오답은 합집합,
  설정은 나중에 바꾼 쪽).
- 학습 진도(복습 단계)와 "최근 학습" 시각도 함께 동기화돼서, 한 기기에서 공부한 흐름을 다른 기기에서 이어갈 수 있습니다. 이 때문에 영상을 열거나 퀴즈를 풀 때마다 해당 영상/단어 데이터가 다시 올라갑니다(자막이 큰 영상은 데이터가 조금 클 수 있어요). 개인용 무료 한도에서는 문제없는 수준입니다.

## 보안 메모
- 동기화 코드가 곧 접근 열쇠입니다. 길고 랜덤이라 추측은 어렵지만, 코드를 아는 사람은 데이터를 볼 수 있습니다.
- 더 강한 보안(이메일 로그인/코드 기반 RLS)은 추후 확장 항목입니다.
