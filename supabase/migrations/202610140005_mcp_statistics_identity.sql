-- Apply after 003/004. Hosted Supabase may not let postgres grant USAGE on auth.
-- Replace only the statistics RPC; keep SECURITY INVOKER, RLS and read-only grants.
-- JWT claims below are set by PostgREST after token validation, NOT RPC arguments.
-- No user rows, policies, role memberships or managed auth objects are changed.
begin;

create or replace function public.glow_mcp_statistics(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_sub text := v_claims->>'sub';
  v_user uuid;
  v_result jsonb;
begin
  if current_user <> 'glow_mcp_reader'
    or v_claims->>'role' is distinct from 'glow_mcp_reader'
    or v_sub is null
    or v_sub !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or jsonb_typeof(v_claims->'client_id') is distinct from 'string'
    or nullif(btrim(v_claims->>'client_id'), '') is null then
    raise exception 'OAuth authentication required' using errcode = '42501';
  end if;
  v_user := v_sub::uuid;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;
  with activity as (
    select s.id, s.session_date, s.status, w.week_start,
      case when s.status = 'completed' then coalesce((
        select case when jsonb_typeof(d->'summary'->'total') = 'number'
          then (d->'summary'->>'total')::numeric else 0 end
        from jsonb_array_elements(w.routine_snapshot->'days') d
        where d->>'id' = s.day_id limit 1
      ), 0) else 0 end as minutes
    from public.workout_sessions s
    join public.workout_weeks w on w.id = s.week_id and w.user_id = s.user_id
    where s.user_id = v_user and s.revision > 0 and s.status <> 'scheduled'
      and (p_from is null or s.session_date >= p_from)
      and (p_to is null or s.session_date <= p_to)
  )
  select jsonb_build_object(
    'diasEntrenados', count(distinct session_date),
    'semanasActivas', count(distinct week_start),
    'sesionesCompletas', count(*) filter (where status = 'completed'),
    'minutosEstimados', coalesce(sum(minutes), 0),
    'ejerciciosCompletos', (select count(*) from public.workout_exercises e join activity a on a.id = e.session_id where e.completed),
    'seriesCompletas', (select count(*) from public.workout_sets t join public.workout_exercises e on e.id = t.session_exercise_id join activity a on a.id = e.session_id where t.completed),
    'primeraFechaActividad', min(session_date),
    'ultimaFechaActividad', max(session_date)
  ) into v_result from activity;
  return v_result;
end;
$$;

revoke all on function public.glow_mcp_statistics(date, date) from public, anon, authenticated, service_role;
grant execute on function public.glow_mcp_statistics(date, date) to glow_mcp_reader;

notify pgrst, 'reload schema';
commit;
