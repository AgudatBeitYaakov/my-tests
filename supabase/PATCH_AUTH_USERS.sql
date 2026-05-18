alter table public.users drop column if exists role;
alter table public.users add column if not exists deleted_at timestamptz;
alter table public.users alter column full_name set default '';
