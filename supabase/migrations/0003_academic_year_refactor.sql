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

update public.students s
set
  academic_year_id = coalesce(
    s.academic_year_id,
    (select id from public.academic_years where is_active = true limit 1),
    (select id from public.academic_years order by created_at desc limit 1)
  ),
  cohort_id = coalesce(
    s.cohort_id,
    (select c.id from public.cohorts c order by c.name desc limit 1)
  )
where s.academic_year_id is null or s.cohort_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'grade_level_id'
  ) then
    alter table public.students drop constraint if exists students_grade_level_id_fkey;
    alter table public.students drop column grade_level_id;
  end if;
end $$;

alter table public.students alter column cohort_id set not null;
alter table public.students alter column academic_year_id set not null;

create index if not exists idx_students_tz on public.students (tz);
create index if not exists idx_exam_students_exam on public.exam_students (exam_id);
create index if not exists idx_exam_students_student on public.exam_students (student_id);

create unique index if not exists idx_cyp_one_a_per_year
  on public.cohort_year_placements (academic_year_id)
  where (grade_level = 'A'::public.cohort_grade_level);

create unique index if not exists idx_cyp_one_b_per_year
  on public.cohort_year_placements (academic_year_id)
  where (grade_level = 'B'::public.cohort_grade_level);

update public.exams e
set academic_year_id = y.id
from public.academic_years y
where e.academic_year_id is null
  and y.is_active = true;

update public.teacher_assignments ta
set academic_year_id = y.id
from public.academic_years y
where ta.academic_year_id is null
  and y.is_active = true;

alter table public.exams alter column academic_year_id set not null;
alter table public.teacher_assignments alter column academic_year_id set not null;
