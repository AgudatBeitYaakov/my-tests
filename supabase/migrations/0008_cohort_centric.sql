do $$ begin
  create type public.student_grade_level as enum ('א', 'ב');
exception when duplicate_object then null;
end $$;

alter table public.cohorts add column if not exists grade_level public.student_grade_level;
alter table public.cohorts add column if not exists is_current boolean not null default false;
alter table public.cohorts add column if not exists is_archived boolean not null default false;

update public.cohorts c
set name = coalesce(nullif(trim(c.name), ''), c.number::text)
where c.name is null or trim(c.name) = '';

do $$
declare
  yid uuid;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'year_cohorts') then
    select id into yid from public.academic_years where is_active = true limit 1;
    if yid is null then
      select id into yid from public.academic_years order by created_at desc limit 1;
    end if;
    if yid is not null then
      update public.cohorts c
      set
        grade_level = yc.grade_level,
        is_current = true,
        is_archived = false
      from public.year_cohorts yc
      where yc.academic_year_id = yid and yc.cohort_id = c.id;
      update public.cohorts set is_archived = true, is_current = false
      where id not in (select cohort_id from public.year_cohorts where academic_year_id = yid);
    end if;
  end if;
end $$;

update public.cohorts set is_current = true, is_archived = false
where grade_level is not null and not exists (select 1 from public.cohorts c2 where c2.is_current);

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

alter table public.students drop column if exists academic_year_id;
alter table public.students drop column if exists cohort_number;
alter table public.students drop column if exists grade_level;
alter table public.students alter column cohort_id set not null;

alter table public.teacher_assignments add column if not exists cohort_id uuid references public.cohorts (id) on delete restrict;

do $$
declare
  ca uuid;
  cb uuid;
begin
  select id into ca from public.cohorts where is_current = true and grade_level = 'א' limit 1;
  select id into cb from public.cohorts where is_current = true and grade_level = 'ב' limit 1;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teacher_assignments' and column_name = 'grade_level'
  ) then
    update public.teacher_assignments ta
    set cohort_id = ca
    where ta.grade_level = 'א' and ta.cohort_id is null and ca is not null;
    update public.teacher_assignments ta
    set cohort_id = cb
    where ta.grade_level = 'ב' and ta.cohort_id is null and cb is not null;
  end if;
end $$;

alter table public.teacher_assignments drop column if exists grade_level;
alter table public.teacher_assignments drop column if exists academic_year_id;

alter table public.exams add column if not exists cohort_id uuid references public.cohorts (id) on delete restrict;

do $$
declare
  ca uuid;
begin
  select id into ca from public.cohorts where is_current = true and grade_level = 'א' limit 1;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exams' and column_name = 'academic_year_id'
  ) then
    update public.exams e
    set cohort_id = ca
    where e.cohort_id is null and ca is not null;
  end if;
end $$;

alter table public.exams drop column if exists academic_year_id;

drop table if exists public.year_cohorts cascade;

create index if not exists idx_cohorts_current on public.cohorts (is_current) where is_current = true;
create index if not exists idx_cohorts_archived on public.cohorts (is_archived);
create index if not exists idx_students_cohort on public.students (cohort_id);
create index if not exists idx_exams_cohort on public.exams (cohort_id);
create index if not exists idx_teacher_assignments_cohort on public.teacher_assignments (cohort_id);

notify pgrst, 'reload schema';
