do $$ begin
  create type public.student_grade_level as enum ('א', 'ב');
exception when duplicate_object then null;
end $$;

alter table public.cohorts add column if not exists number int;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cohorts' and column_name = 'name'
  ) then
    update public.cohorts
    set number = coalesce(number, nullif(regexp_replace(name, '[^0-9]', '', 'g'), '')::int)
    where number is null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cohorts' and column_name = 'cohort_number'
  ) then
    update public.cohorts c
    set number = coalesce(c.number, c.cohort_number)
    where c.number is null;
  end if;
end $$;

update public.cohorts set number = 1 where number is null;
alter table public.cohorts alter column number set not null;
create unique index if not exists idx_cohorts_number on public.cohorts (number);

create table if not exists public.year_cohorts (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  grade_level public.student_grade_level not null,
  unique (academic_year_id, grade_level),
  unique (academic_year_id, cohort_id)
);

create index if not exists idx_year_cohorts_year on public.year_cohorts (academic_year_id);
create index if not exists idx_year_cohorts_cohort on public.year_cohorts (cohort_id);

alter table public.students add column if not exists cohort_id uuid references public.cohorts (id) on delete restrict;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'cohort_number'
  ) then
    update public.students s
    set cohort_id = c.id
    from public.cohorts c
    where c.number = s.cohort_number and s.cohort_id is null;
  end if;
end $$;

do $$
declare
  y record;
  c_a uuid;
  c_b uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_years' and column_name = 'cohort_a_id'
  ) then
    for y in select id, cohort_a_id, cohort_b_id from public.academic_years loop
      if y.cohort_a_id is not null then
        insert into public.year_cohorts (academic_year_id, cohort_id, grade_level)
        values (y.id, y.cohort_a_id, 'א'::public.student_grade_level)
        on conflict (academic_year_id, grade_level) do nothing;
      end if;
      if y.cohort_b_id is not null then
        insert into public.year_cohorts (academic_year_id, cohort_id, grade_level)
        values (y.id, y.cohort_b_id, 'ב'::public.student_grade_level)
        on conflict (academic_year_id, grade_level) do nothing;
      end if;
    end loop;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'grade_level'
  ) then
    for y in select distinct academic_year_id from public.students where academic_year_id is not null loop
      select s.cohort_id into c_a
      from public.students s
      where s.academic_year_id = y.academic_year_id and s.grade_level = 'א'::public.student_grade_level
      limit 1;
      select s.cohort_id into c_b
      from public.students s
      where s.academic_year_id = y.academic_year_id and s.grade_level = 'ב'::public.student_grade_level
      limit 1;
      if c_a is not null then
        insert into public.year_cohorts (academic_year_id, cohort_id, grade_level)
        values (y.academic_year_id, c_a, 'א'::public.student_grade_level)
        on conflict (academic_year_id, grade_level) do nothing;
      end if;
      if c_b is not null then
        insert into public.year_cohorts (academic_year_id, cohort_id, grade_level)
        values (y.academic_year_id, c_b, 'ב'::public.student_grade_level)
        on conflict (academic_year_id, grade_level) do nothing;
      end if;
    end loop;
  end if;
end $$;

alter table public.students drop column if exists cohort_number;
alter table public.students drop column if exists grade_level;
alter table public.students alter column cohort_id set not null;

alter table public.academic_years drop constraint if exists academic_years_cohort_a_id_fkey;
alter table public.academic_years drop constraint if exists academic_years_cohort_b_id_fkey;
alter table public.academic_years drop column if exists cohort_a_id;
alter table public.academic_years drop column if exists cohort_b_id;

alter table public.teacher_assignments add column if not exists grade_level public.student_grade_level;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teacher_assignments' and column_name = 'grade_level_id'
  ) then
    update public.teacher_assignments ta
    set grade_level = 'א'::public.student_grade_level
    from public.grade_levels gl
    where ta.grade_level_id = gl.id and gl.name in ('A', 'א') and ta.grade_level is null;
    update public.teacher_assignments ta
    set grade_level = 'ב'::public.student_grade_level
    from public.grade_levels gl
    where ta.grade_level_id = gl.id and gl.name in ('B', 'ב') and ta.grade_level is null;
    alter table public.teacher_assignments drop constraint if exists teacher_assignments_grade_level_id_fkey;
    alter table public.teacher_assignments drop column grade_level_id;
  end if;
end $$;

create index if not exists idx_students_cohort on public.students (cohort_id);
drop index if exists public.idx_students_cohort_number;

notify pgrst, 'reload schema';
