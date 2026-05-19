alter table public.users drop column if exists role;
alter table public.users add column if not exists deleted_at timestamptz;
alter table public.users alter column full_name set default '';

-- אפשר ליצור מחדש שם משתמש שנמחק (soft delete)
alter table public.users drop constraint if exists users_username_key;
drop index if exists public.users_username_active_key;
drop index if exists users_username_active_key;
create unique index if not exists users_username_active_key
  on public.users (username)
  where deleted_at is null;

notify pgrst, 'reload schema';
