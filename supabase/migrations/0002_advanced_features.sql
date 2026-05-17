do $$ begin
  create type public.cohort_grade_level as enum ('A', 'B', 'Archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_role as enum ('admin', 'secretary');
exception when duplicate_object then null;
end $$;

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_academic_years_one_active
  on public.academic_years (is_active)
  where is_active = true;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_number int not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.cohort_year_placements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  grade_level public.cohort_grade_level not null,
  unique (cohort_id, academic_year_id)
);

create index if not exists idx_cyp_year on public.cohort_year_placements (academic_year_id);
create index if not exists idx_cyp_cohort on public.cohort_year_placements (cohort_id);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  full_name text not null,
  role public.user_role not null default 'secretary',
  active boolean not null default true,
  auth_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action_type text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);

create table if not exists public.student_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  old_class_id uuid references public.classes (id) on delete set null,
  new_class_id uuid references public.classes (id) on delete set null,
  old_specialization_id uuid references public.specializations (id) on delete set null,
  new_specialization_id uuid references public.specializations (id) on delete set null,
  old_track_id uuid references public.tracks (id) on delete set null,
  new_track_id uuid references public.tracks (id) on delete set null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.users (id) on delete set null
);

create index if not exists idx_student_history_student on public.student_history (student_id, changed_at desc);

alter table public.students add column if not exists notes text;
alter table public.students add column if not exists cohort_id uuid references public.cohorts (id) on delete restrict;
alter table public.students add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;

alter table public.exams add column if not exists notes text;
alter table public.exams add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;

alter table public.makeup_exams add column if not exists notes text;

alter table public.teacher_assignments add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;

create unique index if not exists idx_exams_unique_slot
  on public.exams (academic_year_id, teacher_id, subject, target_type, target_id, exam_date)
  where academic_year_id is not null;

create index if not exists idx_students_academic_year on public.students (academic_year_id);
create index if not exists idx_students_cohort on public.students (cohort_id);
create index if not exists idx_exams_academic_year on public.exams (academic_year_id);
create index if not exists idx_teacher_assignments_year on public.teacher_assignments (academic_year_id);

insert into public.academic_years (name, is_active)
values ('ברירת מחדל', true)
on conflict (name) do nothing;

update public.academic_years set is_active = true where name = 'ברירת מחדל' and not exists (
  select 1 from public.academic_years where is_active = true and name <> 'ברירת מחדל'
);

insert into public.cohorts (cohort_number)
values (1)
on conflict (cohort_number) do nothing;

insert into public.cohort_year_placements (cohort_id, academic_year_id, grade_level)
select c.id, y.id, 'A'::public.cohort_grade_level
from public.cohorts c
cross join public.academic_years y
where c.cohort_number = 1 and y.name = 'ברירת מחדל'
on conflict (cohort_id, academic_year_id) do nothing;

update public.students s
set
  academic_year_id = y.id,
  cohort_id = c.id
from public.academic_years y
cross join public.cohorts c
where y.name = 'ברירת מחדל'
  and c.cohort_number = 1
  and s.academic_year_id is null;

update public.exams e
set academic_year_id = y.id
from public.academic_years y
where y.name = 'ברירת מחדל' and e.academic_year_id is null;

update public.teacher_assignments ta
set academic_year_id = y.id
from public.academic_years y
where y.name = 'ברירת מחדל' and ta.academic_year_id is null;

insert into public.users (username, password_hash, full_name, role, active)
values (
  'admin',
  '$2b$10$Z/vYO0..dGKQGLBdNymvpuMjD5qrDdYQtCO9XL2h5XlGm.w1cHUAW',
  'מנהלת מערכת',
  'admin',
  true
)
on conflict (username) do nothing;

alter table public.academic_years enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_year_placements enable row level security;
alter table public.users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.student_history enable row level security;
