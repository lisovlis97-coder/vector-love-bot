-- Vector Love bot: manual profile verification (v8)

alter table public.users
  add column if not exists is_verified boolean not null default false,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_requested_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by bigint;

update public.users
set verification_status = case
  when is_verified then 'verified'
  when verification_status not in ('unverified', 'pending', 'verified', 'rejected') then 'unverified'
  else verification_status
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_verification_status_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_verification_status_check
      check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
  end if;
end
$$;

create index if not exists users_pending_verification_idx
  on public.users (verification_requested_at)
  where verification_status = 'pending';
