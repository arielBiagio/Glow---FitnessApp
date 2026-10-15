import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const routine = JSON.parse(readFileSync('public/routines/glow-cele-split.json', 'utf8'));
const day = structuredClone(routine.days[0]);
day.sections = [{ ...day.sections[0], exercises: [day.sections[0].exercises[0], { ...day.sections[1].exercises[0], sets: 2 }] }];
const fixture = { ...routine, days: [day], weeklySchedule: [{ weekday: 1, dayId: day.id, session: 'A', day: 'Lunes' }] };
let db: PGlite;
async function asUser(id: string | null, role = 'authenticated', clientId: string | null = null) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, role, client_id: clientId })]);
  await db.exec(`set role ${role}`);
}
async function activate(value = fixture, start = '2026-10-12', date = start) {
  const result = await db.query<{ week: { id: string; sessions: { id: string; revision: number; status: string; performedDate: string | null; exercises: { exerciseId: string; completed: boolean; completedSets: number[] }[] }[] } }>(
    'select public.glow_activate_week($1::jsonb, $2::date, $3, $4::date) as week', [JSON.stringify(value), start, 'America/New_York', date]);
  return result.rows[0].week;
}
async function save(sessionId: string, revision: number, operation: unknown, operationId = crypto.randomUUID()) {
  const result = await db.query<{ session: { id: string; revision: number; status: string; performedDate: string | null; exercises: { exerciseId: string; completed: boolean; completedSets: number[] }[] } }>(
    'select public.glow_save_progress($1::uuid, $2::uuid, $3::integer, $4::jsonb) as session',
    [sessionId, operationId, revision, JSON.stringify(operation)]);
  return result.rows[0].session;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role authenticator; create role supabase_auth_admin; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/202610120001_workout_backend.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610120002_profile_display_name.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610120003_mcp_profile_oauth.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610120004_mcp_workout_reads.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610140005_mcp_statistics_identity.sql', 'utf8'));
  // Hosted auth schemas may not grant USAGE to custom roles. Exercise that setup
  // throughout this suite, rather than assuming a local superuser's grant works.
  await db.exec('revoke usage on schema auth from glow_mcp_reader');
});
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('reset role; truncate auth.users cascade');
  await db.query('insert into auth.users(id) values ($1), ($2)', [A, B]);
  await asUser(A);
});

