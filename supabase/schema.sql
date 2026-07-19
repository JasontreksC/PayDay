-- =============================================================================
-- PayDay - Supabase 전체 스키마 (단일 실행본)
--
-- 처음 한 번만 실행하면 앱 구동에 필요한 모든 객체가 구성됩니다.
-- Supabase Dashboard → SQL Editor → New query 에 전체를 붙여넣고 Run.
--
-- 포함 내용: 확장 / 타입 / 테이블(메모 클라이언트 암호화 vault 포함) /
--            인덱스 / updated_at 트리거 / 신규 가입 처리 / RLS / 월간 통계 뷰 /
--            회원 탈퇴 함수(delete_user)
--
-- 맨 위 "초기화" 블록이 기존 public 객체를 먼저 제거하므로, DB를 갈아엎고
-- 다시 세팅할 때 그대로 재실행해도 됩니다. (auth.users 데이터는 건드리지 않음)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 초기화 (재실행 안전용). 처음 세팅이면 아무 것도 지우지 않습니다.
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop view if exists public.monthly_transaction_stats;

drop table if exists public.transactions cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.delete_user() cascade;

drop type if exists public.transaction_type;

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. Custom Types
-- -----------------------------------------------------------------------------
create type public.transaction_type as enum ('income', 'expense');

-- -----------------------------------------------------------------------------
-- 3. profiles
--    Supabase Auth(auth.users) 와 1:1. 회원가입 시 트리거로 자동 생성.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,

  currency  text not null default 'KRW',
  timezone  text not null default 'Asia/Seoul',

  -- 클라이언트 전용 메모 암호화 vault (키 원문은 저장하지 않음)
  crypto_salt            text,
  wrapped_dek            text,
  crypto_salt_recovery   text,
  wrapped_dek_recovery   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_format_chk
    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.profiles is '앱 사용자 프로필. auth.users 와 1:1';
comment on column public.profiles.crypto_salt is
  'PBKDF2 salt (base64). 브라우저에서 비밀번호와 함께 KEK 유도에 사용';
comment on column public.profiles.wrapped_dek is
  '비밀번호 파생 키로 AES-GCM 래핑된 DEK (base64). 서버는 복호화 불가';
comment on column public.profiles.crypto_salt_recovery is
  '복구 키용 PBKDF2 salt (base64)';
comment on column public.profiles.wrapped_dek_recovery is
  '복구 키 파생 KEK로 AES-GCM 래핑된 DEK (base64). 서버는 복호화 불가';

-- -----------------------------------------------------------------------------
-- 4. categories
--    사용자별 수입/지출 카테고리 (선택)
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  type        public.transaction_type not null,
  icon        text,
  sort_order  integer not null default 0,
  is_default  boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_name_not_blank_chk check (length(trim(name)) > 0),
  constraint categories_user_name_type_uniq unique (user_id, name, type)
);

comment on table public.categories is '거래 카테고리. 사용자별로 수입/지출 분류';

-- -----------------------------------------------------------------------------
-- 5. transactions
--    가계부 핵심 엔터티
-- -----------------------------------------------------------------------------
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  category_id      uuid references public.categories (id) on delete set null,

  transaction_date date not null,
  type             public.transaction_type not null,
  amount           bigint not null,
  memo             text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_amount_positive_chk check (amount > 0),
  -- 메모는 UI에서 평문 50자 제한이지만, 클라이언트 암호화(v2: + 패딩 + base64)를
  -- 거치면 한글 50자 기준 최대 ~400자까지 늘어난다. 여유를 두고 500자로 제한.
  constraint transactions_memo_length_chk check (memo is null or char_length(memo) <= 500)
);

comment on table public.transactions is '일별 수입/지출 내역';
comment on column public.transactions.amount is '원화 정수 금액 (소수점 없음)';
comment on column public.transactions.memo is
  '클라이언트에서 AES-GCM 암호화된 메모(v2: 접두사). 서버는 복호화 불가';

-- -----------------------------------------------------------------------------
-- 6. Indexes
-- -----------------------------------------------------------------------------
create index categories_user_id_type_sort_idx
  on public.categories (user_id, type, sort_order);

create index transactions_user_id_date_idx
  on public.transactions (user_id, transaction_date desc);

create index transactions_user_id_type_date_idx
  on public.transactions (user_id, type, transaction_date desc);

create index transactions_category_id_idx
  on public.transactions (category_id)
  where category_id is not null;

-- -----------------------------------------------------------------------------
-- 7. updated_at 자동 갱신
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. 회원가입 시 프로필 + 기본 카테고리 생성
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.categories (user_id, name, type, sort_order, is_default) values
    (new.id, '급여',       'income',  1, true),
    (new.id, '부수입',     'income',  2, true),
    (new.id, '식비',       'expense', 1, true),
    (new.id, '교통',       'expense', 2, true),
    (new.id, '생활',       'expense', 3, true),
    (new.id, '쇼핑',       'expense', 4, true),
    (new.id, '기타',       'expense', 5, true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 9. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

-- profiles: 본인만 조회/수정
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- categories: 본인 것만 CRUD
create policy "categories_select_own"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- transactions: 본인 것만 CRUD
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 10. 월별 통계 조회용 View (앱 핵심 기능 지원)
-- -----------------------------------------------------------------------------
create or replace view public.monthly_transaction_stats
with (security_invoker = true)
as
select
  t.user_id,
  date_trunc('month', t.transaction_date)::date as month_start,
  t.type,
  count(*)::bigint as transaction_count,
  sum(t.amount)::bigint as total_amount
from public.transactions t
group by t.user_id, date_trunc('month', t.transaction_date), t.type;

comment on view public.monthly_transaction_stats is
  '사용자별 월간 수입/지출 집계. RLS가 적용된 transactions 기반';

-- -----------------------------------------------------------------------------
-- 11. 회원 탈퇴: 로그인한 사용자가 자신의 auth.users 레코드를 삭제
--     (profiles/categories/transactions 는 on delete cascade 로 함께 삭제됨)
-- -----------------------------------------------------------------------------
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user() from public;
grant execute on function public.delete_user() to authenticated;
