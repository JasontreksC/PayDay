-- =============================================================================
-- PayDay - Supabase 초기 스키마
-- Supabase Dashboard → SQL Editor → New query 에서 전체 실행
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Custom Types
-- -----------------------------------------------------------------------------
create type public.transaction_type as enum ('income', 'expense');

-- -----------------------------------------------------------------------------
-- 2. profiles
--    Supabase Auth(auth.users) 와 1:1
--    회원가입 시 트리거로 자동 생성
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,

  currency  text not null default 'KRW',
  timezone  text not null default 'Asia/Seoul',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_format_chk
    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.profiles is '앱 사용자 프로필. auth.users 와 1:1';

-- -----------------------------------------------------------------------------
-- 3. categories
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
-- 4. transactions
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
  constraint transactions_memo_length_chk check (memo is null or char_length(memo) <= 200)
);

comment on table public.transactions is '일별 수입/지출 내역';
comment on column public.transactions.amount is '원화 정수 금액 (소수점 없음)';

-- -----------------------------------------------------------------------------
-- 5. Indexes
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
-- 6. updated_at 자동 갱신
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
-- 7. 회원가입 시 프로필 + 기본 카테고리 생성
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
-- 8. Row Level Security (RLS)
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
-- 9. 월별 통계 조회용 View (앱 핵심 기능 지원)
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