describe('SQL real: permisos, consistencia e historial', () => {
  it('las estadísticas MCP funcionan sin USAGE en el esquema auth gestionado', async () => {
    const session = (await activate()).sessions[0];
    await save(session.id, 0, { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true });
    await asUser(B); const other = (await activate()).sessions[0];
    await save(other.id, 0, { kind: 'exercise', exerciseId: other.exercises[0].exerciseId, completed: true });
    await db.exec('reset role; revoke usage on schema auth from glow_mcp_reader');
    try {
      await asUser(A, 'glow_mcp_reader', 'sesame-fixture');
      expect((await db.query<{ allowed: boolean }>("select has_schema_privilege(current_user, 'auth', 'USAGE') as allowed")).rows[0].allowed).toBe(false);
      expect((await db.query<{ user_id: string }>('select user_id from public.workout_sessions')).rows.every(row => row.user_id === A)).toBe(true);
      const result = await db.query<{ value: Record<string, unknown> }>('select public.glow_mcp_statistics(null::date,null::date) as value');
      expect(result.rows[0].value).toMatchObject({ diasEntrenados: 1, ejerciciosCompletos: 1, sesionesCompletas: 0 });
      await expect(db.query('delete from public.workout_sessions')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await db.exec('reset role');
    }
  });
  it('la migración 005 es repetible, invoker y no concede escritura ni acceso a auth', async () => {
    await db.exec('reset role');
    await db.exec(readFileSync('supabase/migrations/202610140005_mcp_statistics_identity.sql', 'utf8'));
    const { rows } = await db.query<{ elevated: boolean; stable: string; usage: boolean; reader: boolean; public_login: boolean; anon: boolean; service: boolean }>(`
      select p.prosecdef as elevated, p.provolatile as stable,
        has_schema_privilege('glow_mcp_reader','auth','USAGE') as usage,
        has_function_privilege('glow_mcp_reader',p.oid,'EXECUTE') as reader,
        has_function_privilege('authenticated',p.oid,'EXECUTE') as public_login,
        has_function_privilege('anon',p.oid,'EXECUTE') as anon,
        has_function_privilege('service_role',p.oid,'EXECUTE') as service
      from pg_proc p where p.oid='public.glow_mcp_statistics(date,date)'::regprocedure
    `);
    expect(rows[0]).toEqual({ elevated: false, stable: 's', usage: false, reader: true, public_login: false, anon: false, service: false });
  });
  it('las estadísticas exigen identidad y cliente OAuth del JWT, sin aceptar un usuario por parámetro', async () => {
    await activate();
    await asUser(A, 'glow_mcp_reader', 'sesame-fixture');
    const call = () => db.query('select public.glow_mcp_statistics(null::date,null::date)');
    for (const claims of [
      {}, { sub: A, role: 'glow_mcp_reader' },
      { sub: A, role: 'glow_mcp_reader', client_id: ' ' },
      { sub: A, role: 'glow_mcp_reader', client_id: 42 },
      { sub: 'invalid-uuid', role: 'glow_mcp_reader', client_id: 'sesame-fixture' },
      { sub: A, role: 'authenticated', client_id: 'sesame-fixture' },
    ]) {
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
      await expect(call()).rejects.toMatchObject({ code: '42501' });
    }
    await db.query("select set_config('request.jwt.claims','',false)");
    await expect(call()).rejects.toMatchObject({ code: '42501' });
  });
  it('un JWT sin sesiones devuelve ceros y RLS sigue bloqueando una identidad discordante', async () => {
    const session = (await activate()).sessions[0];
    await save(session.id, 0, { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true });
    await asUser(B, 'glow_mcp_reader', 'sesame-fixture');
    const stats = async () => (await db.query<{ value: Record<string, unknown> }>('select public.glow_mcp_statistics(null::date,null::date) as value')).rows[0].value;
    expect(await stats()).toMatchObject({ diasEntrenados: 0, ejerciciosCompletos: 0, seriesCompletas: 0 });
    // Deliberate mismatch with the legacy setting used by this test's auth.uid:
    // the RPC's JWT user filter and existing RLS intersect, never bypass each other.
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: A, role: 'glow_mcp_reader', client_id: 'sesame-fixture' })]);
    expect(await stats()).toMatchObject({ diasEntrenados: 0, ejerciciosCompletos: 0 });
  });
  it('las estadísticas funcionan con el contexto JSON de PostgREST sin la variable legacy sub', async () => {
    const session = (await activate()).sessions[0];
    await save(session.id, 0, { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true });
    await asUser(A, 'glow_mcp_reader', 'sesame-fixture');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    const result = await db.query<{ value: Record<string, unknown> }>('select public.glow_mcp_statistics(null::date,null::date) as value');
    expect(result.rows[0].value).toMatchObject({ diasEntrenados: 1, ejerciciosCompletos: 1 });
  });
  it('el rol MCP lee su perfil e historial permitido, sin escritura ni RPC de progreso', async () => {
    const session = (await activate()).sessions[0];
    await asUser(B); await activate();
    await asUser(A, 'glow_mcp_reader', 'sesame-fixture');
    expect((await db.query<{ id: string }>('select id,display_name,timezone,selected_routine_id from public.profiles')).rows.map(row => row.id)).toEqual([A]);
    expect((await db.query<{ user_id: string }>('select user_id from public.workout_weeks')).rows.map(row => row.user_id)).toEqual([A]);
    expect((await db.query<{ user_id: string }>('select user_id from public.workout_sessions')).rows.every(row => row.user_id === A)).toBe(true);
    await expect(db.query('select created_at from public.profiles')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('select * from public.workout_weeks')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query("update public.profiles set display_name='Agent changed it'")).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('delete from public.profiles')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('delete from public.workout_sessions')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('update public.workout_sets set completed=true')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('select * from public.progress_operations')).rejects.toMatchObject({ code: '42501' });
    await expect(activate()).rejects.toMatchObject({ code: '42501' });
    await expect(save(session.id, 0, { kind: 'reset' })).rejects.toMatchObject({ code: '42501' });
    await expect(db.query("select public.glow_get_profile('UTC')")).rejects.toMatchObject({ code: '42501' });
    await asUser(A, 'glow_mcp_reader');
    expect((await db.query('select id from public.profiles')).rows).toEqual([]);
    expect((await db.query('select id from public.workout_sessions')).rows).toEqual([]);
  });
  it('las estadísticas MCP cuentan fechas reales, series y minutos de snapshots sin mezclar usuarios', async () => {
    const first = (await activate()).sessions[0];
    await save(first.id, 0, { kind: 'exercise', exerciseId: first.exercises[0].exerciseId, completed: true });
    await save(first.id, 1, { kind: 'exercise', exerciseId: first.exercises[1].exerciseId, completed: true });
    const second = (await activate(fixture, '2026-10-12', '2026-10-13')).sessions[1];
    await save(second.id, 0, { kind: 'exercise', exerciseId: second.exercises[0].exerciseId, completed: true });
    await asUser(B); const b = (await activate()).sessions[0];
    await save(b.id, 0, { kind: 'exercise', exerciseId: b.exercises[0].exerciseId, completed: true });
    await asUser(A, 'glow_mcp_reader', 'sesame-fixture');
    const stats = async (from: string | null = null, to: string | null = null) => (await db.query<{ value: Record<string, unknown> }>('select public.glow_mcp_statistics($1::date,$2::date) as value', [from, to])).rows[0].value;
    expect(await stats()).toMatchObject({ diasEntrenados: 2, semanasActivas: 1, sesionesCompletas: 1, minutosEstimados: fixture.days[0].summary.total, ejerciciosCompletos: 3, seriesCompletas: 2, primeraFechaActividad: '2026-10-12', ultimaFechaActividad: '2026-10-13' });
    expect(await stats('2026-10-13', '2026-10-13')).toMatchObject({ diasEntrenados: 1, sesionesCompletas: 0, minutosEstimados: 0, ejerciciosCompletos: 1 });
    expect(await stats('2026-10-14', '2026-10-14')).toMatchObject({ diasEntrenados: 0, seriesCompletas: 0, primeraFechaActividad: null });
    await expect(stats('2026-10-14', '2026-10-12')).rejects.toMatchObject({ code: '22023' });
    await asUser(A); await save(first.id, 2, { kind: 'reset' });
    await expect(stats()).rejects.toMatchObject({ code: '42501' });
    await asUser(A, 'glow_mcp_reader', 'sesame-fixture');
    expect(await stats()).toMatchObject({ diasEntrenados: 1, ejerciciosCompletos: 1, seriesCompletas: 0, minutosEstimados: 0 });
    await asUser(A, 'glow_mcp_reader');
    await expect(stats()).rejects.toMatchObject({ code: '42501' });
  });
  it('el hook conserva el login normal, restringe OAuth y solo puede ejecutarlo Supabase Auth', async () => {
    const claims = { iss: 'https://example.supabase.co/auth/v1', sub: A, role: 'authenticated', aud: 'authenticated', user_metadata: { role: 'service_role' } };
    const normal = { claims, authentication_method: 'password' };
    await expect(db.query('select public.glow_mcp_access_token_hook($1::jsonb)', [JSON.stringify(normal)])).rejects.toMatchObject({ code: '42501' });
    await asUser(null, 'supabase_auth_admin');
    const hook = async (event: object) => (await db.query<{ result: { claims: typeof claims; error?: unknown } }>('select public.glow_mcp_access_token_hook($1::jsonb) as result', [JSON.stringify(event)])).rows[0].result;
    expect(await hook(normal)).toEqual(normal);
    const delegated = await hook({ claims: { ...claims, client_id: 'sesame-fixture' }, authentication_method: 'oauth_provider/authorization_code' });
    expect(delegated.claims.role).toBe('glow_mcp_reader');
    expect(delegated.claims.aud).toEqual(['authenticated', 'https://example.supabase.co/functions/v1/glow-mcp']);
    expect(delegated.claims.user_metadata).toEqual(claims.user_metadata);
    expect((await hook({ claims, authentication_method: 'oauth_provider/authorization_code' })).error).toBeTruthy();
    expect((await hook({ claims: { ...claims, client_id: 'sesame-fixture', iss: 'http://evil.example/auth/v1' } })).error).toBeTruthy();
    // Token refresh keeps client_id and must retain the restrictive role.
    expect((await hook({ claims: { ...delegated.claims, client_id: 'sesame-fixture' }, authentication_method: 'token_refresh' })).claims.role).toBe('glow_mcp_reader');
  });
  it('el nombre puede administrarse sin cambiar el login y sigue protegido por RLS', async () => {
    await activate();
    await db.exec('reset role');
    await db.query('update public.profiles set display_name = $1 where id = $2', ['Ana Pérez', A]);
    await asUser(A);
    expect((await db.query<{ display_name: string }>('select display_name from public.profiles where id = $1', [A])).rows[0].display_name).toBe('Ana Pérez');
    await asUser(B);
    expect((await db.query('select display_name from public.profiles where id = $1', [A])).rows).toHaveLength(0);
  });
  it('repetir un entrenamiento otro día crea una sesión distinta y conserva la anterior', async () => {
    const monday = (await activate()).sessions[0];
    await save(monday.id, 0, { kind: 'exercise', exerciseId: monday.exercises[0].exerciseId, completed: true });
    const tuesday = await activate(fixture, '2026-10-12', '2026-10-13');
    expect(tuesday.sessions).toHaveLength(2);
    expect(tuesday.sessions[0].exercises[0].completed).toBe(true);
    expect(tuesday.sessions[1].exercises[0].completed).toBe(false);
    expect(tuesday.sessions[1].id).not.toBe(monday.id);
    expect((await activate(fixture, '2026-10-12', '2026-10-13')).sessions).toHaveLength(2);
    await expect(activate(fixture, '2026-10-12', '2026-10-19')).rejects.toMatchObject({ code: '22023' });
  });
  it('conserva la fecha del entrenamiento aunque se sincronicen marcas otro día', async () => {
    const session = (await activate(fixture, '2026-10-05', '2026-10-06')).sessions[0];
    await save(session.id, 0, { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true });
    const done = await save(session.id, 1, { kind: 'exercise', exerciseId: session.exercises[1].exerciseId, completed: true });
    expect(done.performedDate).toBe('2026-10-06');
  });
  it('niega RPC a visitantes y rechaza authenticated sin identidad', async () => {
    await asUser(null, 'anon');
    await expect(activate()).rejects.toMatchObject({ code: '42501' });
    await asUser(null);
    await expect(activate()).rejects.toMatchObject({ code: '42501' });
  });
  it('crea un plan idempotente y separa la semana siguiente', async () => {
    const week = await activate();
    expect((await activate()).id).toBe(week.id);
    expect((await activate(fixture, '2026-10-19')).id).not.toBe(week.id);
    expect(week.sessions[0].revision).toBe(0);
    expect(week.sessions[0].exercises).toHaveLength(2);
  });
  it('activa todas las rutinas del catálogo sin perder sus planes', async () => {
    const catalog = JSON.parse(readFileSync('public/routines/index.json', 'utf8'));
    for (const entry of catalog.routines) {
      const value = JSON.parse(readFileSync(`public${entry.file}`, 'utf8'));
      const week = await activate(value);
      expect(week.sessions.length).toBe(value.days.length);
    }
    const count = await db.query<{ count: number }>('select count(*)::int as count from public.workout_weeks where is_active');
    expect(count.rows[0].count).toBe(1);
  });
  it('no reescribe el snapshot al editar una rutina', async () => {
    const week = await activate();
    await activate({ ...fixture, version: 2, name: 'Editada' });
    const result = await db.query<{ name: string }>("select routine_snapshot->>'name' as name from public.workout_weeks where id=$1", [week.id]);
    expect(result.rows[0].name).toBe(fixture.name);
  });
  it('revierte toda la activación si falla una validación', async () => {
    const existing = await activate();
    const invalid = structuredClone(fixture);
    invalid.id = 'broken'; invalid.days[0].sections[0].exercises[1].id = invalid.days[0].sections[0].exercises[0].id;
    await expect(activate(invalid)).rejects.toMatchObject({ code: '23505' });
    const result = await db.query<{ id: string }>('select id from public.workout_weeks where is_active');
    expect(result.rows).toEqual([{ id: existing.id }]);
    await expect(activate(fixture, '2026-10-13')).rejects.toMatchObject({ code: '22023' });
  });
  it('sincroniza series, ejercicio y sesión al completar y desmarcar', async () => {
    const session = (await activate()).sessions[0];
    const main = session.exercises[1].exerciseId;
    const first = await save(session.id, 0, { kind: 'set', exerciseId: main, setIndex: 0, completed: true });
    expect(first.status).toBe('in_progress');
    expect(first.exercises[1].completed).toBe(false);
    const second = await save(session.id, 1, { kind: 'set', exerciseId: main, setIndex: 1, completed: true });
    expect(second.exercises[1].completed).toBe(true);
    const done = await save(session.id, 2, { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true });
    expect(done.status).toBe('completed'); expect(done.performedDate).not.toBeNull();
    const undone = await save(session.id, 3, { kind: 'set', exerciseId: main, setIndex: 0, completed: false });
    expect(undone.status).toBe('in_progress'); expect(undone.performedDate).toBeNull();
  });
  it('un reintento viejo devuelve el estado actual sin invertir marcas', async () => {
    const session = (await activate()).sessions[0];
    const operation = { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true };
    const id = crypto.randomUUID();
    await save(session.id, 0, operation, id);
    await save(session.id, 1, { ...operation, completed: false });
    const replay = await save(session.id, 0, operation, id);
    expect(replay.revision).toBe(2); expect(replay.exercises[0].completed).toBe(false);
    await expect(save(session.id, 2, { ...operation, completed: false }, id)).rejects.toMatchObject({ code: '22023' });
  });
  it('rechaza conflictos de revisión y rangos inválidos sin escrituras parciales', async () => {
    const session = (await activate()).sessions[0];
    const operation = { kind: 'set', exerciseId: session.exercises[1].exerciseId, setIndex: 0, completed: true };
    await save(session.id, 0, operation);
    await expect(save(session.id, 0, { ...operation, completed: false })).rejects.toMatchObject({ code: '40001' });
    await expect(save(session.id, 1, { ...operation, setIndex: -1 })).rejects.toMatchObject({ code: '22023' });
    await expect(save(session.id, 1, { ...operation, setIndex: 2 })).rejects.toMatchObject({ code: '22023' });
    await expect(save(session.id, 1, { ...operation, completed: 'true' })).rejects.toMatchObject({ code: '22023' });
    const result = await db.query<{ revision: number }>('select revision from public.workout_sessions where id=$1', [session.id]);
    expect(result.rows[0].revision).toBe(1);
  });
  it('RLS y RPC aíslan cuentas y niegan modificaciones directas y helpers', async () => {
    const session = (await activate()).sessions[0];
    await asUser(B);
    expect((await db.query('select * from public.workout_sessions')).rows).toHaveLength(0);
    await expect(save(session.id, 0, { kind: 'reset' })).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('select public.glow_session_json($1)', [session.id])).rejects.toMatchObject({ code: '42501' });
    await expect(db.query("update public.workout_sessions set status='completed' where id=$1", [session.id])).rejects.toMatchObject({ code: '42501' });
    const result = await db.query<{ value: unknown }>("select public.glow_get_week($1, '2026-10-12') as value", [fixture.id]);
    expect(result.rows[0].value).toBeNull();
    const own = await activate(); expect(own.sessions[0].id).not.toBe(session.id);
  });
  it('reinicia solo la sesión elegida, conservando semanas anteriores', async () => {
    const old = (await activate(fixture, '2026-10-05')).sessions[0];
    await save(old.id, 0, { kind: 'exercise', exerciseId: old.exercises[0].exerciseId, completed: true });
    const current = (await activate()).sessions[0];
    await save(current.id, 0, { kind: 'exercise', exerciseId: current.exercises[0].exerciseId, completed: true });
    expect((await save(current.id, 1, { kind: 'reset' })).status).toBe('scheduled');
    const result = await db.query<{ completed: boolean }>('select completed from public.workout_exercises where session_id=$1 order by position', [old.id]);
    expect(result.rows[0].completed).toBe(true);
  });
  it('importa solo sesiones vacías y conserva fechas desconocidas', async () => {
    const session = (await activate()).sessions[0];
    const operation = { kind: 'import', exercises: session.exercises.map((item, index) => ({ exerciseId: item.exerciseId, completed: true, completedSets: index ? [0, 1] : [] })) };
    const id = crypto.randomUUID();
    const imported = await save(session.id, 0, operation, id);
    expect(imported.status).toBe('completed'); expect(imported.performedDate).toBeNull();
    expect((await save(session.id, 0, operation, id)).revision).toBe(1);
    await expect(save(session.id, 1, operation)).rejects.toMatchObject({ code: '22023' });
    const stamps = await db.query<{ started_at: unknown; completed_at: unknown }>('select started_at, completed_at from public.workout_sessions where id=$1', [session.id]);
    expect(stamps.rows[0]).toEqual({ started_at: null, completed_at: null });
  });
});
