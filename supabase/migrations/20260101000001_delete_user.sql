-- 회원 탈퇴: 로그인한 사용자가 자신의 auth.users 레코드를 삭제
-- Supabase SQL Editor에서 schema.sql 실행 후 이 파일도 실행

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
