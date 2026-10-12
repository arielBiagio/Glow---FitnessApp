-- GLOW: paste this entire file into the SQL Editor of a NEW Supabase project.
-- Versioned migration: run once. No production data is deleted.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null,
  selected_routine_id text,
  created_at timestamptz not null default now()
);

create table public.workout_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  timezone text not null,
  routine_id text not null,
  routine_version integer not null check (routine_version > 0),
  routine_snapshot jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, routine_id, week_start),
  unique (id, user_id)
);
create unique index workout_weeks_active on public.workout_weeks(user_id, week_start) where is_active;

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  week_id uuid not null,
  day_id text not null,
  planned_date date not null,
  session_date date not null,
  performed_date date,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed')),
  source text not null default 'normal' check (source in ('normal', 'legacy')),
  started_at timestamptz,
  completed_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  foreign key (week_id, user_id) references public.workout_weeks(id, user_id) on delete cascade,
  unique (week_id, day_id, session_date),
  unique (id, user_id)
);
create index workout_sessions_history on public.workout_sessions(user_id, performed_date);
create index workout_sessions_dates on public.workout_sessions(user_id, session_date);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  exercise_id text not null,
  name_snapshot text not null,
  section_id text not null,
  position integer not null check (position >= 0),
  prescription jsonb not null,
  loggable boolean not null,
  required_sets integer not null check (required_sets between 0 and 50),
  completed boolean not null default false,
  completed_at timestamptz,
  check ((loggable and required_sets > 0) or (not loggable and required_sets = 0)),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade,
  unique (session_id, exercise_id),
  unique (id, user_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_exercise_id uuid not null,
  set_index integer not null check (set_index between 0 and 49),
  completed boolean not null default false,
  completed_at timestamptz,
  foreign key (session_exercise_id, user_id) references public.workout_exercises(id, user_id) on delete cascade,
  unique (session_exercise_id, set_index)
);

