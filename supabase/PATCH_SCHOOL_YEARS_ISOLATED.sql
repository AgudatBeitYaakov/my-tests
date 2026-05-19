-- =============================================================================
-- מערכת שנים עצמאיות (ללא מחזורים / ללא קידום / ללא העתקה בין שנים)
-- הרצה ב-Supabase → SQL Editor (שומר נתונים קיימים)
--
-- מה זה עושה:
--   • שנות לימוד (academic_years) + תאריכי התחלה/סיום
--   • כיתות / התמחויות / מסלולים / מורות — לפי שנה (academic_year_id)
--   • ייחודיות שמות בתוך אותה שנה בלבד
--   • תצוגת school_years לקריאה (שם = year_name)
--
-- אחרי ההרצה: רענון קשיח בדפדפן + הפעלה מחדש של npm run dev
-- =============================================================================

-- שנות לימוד
alter table public.academic_years add column if not exists start_date date;
alter table public.academic_years add column if not exists end_date date;

comment on table public.academic_years is
  'שנת לימודים עצמאית (school year) — כל הנתונים מקושרים לשנה; אין סנכרון בין שנים';

drop view if exists public.school_years;
create view public.school_years as
  select
    id,
    year_name as name,
    start_date,
    end_date,
    is_active,
    created_at
  from public.academic_years;

-- כיתות / התמחויות / מסלולים לפי שנה
alter table public.classes add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;
alter table public.classes add column if not exists deleted_at timestamptz;
alter table public.classes add column if not exists created_at timestamptz not null default now();

alter table public.specializations add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;
alter table public.specializations add column if not exists deleted_at timestamptz;
alter table public.specializations add column if not exists created_at timestamptz not null default now();

alter table public.tracks add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;
alter table public.tracks add column if not exists deleted_at timestamptz;
alter table public.tracks add column if not exists created_at timestamptz not null default now();

-- מורות לפי שנה
alter table public.teachers add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;

-- מילוי שנת לימודים לנתונים קיימים
do $$
declare
  active_id uuid;
begin
  select id into active_id from public.academic_years where is_active = true limit 1;
  if active_id is null then
    select id into active_id from public.academic_years order by created_at desc nulls last limit 1;
  end if;
  if active_id is null then
    insert into public.academic_years (year_name, is_active)
    values ('תשפ״ו', true)
    returning id into active_id;
  end if;

  -- כיתות לפי שנה של תלמידות (אם אפשר)
  update public.classes c
  set academic_year_id = s.academic_year_id
  from (
    select distinct on (class_id) class_id, academic_year_id
    from public.students
    where deleted_at is null
    order by class_id, academic_year_id
  ) s
  where c.id = s.class_id and c.academic_year_id is null;

  update public.classes set academic_year_id = active_id where academic_year_id is null;
  update public.specializations set academic_year_id = active_id where academic_year_id is null;
  update public.tracks set academic_year_id = active_id where academic_year_id is null;
  update public.teachers set academic_year_id = active_id where academic_year_id is null;
end $$;

alter table public.classes alter column academic_year_id set not null;
alter table public.specializations alter column academic_year_id set not null;
alter table public.tracks alter column academic_year_id set not null;
alter table public.teachers alter column academic_year_id set not null;

-- הסרת ייחודיות גלובלית; ייחודיות לפי שנה
alter table public.classes drop constraint if exists classes_name_key;
drop index if exists public.classes_name_key;
drop index if exists public.uq_classes_name_per_year;
create unique index uq_classes_name_per_year
  on public.classes (academic_year_id, name)
  where deleted_at is null;

alter table public.specializations drop constraint if exists specializations_name_key;
drop index if exists public.specializations_name_key;
drop index if exists public.uq_specializations_name_per_year;
create unique index uq_specializations_name_per_year
  on public.specializations (academic_year_id, name)
  where deleted_at is null;

alter table public.tracks drop constraint if exists tracks_name_key;
drop index if exists public.tracks_name_key;
drop index if exists public.uq_tracks_name_per_year;
create unique index uq_tracks_name_per_year
  on public.tracks (academic_year_id, name)
  where deleted_at is null;

create index if not exists idx_classes_year on public.classes (academic_year_id);
create index if not exists idx_specializations_year on public.specializations (academic_year_id);
create index if not exists idx_tracks_year on public.tracks (academic_year_id);
create index if not exists idx_teachers_year on public.teachers (academic_year_id);

drop index if exists public.uq_teachers_tz_per_year;
create unique index uq_teachers_tz_per_year
  on public.teachers (academic_year_id, tz)
  where deleted_at is null and tz is not null;

-- ולידציה: יעדי שיבוץ באותה שנה
create or replace function public.assignments_validate_target()
returns trigger language plpgsql as $$
begin
  if new.class_id is not null then
    if not exists (
      select 1 from public.classes c
      where c.id = new.class_id
        and c.academic_year_id = new.academic_year_id
        and c.is_active
        and c.deleted_at is null
    ) then
      raise exception 'class_id invalid, inactive, or wrong school year';
    end if;
  end if;
  if new.specialization_id is not null then
    if not exists (
      select 1 from public.specializations s
      where s.id = new.specialization_id
        and s.academic_year_id = new.academic_year_id
        and s.is_active
        and s.deleted_at is null
    ) then
      raise exception 'specialization_id invalid, inactive, or wrong school year';
    end if;
  end if;
  if new.track_id is not null then
    if not exists (
      select 1 from public.tracks t
      where t.id = new.track_id
        and t.academic_year_id = new.academic_year_id
        and t.is_active
        and t.deleted_at is null
    ) then
      raise exception 'track_id invalid, inactive, or wrong school year';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.exams_validate_target()
returns trigger language plpgsql as $$
begin
  if new.class_id is not null then
    if not exists (
      select 1 from public.classes c
      where c.id = new.class_id and c.academic_year_id = new.academic_year_id
    ) then
      raise exception 'exam class_id invalid or wrong school year';
    end if;
  end if;
  if new.specialization_id is not null then
    if not exists (
      select 1 from public.specializations s
      where s.id = new.specialization_id and s.academic_year_id = new.academic_year_id
    ) then
      raise exception 'exam specialization_id invalid or wrong school year';
    end if;
  end if;
  if new.track_id is not null then
    if not exists (
      select 1 from public.tracks t
      where t.id = new.track_id and t.academic_year_id = new.academic_year_id
    ) then
      raise exception 'exam track_id invalid or wrong school year';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.teachers_validate_year_scope()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = new.id
      and ta.academic_year_id <> new.academic_year_id
      and ta.deleted_at is null
  ) then
    raise exception 'teacher has assignments in another school year';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_teachers_validate_year on public.teachers;
create trigger trg_teachers_validate_year
  before update of academic_year_id on public.teachers
  for each row execute function public.teachers_validate_year_scope();

-- ניקוי שאריות מחזורים (אם קיימות)
drop view if exists public.active_cohorts_view;
drop table if exists public.year_cohorts cascade;
drop table if exists public.cohort_year_placements cascade;
drop table if exists public.cohorts cascade;
drop table if exists public.year_layers cascade;

notify pgrst, 'reload schema';
