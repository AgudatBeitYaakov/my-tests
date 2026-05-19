-- שיבוץ רב-יעדי בשורה אחת: מערכי שכבות/כיתות/מסלולים/התמחויות
-- הרצה במסד קיים אחרי גיבוי. לאחר מכן: notify pgrst reload

-- ─── teacher_assignments ─────────────────────────────────────────────────────
alter table public.teacher_assignments add column if not exists grade_levels text[];
alter table public.teacher_assignments add column if not exists class_ids uuid[] not null default '{}';
alter table public.teacher_assignments add column if not exists track_ids uuid[] not null default '{}';
alter table public.teacher_assignments add column if not exists specialization_ids uuid[] not null default '{}';
alter table public.teacher_assignments add column if not exists applies_to_all_in_grade boolean not null default false;
alter table public.teacher_assignments add column if not exists targets_fingerprint text;

update public.teacher_assignments
set
  grade_levels = case
    when grade_levels is null or cardinality(grade_levels) = 0 then
      case when grade_level is not null then array[grade_level] else array[]::text[] end
    else grade_levels
  end,
  class_ids = case
    when cardinality(class_ids) = 0 and class_id is not null then array[class_id]
    else coalesce(class_ids, '{}'::uuid[])
  end,
  track_ids = case
    when cardinality(track_ids) = 0 and track_id is not null then array[track_id]
    else coalesce(track_ids, '{}'::uuid[])
  end,
  specialization_ids = case
    when cardinality(specialization_ids) = 0 and specialization_id is not null then array[specialization_id]
    else coalesce(specialization_ids, '{}'::uuid[])
  end
where deleted_at is null;

alter table public.teacher_assignments alter column grade_levels set not null;
alter table public.teacher_assignments alter column grade_levels set default '{}';

update public.teacher_assignments
set grade_levels = array['א']::text[]
where cardinality(coalesce(grade_levels, '{}'::text[])) = 0 and deleted_at is null;

alter table public.teacher_assignments drop constraint if exists teacher_assignments_category_target_check;
alter table public.teacher_assignments drop constraint if exists teacher_assignments_grade_level_check;

drop index if exists public.uq_teacher_assignment;

alter table public.teacher_assignments drop column if exists grade_level;
alter table public.teacher_assignments drop column if exists class_id;
alter table public.teacher_assignments drop column if exists specialization_id;
alter table public.teacher_assignments drop column if exists track_id;

alter table public.teacher_assignments add constraint teacher_assignments_grade_levels_check
  check (
    cardinality(grade_levels) >= 1
    and grade_levels <@ array['א', 'ב', 'ג']::text[]
  );

alter table public.teacher_assignments add constraint teacher_assignments_multi_target_check
  check (
    (
      assignment_category = 'התמחות'
      and cardinality(specialization_ids) >= 1
      and cardinality(class_ids) = 0
      and cardinality(track_ids) = 0
      and not psychology_enabled
      and not applies_to_all_in_grade
    )
    or (
      assignment_category = 'חובה'
      and cardinality(specialization_ids) = 0
      and (
        applies_to_all_in_grade
        or psychology_enabled
        or cardinality(class_ids) >= 1
        or cardinality(track_ids) >= 1
      )
      and (
        not applies_to_all_in_grade
        or (
          cardinality(class_ids) = 0
          and cardinality(track_ids) = 0
          and not psychology_enabled
        )
      )
    )
  );

create unique index if not exists uq_teacher_assignment_fingerprint on public.teacher_assignments (
  academic_year_id,
  teacher_id,
  subject,
  coalesce(lesson_name, ''),
  assignment_category,
  coalesce(targets_fingerprint, '')
) where deleted_at is null;

-- ─── exams ───────────────────────────────────────────────────────────────────
alter table public.exams add column if not exists grade_levels text[];
alter table public.exams add column if not exists class_ids uuid[] not null default '{}';
alter table public.exams add column if not exists track_ids uuid[] not null default '{}';
alter table public.exams add column if not exists specialization_ids uuid[] not null default '{}';
alter table public.exams add column if not exists applies_to_all_in_grade boolean not null default false;

