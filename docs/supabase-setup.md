# Supabase 동기화 설정 (1회)

여러 기기(컴퓨터·핸드폰)에서 단어·영상·예문을 같이 보려면 한 번만 아래 설정을 하면 됩니다.
녹음(오디오)과 AI 키는 동기화되지 않고, 텍스트 데이터만 기기 간에 맞춰집니다.

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
1. 앱에서 **설정** 화면(⚙️)을 열고 "기기 간 동기화" 섹션으로 이동.
2. **Supabase URL**, **anon key** 붙여넣기.
3. **새 코드** 버튼으로 동기화 코드 생성(예: `tablo-7h3k-9m2x`) → **동기화 저장**.
4. 다른 기기에서도 같은 화면에 같은 URL·키·**같은 코드**를 입력하면 데이터가 맞춰집니다.
5. 바로 맞추고 싶으면 **지금 동기화** 버튼을 누르세요. (평소엔 앱을 켤 때 자동으로 맞춰집니다.)

## 동작 방식 (참고)
- 단어·영상·예문을 추가/수정/삭제하면 자동으로 Supabase에 올라갑니다.
- 앱을 켤 때 내 동기화 코드의 데이터를 받아와 합칩니다(항목 단위로 더 최신 것이 이김).
- 인터넷이 없을 땐 변경이 잠시 보관됐다가, 연결되면 자동으로 올라갑니다.

## 보안 메모
- 동기화 코드가 곧 접근 열쇠입니다. 길고 랜덤이라 추측은 어렵지만, 코드를 아는 사람은 데이터를 볼 수 있습니다.
- 더 강한 보안(이메일 로그인/코드 기반 RLS)은 추후 확장 항목입니다.