-- Durable receipts provide exactly-once effects even after another device writes.
-- Import receipts use the same ledger; they are independent of browser cache.
create table public.progress_operations (
  user_id uuid not null,
  operation_id uuid not null,
  session_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.workout_weeks enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.progress_operations enable row level security;
revoke all on public.profiles, public.workout_weeks, public.workout_sessions,
  public.workout_exercises, public.workout_sets, public.progress_operations from anon, authenticated;
grant select on public.profiles, public.workout_weeks, public.workout_sessions,
  public.workout_exercises, public.workout_sets, public.progress_operations to authenticated;
create policy profiles_read on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy weeks_read on public.workout_weeks for select to authenticated using ((select auth.uid()) = user_id);
create policy sessions_read on public.workout_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy exercises_read on public.workout_exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy sets_read on public.workout_sets for select to authenticated using ((select auth.uid()) = user_id);
create policy operations_read on public.progress_operations for select to authenticated using ((select auth.uid()) = user_id);

create function public.glow_get_profile(p_timezone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_profile public.profiles;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  insert into public.profiles(id, timezone) values (v_user, p_timezone) on conflict (id) do nothing;
  select * into v_profile from public.profiles where id = v_user;
  return jsonb_build_object('timezone', v_profile.timezone, 'selectedRoutineId', v_profile.selected_routine_id);
end;
$$;

-- Private serialization helper; never callable by clients.
create function public.glow_session_json(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'dayId', s.day_id, 'status', s.status, 'revision', s.revision,
    'plannedDate', s.planned_date, 'sessionDate', s.session_date, 'performedDate', s.performed_date,
    'exercises', coalesce((select jsonb_agg(jsonb_build_object(
      'exerciseId', e.exercise_id, 'completed', e.completed,
      'completedSets', coalesce((select jsonb_agg(t.set_index order by t.set_index)
        from public.workout_sets t where t.session_exercise_id = e.id and t.completed), '[]'::jsonb)
    ) order by e.position) from public.workout_exercises e where e.session_id = s.id), '[]'::jsonb)
  ) from public.workout_sessions s where s.id = p_session_id and s.user_id = auth.uid();
$$;

create function public.glow_week_json(p_week_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', w.id, 'weekStart', w.week_start, 'timezone', w.timezone,
    'isActive', w.is_active, 'routineSnapshot', w.routine_snapshot,
    'sessions', coalesce((select jsonb_agg(public.glow_session_json(s.id) order by s.session_date, s.planned_date, s.day_id)
      from public.workout_sessions s where s.week_id = w.id), '[]'::jsonb)
  ) from public.workout_weeks w where w.id = p_week_id and w.user_id = auth.uid();
$$;

create function public.glow_get_week(p_routine_id text, p_week_start date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_week uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_week from public.workout_weeks
    where user_id = auth.uid() and routine_id = p_routine_id and week_start = p_week_start;
  return public.glow_week_json(v_week);
end;
$$;

create function public.glow_activate_week(p_routine jsonb, p_week_start date, p_timezone text, p_session_date date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_week uuid; v_session uuid; v_exercise uuid;
  v_day jsonb; v_section jsonb; v_item jsonb; v_weekday integer; v_sets integer; v_position integer;
  v_date date;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'Week must start on Monday' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  v_date := coalesce(p_session_date, (now() at time zone p_timezone)::date);
  if v_date < p_week_start or v_date > p_week_start + 6 then
    raise exception 'Session date must belong to this week' using errcode = '22023';
  end if;
  if p_routine is null or octet_length(p_routine::text) > 200000 or
    coalesce(length(p_routine->>'id'), 0) not between 1 and 120 or
    coalesce((p_routine->>'version')::integer, 0) < 1 or
    jsonb_typeof(p_routine->'days') is distinct from 'array' or
    jsonb_typeof(p_routine->'weeklySchedule') is distinct from 'array' then
    raise exception 'Invalid routine' using errcode = '22023';
  end if;
  if jsonb_array_length(p_routine->'days') not between 1 and 7 then
    raise exception 'Invalid number of days' using errcode = '22023';
  end if;
  perform public.glow_get_profile(p_timezone);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || p_week_start::text, 0));
  select id into v_week from public.workout_weeks
    where user_id = v_user and routine_id = p_routine->>'id' and week_start = p_week_start;
  update public.workout_weeks set is_active = false where user_id = v_user and week_start = p_week_start and is_active;
  if v_week is not null then
    update public.workout_weeks set is_active = true where id = v_week;
    -- A new calendar day uses the original prescription of this week's snapshot.
    select routine_snapshot into p_routine from public.workout_weeks where id = v_week;
  else
    insert into public.workout_weeks(user_id, week_start, timezone, routine_id, routine_version, routine_snapshot)
      values (v_user, p_week_start, p_timezone, p_routine->>'id', (p_routine->>'version')::integer, p_routine)
      returning id into v_week;
  end if;
  for v_day in select value from jsonb_array_elements(p_routine->'days') loop
    if exists (select 1 from public.workout_sessions where week_id = v_week and day_id = v_day->>'id' and session_date = v_date) then
      continue;
    end if;
    if coalesce(length(v_day->>'id'), 0) not between 1 and 120 or
      jsonb_typeof(v_day->'sections') is distinct from 'array' then
      raise exception 'Invalid day' using errcode = '22023';
    end if;
    if (select count(*) from jsonb_array_elements(p_routine->'weeklySchedule') x
        where x->>'dayId' = v_day->>'id') <> 1 then
      raise exception 'Missing or repeated scheduled day' using errcode = '22023';
    end if;
    select (x->>'weekday')::integer into v_weekday from jsonb_array_elements(p_routine->'weeklySchedule') x
      where x->>'dayId' = v_day->>'id';
    if v_weekday is null or v_weekday not between 1 and 7 then raise exception 'Invalid weekday' using errcode = '22023'; end if;
    insert into public.workout_sessions(user_id, week_id, day_id, planned_date, session_date)
      values (v_user, v_week, v_day->>'id', p_week_start + v_weekday - 1, v_date) returning id into v_session;
    v_position := 0;
    for v_section in select value from jsonb_array_elements(v_day->'sections') loop
      if coalesce(length(v_section->>'id'), 0) not between 1 and 120 or
        jsonb_typeof(v_section->'exercises') is distinct from 'array' then
        raise exception 'Invalid section' using errcode = '22023';
      end if;
      for v_item in select value from jsonb_array_elements(v_section->'exercises') loop
        if coalesce(length(v_item->>'id'), 0) not between 1 and 120 or
          coalesce(length(v_item->>'name'), 0) not between 1 and 300 then
          raise exception 'Invalid exercise' using errcode = '22023';
        end if;
        v_sets := case when coalesce((v_item->>'loggable')::boolean, false) then (v_item->>'sets')::integer else 0 end;
        if v_sets is null or v_sets not between 0 and 50 or
          (coalesce((v_item->>'loggable')::boolean, false) and v_sets = 0) then
          raise exception 'Invalid sets' using errcode = '22023';
        end if;
        insert into public.workout_exercises(user_id, session_id, exercise_id, name_snapshot, section_id, position, prescription, loggable, required_sets)
          values (v_user, v_session, v_item->>'id', v_item->>'name', v_section->>'id', v_position, v_item, v_sets > 0, v_sets)
          returning id into v_exercise;
        insert into public.workout_sets(user_id, session_exercise_id, set_index)
          select v_user, v_exercise, i from generate_series(0, v_sets - 1) i;
        v_position := v_position + 1;
        if v_position > 100 then raise exception 'Too many exercises' using errcode = '22023'; end if;
      end loop;
    end loop;
    if v_position = 0 then raise exception 'Empty workout' using errcode = '22023'; end if;
  end loop;
  update public.profiles set selected_routine_id = p_routine->>'id' where id = v_user;
  return public.glow_week_json(v_week);
end;
$$;

create function public.glow_save_progress(
  p_session_id uuid, p_operation_id uuid, p_expected_revision integer, p_operation jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_session public.workout_sessions; v_exercise public.workout_exercises;
  v_receipt public.progress_operations; v_kind text; v_completed boolean; v_index integer;
  v_import jsonb; v_set jsonb; v_timezone text; v_status text; v_timestamp timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_session from public.workout_sessions where id = p_session_id and user_id = v_user for update;
  if not found then raise exception 'Session not found' using errcode = '42501'; end if;
  if p_operation_id is null or p_operation is null or octet_length(p_operation::text) > 50000 then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  select * into v_receipt from public.progress_operations where user_id = v_user and operation_id = p_operation_id;
  if found then
    if v_receipt.session_id <> p_session_id or v_receipt.payload <> p_operation then
      raise exception 'Operation ID reused with different payload' using errcode = '22023';
    end if;
    return public.glow_session_json(p_session_id);
  end if;
  if p_expected_revision is null or v_session.revision <> p_expected_revision then
    raise exception 'Progress changed on another device' using errcode = '40001';
  end if;
  v_kind := p_operation->>'kind';
  if v_kind = 'reset' then
    update public.workout_exercises set completed = false, completed_at = null where session_id = p_session_id;
    update public.workout_sets set completed = false, completed_at = null where session_exercise_id in
      (select id from public.workout_exercises where session_id = p_session_id);
  elsif v_kind = 'import' then
    if v_session.revision <> 0 or jsonb_typeof(p_operation->'exercises') is distinct from 'array' then
      raise exception 'Import requires an empty session' using errcode = '22023';
    end if;
    for v_import in select value from jsonb_array_elements(p_operation->'exercises') loop
      select * into v_exercise from public.workout_exercises where session_id = p_session_id and exercise_id = v_import->>'exerciseId';
      if not found or jsonb_typeof(v_import->'completed') is distinct from 'boolean' or
        jsonb_typeof(v_import->'completedSets') is distinct from 'array' then
        raise exception 'Invalid imported exercise' using errcode = '22023';
      end if;
      for v_set in select value from jsonb_array_elements(v_import->'completedSets') loop
        v_index := v_set::text::integer;
        if not v_exercise.loggable or v_index < 0 or v_index >= v_exercise.required_sets then
          raise exception 'Invalid imported set' using errcode = '22023';
        end if;
        update public.workout_sets set completed = true where session_exercise_id = v_exercise.id and set_index = v_index;
      end loop;
      update public.workout_exercises set completed = case when v_exercise.loggable then
        (select count(*) from public.workout_sets where session_exercise_id = v_exercise.id and completed) = v_exercise.required_sets
        else (v_import->>'completed')::boolean end where id = v_exercise.id;
    end loop;
    update public.workout_sessions set source = 'legacy' where id = p_session_id;
  elsif v_kind in ('set', 'exercise') then
    select * into v_exercise from public.workout_exercises where session_id = p_session_id and exercise_id = p_operation->>'exerciseId';
    if not found or jsonb_typeof(p_operation->'completed') is distinct from 'boolean' then
      raise exception 'Invalid exercise operation' using errcode = '22023';
    end if;
    v_completed := (p_operation->>'completed')::boolean;
    if v_kind = 'set' then
      v_index := (p_operation->>'setIndex')::integer;
      if not v_exercise.loggable or v_index is null or v_index < 0 or v_index >= v_exercise.required_sets then
        raise exception 'Invalid set index' using errcode = '22023';
      end if;
      update public.workout_sets set completed = v_completed, completed_at = case when v_completed then v_timestamp else null end
        where session_exercise_id = v_exercise.id and set_index = v_index;
      v_completed := (select count(*) from public.workout_sets where session_exercise_id = v_exercise.id and completed) = v_exercise.required_sets;
    else
      update public.workout_sets set completed = v_completed, completed_at = case when v_completed then v_timestamp else null end
        where session_exercise_id = v_exercise.id;
    end if;
    update public.workout_exercises set completed = v_completed, completed_at = case when v_completed then v_timestamp else null end where id = v_exercise.id;
  else
    raise exception 'Unknown operation' using errcode = '22023';
  end if;
  v_status := case
    when not exists (select 1 from public.workout_exercises where session_id = p_session_id and not completed) then 'completed'
    when exists (select 1 from public.workout_exercises where session_id = p_session_id and completed) or
      exists (select 1 from public.workout_sets t join public.workout_exercises e on e.id = t.session_exercise_id where e.session_id = p_session_id and t.completed) then 'in_progress'
    else 'scheduled' end;
  select timezone into v_timezone from public.workout_weeks where id = v_session.week_id;
  update public.workout_sessions set
    status = v_status, revision = revision + 1, updated_at = v_timestamp,
    started_at = case when v_kind = 'reset' then null when v_kind = 'import' then started_at else coalesce(started_at, v_timestamp) end,
    completed_at = case when v_status = 'completed' and v_kind <> 'import' then v_timestamp else null end,
    performed_date = case when v_status = 'completed' and v_kind <> 'import' then session_date else null end
    where id = p_session_id;
  insert into public.progress_operations(user_id, operation_id, session_id, payload) values (v_user, p_operation_id, p_session_id, p_operation);
  return public.glow_session_json(p_session_id);
end;
$$;

-- Only entry points are exposed. Helpers and direct table writes stay private.
revoke all on function public.glow_get_profile(text), public.glow_session_json(uuid),
  public.glow_week_json(uuid), public.glow_get_week(text, date), public.glow_activate_week(jsonb, date, text, date),
  public.glow_save_progress(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.glow_get_profile(text), public.glow_get_week(text, date),
  public.glow_activate_week(jsonb, date, text, date), public.glow_save_progress(uuid, uuid, integer, jsonb) to authenticated;
commit;