update public.exams
set
  grade_levels = case
    when grade_levels is null or cardinality(grade_levels) = 0 then
      case when grade_level is not null then array[grade_level] else array[]::text[] end
    else grade_levels
  end,
  class_ids = case
    when cardinality(class_ids) = 0 and class_id is not null then array[class_id]
    else coalesce(class_ids, '{}'::uuid[])
  end,
  track_ids = case
    when cardinality(track_ids) = 0 and track_id is not null then array[track_id]
    else coalesce(track_ids, '{}'::uuid[])
  end,
  specialization_ids = case
    when cardinality(specialization_ids) = 0 and specialization_id is not null then array[specialization_id]
    else coalesce(specialization_ids, '{}'::uuid[])
  end
where deleted_at is null;

alter table public.exams alter column grade_levels set not null;

update public.exams
set grade_levels = array['א']::text[]
where cardinality(coalesce(grade_levels, '{}'::text[])) = 0 and deleted_at is null;

alter table public.exams drop constraint if exists exams_category_target_check;
drop index if exists public.uq_exams_unique;

alter table public.exams drop column if exists grade_level;
alter table public.exams drop column if exists class_id;
alter table public.exams drop column if exists specialization_id;
alter table public.exams drop column if exists track_id;

alter table public.exams add constraint exams_grade_levels_check
  check (
    cardinality(grade_levels) >= 1
    and grade_levels <@ array['א', 'ב', 'ג']::text[]
  );

alter table public.exams add constraint exams_multi_target_check
  check (
    (
      assignment_category = 'התמחות'
      and cardinality(specialization_ids) >= 1
      and cardinality(class_ids) = 0
      and cardinality(track_ids) = 0
      and not psychology_enabled
      and not applies_to_all_in_grade
    )
    or (
      assignment_category = 'חובה'
      and cardinality(specialization_ids) = 0
      and (
        applies_to_all_in_grade
        or psychology_enabled
        or cardinality(class_ids) >= 1
        or cardinality(track_ids) >= 1
      )
    )
  );

create unique index if not exists uq_exams_assignment_date on public.exams (
  academic_year_id,
  teacher_assignment_id,
  exam_date
) where deleted_at is null;

-- ─── triggers: validate array targets belong to year ─────────────────────────
create or replace function public.assignments_validate_multi_target()
returns trigger language plpgsql as $$
declare
  cid uuid;
  tid uuid;
  sid uuid;
begin
  if tg_op = 'UPDATE' then
    if new.academic_year_id is distinct from old.academic_year_id then
      raise exception 'cannot change academic_year_id on assignment';
    end if;
  end if;

  foreach cid in array coalesce(new.class_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.classes c
      where c.id = cid and c.academic_year_id = new.academic_year_id
        and c.is_active and c.deleted_at is null
    ) then
      raise exception 'class_id % invalid for school year', cid;
    end if;
  end loop;

  foreach tid in array coalesce(new.track_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.tracks t
      where t.id = tid and t.academic_year_id = new.academic_year_id
        and t.is_active and t.deleted_at is null
    ) then
      raise exception 'track_id % invalid for school year', tid;
    end if;
  end loop;

  foreach sid in array coalesce(new.specialization_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.specializations s
      where s.id = sid and s.academic_year_id = new.academic_year_id
        and s.is_active and s.deleted_at is null
    ) then
      raise exception 'specialization_id % invalid for school year', sid;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_assignments_validate_target on public.teacher_assignments;
create trigger trg_assignments_validate_multi_target
  before insert or update on public.teacher_assignments
  for each row execute function public.assignments_validate_multi_target();

create or replace function public.exams_validate_multi_target()
returns trigger language plpgsql as $$
declare
  cid uuid;
  tid uuid;
  sid uuid;
begin
  foreach cid in array coalesce(new.class_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.classes c
      where c.id = cid and c.academic_year_id = new.academic_year_id
    ) then
      raise exception 'exam class_id % invalid for school year', cid;
    end if;
  end loop;

  foreach tid in array coalesce(new.track_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.tracks t
      where t.id = tid and t.academic_year_id = new.academic_year_id
    ) then
      raise exception 'exam track_id % invalid for school year', tid;
    end if;
  end loop;

  foreach sid in array coalesce(new.specialization_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.specializations s
      where s.id = sid and s.academic_year_id = new.academic_year_id
    ) then
      raise exception 'exam specialization_id % invalid for school year', sid;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_exams_validate_target on public.exams;
create trigger trg_exams_validate_multi_target
  before insert or update on public.exams
  for each row execute function public.exams_validate_multi_target();

notify pgrst, 'reload schema';
