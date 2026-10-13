-- Read-only workout tools for the existing MCP role. Run once after 001/002/003.
-- No rows are inserted, updated or deleted; write RPC permissions stay unchanged.
begin;

grant select (id, user_id, week_start, timezone, routine_id, routine_version, routine_snapshot, is_active)
  on public.workout_weeks to glow_mcp_reader;
grant select (id, user_id, week_id, day_id, planned_date, session_date, status, revision)
  on public.workout_sessions to glow_mcp_reader;
grant select (id, user_id, session_id, exercise_id, completed)
  on public.workout_exercises to glow_mcp_reader;
grant select (user_id, session_exercise_id, set_index, completed)
  on public.workout_sets to glow_mcp_reader;

create policy mcp_own_weeks on public.workout_weeks for select to glow_mcp_reader
  using ((select auth.uid()) = user_id and nullif((select auth.jwt()->>'client_id'), '') is not null);
create policy mcp_own_sessions on public.workout_sessions for select to glow_mcp_reader
  using ((select auth.uid()) = user_id and nullif((select auth.jwt()->>'client_id'), '') is not null);
create policy mcp_own_exercises on public.workout_exercises for select to glow_mcp_reader
  using ((select auth.uid()) = user_id and nullif((select auth.jwt()->>'client_id'), '') is not null);
create policy mcp_own_sets on public.workout_sets for select to glow_mcp_reader
  using ((select auth.uid()) = user_id and nullif((select auth.jwt()->>'client_id'), '') is not null);

-- Aggregate in PostgreSQL instead of downloading an unbounded history into MCP.
-- SECURITY INVOKER preserves RLS and grants. There is deliberately no user-id arg.
create function public.glow_mcp_statistics(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or nullif(auth.jwt()->>'client_id', '') is null then
    raise exception 'OAuth authentication required' using errcode = '42501';
  end if;
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
    where s.user_id = auth.uid() and s.revision > 0 and s.status <> 'scheduled'
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
revoke all on function public.glow_mcp_statistics(date, date) from public, anon, authenticated;
grant execute on function public.glow_mcp_statistics(date, date) to glow_mcp_reader;
commit;
