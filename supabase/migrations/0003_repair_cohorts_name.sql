alter table public.cohorts add column if not exists name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cohorts'
      and column_name = 'cohort_number'
  ) then
    update public.cohorts
    set name = cohort_number::text
    where name is null;
  end if;
end $$;

update public.cohorts set name = '1' where name is null;

alter table public.cohorts alter column name set not null;

alter table public.cohorts drop constraint if exists cohorts_cohort_number_key;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cohorts'
      and column_name = 'cohort_number'
  ) then
    alter table public.cohorts drop column cohort_number;
  end if;
end $$;

create unique index if not exists idx_cohorts_name on public.cohorts (name);
