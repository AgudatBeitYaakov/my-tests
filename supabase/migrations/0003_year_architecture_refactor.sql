do $$ begin
  create type public.student_status as enum ('active', 'left', 'graduated');
exception when duplicate_object then null;
end $$;

alter table public.academic_years add column if not exists cohort_a_id uuid references public.cohorts (id) on delete restrict;
alter table public.academic_years add column if not exists cohort_b_id uuid references public.cohorts (id) on delete restrict;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'cohort_year_placements'
  ) then
    update public.academic_years y
    set cohort_a_id = p.cohort_id
    from public.cohort_year_placements p
    where p.academic_year_id = y.id
      and p.grade_level = 'A'::public.cohort_grade_level
      and y.cohort_a_id is null;

    update public.academic_years y
    set cohort_b_id = p.cohort_id
    from public.cohort_year_placements p
    where p.academic_year_id = y.id
      and p.grade_level = 'B'::public.cohort_grade_level
      and y.cohort_b_id is null;
  end if;
end $$;

update public.academic_years y
set
  cohort_a_id = coalesce(y.cohort_a_id, c.id),
  cohort_b_id = coalesce(y.cohort_b_id, c.id)
from public.cohorts c
where y.name = 'ברירת מחדל' and c.name = '1'
  and (y.cohort_a_id is null or y.cohort_b_id is null);

alter table public.students add column if not exists status public.student_status not null default 'active';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'grade_level_id'
  ) then
    alter table public.students drop constraint if exists students_grade_level_id_fkey;
    alter table public.students drop column grade_level_id;
  end if;
end $$;

drop table if exists public.cohort_year_placements cascade;

alter table public.students alter column cohort_id set not null;
alter table public.students alter column academic_year_id set not null;

alter table public.academic_years drop constraint if exists academic_years_cohorts_different;
alter table public.academic_years add constraint academic_years_cohorts_different
  check (cohort_a_id is distinct from cohort_b_id);

create unique index if not exists idx_students_tz on public.students (tz);
create index if not exists idx_students_academic_year on public.students (academic_year_id);
create index if not exists idx_students_cohort on public.students (cohort_id);
create index if not exists idx_exams_academic_year on public.exams (academic_year_id);
create index if not exists idx_exams_teacher on public.exams (teacher_id);
create index if not exists idx_teacher_assignments_year on public.teacher_assignments (academic_year_id);
create index if not exists idx_exam_students_exam on public.exam_students (exam_id);
create index if not exists idx_exam_students_student on public.exam_students (student_id);
create index if not exists idx_makeup_exams_student on public.makeup_exams (student_id);
create index if not exists idx_academic_years_cohort_a on public.academic_years (cohort_a_id);
create index if not exists idx_academic_years_cohort_b on public.academic_years (cohort_b_id);

update public.exams e
set academic_year_id = y.id
from public.academic_years y
where e.academic_year_id is null and y.is_active = true;

update public.teacher_assignments ta
set academic_year_id = y.id
from public.academic_years y
where ta.academic_year_id is null and y.is_active = true;

alter table public.exams alter column academic_year_id set not null;
alter table public.teacher_assignments alter column academic_year_id set not null;
