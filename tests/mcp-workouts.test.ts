import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createWorkoutReader, statisticsRange, validDate } from '../supabase/functions/glow-mcp/workoutReader.ts';
import { createRoutineCatalog, routineSchema } from '../supabase/functions/glow-mcp/routines.ts';
import { createLocalWeek, applyOperation } from '../src/lib/workouts';

const A = '11111111-1111-4111-8111-111111111111';
const base = 'https://example.supabase.co';
const app = 'https://gemini-rutina-cele.netlify.app';
const routine = JSON.parse(readFileSync('public/routines/glow-cele-split.json', 'utf8'));
const manifest = JSON.parse(readFileSync('public/routines/index.json', 'utf8'));
const emptyStats = { diasEntrenados: 0, semanasActivas: 0, sesionesCompletas: 0, minutosEstimados: 0, ejerciciosCompletos: 0, seriesCompletas: 0, primeraFechaActividad: null, ultimaFechaActividad: null };

function setup(options: { noWeek?: boolean; noProfile?: boolean; noRoutine?: boolean; timezone?: string; now?: string; statsFail?: boolean; catalogFail?: boolean; invalidFile?: boolean; oversized?: boolean } = {}) {
  const week = createLocalWeek({ ...routine, version: 2, name: 'Versión histórica guardada' }, '2026-10-12', 'America/New_York', '2026-10-12');
  const requests: Request[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init); const url = new URL(request.url); requests.push(request);
    if (url.origin === app) {
      expect(request.headers.has('Authorization')).toBe(false);
      expect(request.redirect).toBe('error');
      if (options.catalogFail) return new Response('Unavailable', { status: 503 });
      if (options.oversized) return new Response(' '.repeat(200001), { headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/routines/index.json') {
        const data = structuredClone(manifest);
        if (options.invalidFile) data.routines[0].file = 'https://evil.example/internal';
        return Response.json(data);
      }
      return Response.json(JSON.parse(readFileSync(`public${url.pathname}`, 'utf8')));
    }
    expect(url.origin).toBe(base);
    if (url.pathname === '/rest/v1/profiles') {
      expect(url.searchParams.get('id')).toBe(`eq.${A}`);
      return Response.json(options.noProfile ? [] : [{ id: A, display_name: 'Ana', timezone: options.timezone ?? 'America/New_York', selected_routine_id: options.noRoutine ? null : routine.id }]);
    }
    if (url.pathname === '/rest/v1/workout_weeks') {
      expect(url.searchParams.get('user_id')).toBe(`eq.${A}`);
      return Response.json(options.noWeek || url.searchParams.get('week_start') !== 'eq.2026-10-12' || url.searchParams.get('routine_id') !== `eq.${routine.id}` ? [] : [{ id: week.id, routine_id: routine.id, routine_version: 2, routine_snapshot: week.routineSnapshot }]);
    }
    if (url.pathname === '/rest/v1/workout_sessions') {
      expect(url.searchParams.get('user_id')).toBe(`eq.${A}`);
      expect(url.searchParams.get('week_id')).toBe(`eq.${week.id}`);
      const date = url.searchParams.get('session_date')?.slice(3);
      return Response.json(week.sessions.filter(session => !date || session.sessionDate === date).map(session => ({
        id: session.id, day_id: session.dayId, session_date: session.sessionDate, status: session.status, revision: session.revision,
        exercises: session.exercises.map(exercise => ({ exercise_id: exercise.exerciseId, completed: exercise.completed, sets: exercise.completedSets.map(index => ({ set_index: index, completed: true })) })),
      })));
    }
    if (url.pathname === '/rest/v1/rpc/glow_mcp_statistics') {
      expect(request.method).toBe('POST');
      if (options.statsFail) return Response.json({ code: 'PGRST202', message: 'INTERNAL MUST NOT LEAK' }, { status: 404 });
      return Response.json(emptyStats);
    }
    throw new Error('Unexpected mock request');
  };
  const client = createClient(base, 'sb_publishable_test', { accessToken: async () => 'fixture-token', global: { fetch: fetcher } });
  return { reader: createWorkoutReader(client, A, app, fetcher, new Date(options.now ?? '2026-10-13T02:30:00Z')), week, requests, fetcher };
}

describe('rutinas y calendario MCP', () => {
  it('valida las cuatro rutinas reales y lista el catálogo sin autenticación reenviada', async () => {
    for (const entry of manifest.routines) expect(routineSchema.parse(JSON.parse(readFileSync(`public${entry.file}`, 'utf8'))).id).toBe(entry.id);
    const { reader, requests } = setup();
    const result = await reader.listRoutines();
    expect(result.rutinas).toHaveLength(4);
    expect(result.rutinas[0]).not.toHaveProperty('file');
    expect(requests).toHaveLength(1);
  });
  it('prefiere la versión semanal guardada y no descarga la receta nueva por encima del historial', async () => {
    const { reader, requests } = setup();
    const result = await reader.selectedRoutine();
    expect(result.fuente).toBe('snapshot_semanal');
    expect(result.rutina.version).toBe(2);
    expect(result.rutina.nombre).toBe('Versión histórica guardada');
    expect(result.rutina.dias[0].secciones[1].ejercicios[0]).toMatchObject({ nombre: 'Hip Thrust', volumen: '4 × 8', descanso: '120s' });
    expect(requests.some(request => new URL(request.url).origin === app)).toBe(false);
  });
  it('hoy y mañana se calculan en la zona del perfil aunque el servidor ya esté en otro día', async () => {
    const { reader, week } = setup();
    const day = week.routineSnapshot.days[0];
    week.sessions[0] = applyOperation(week.sessions[0], day, { kind: 'set', exerciseId: day.sections[1].exercises[0].id, setIndex: 0, completed: true });
    const today = await reader.training('hoy');
    expect(today.fecha).toBe('2026-10-12');
    expect(today.entrenamientos[0]).toMatchObject({ id: 'dia-a', registroEnNube: true, estado: 'in_progress' });
    const hip = today.entrenamientos[0].secciones[1].ejercicios[0];
    expect(hip.seriesCompletas).toEqual([1]); expect(hip.seriesPendientes).toEqual([2, 3, 4]);
    const tomorrow = await reader.training('mañana');
    expect(tomorrow.fecha).toBe('2026-10-13');
    expect(tomorrow.entrenamientos[0]).toMatchObject({ id: 'dia-b', registroEnNube: false });
    expect(tomorrow.sesionesRegistradas).toEqual([]);
  });
  it('no convierte un descanso en la próxima sesión y conserva actividad fuera del plan', async () => {
    const { reader, week } = setup();
    const day = week.routineSnapshot.days[2];
    const offDay = { ...week.sessions[2], sessionDate: '2026-10-14' };
    week.sessions.push(applyOperation(offDay, day, { kind: 'exercise', exerciseId: day.sections[0].exercises[0].id, completed: true }));
    const rest = await reader.training('2026-10-14');
    expect(rest.descanso).toBe(true); expect(rest.entrenamientos).toEqual([]);
    expect(rest.proximoEntrenamiento?.fecha).toBe('2026-10-15');
    expect(rest.sesionesRegistradas[0]).toMatchObject({ diaId: 'dia-c', coincideConPlan: false, ejerciciosCompletos: 1 });
  });
  it('puede consultar una semana futura sin crear sesiones y avisa si falta una versión histórica', async () => {
    const { reader, requests } = setup({ noWeek: true });
    const future = await reader.training('2026-10-19');
    expect(future.fuente).toBe('catalogo_json'); expect(future.entrenamientos[0].registroEnNube).toBe(false);
    const past = await reader.training('2026-10-05');
    expect(past.advertenciaPlan).toContain('no un plan histórico confirmado');
    expect(requests.every(request => request.method === 'GET')).toBe(true);
  });
  it('no supone una rutina cuando falta perfil o selección y no inventa una zona inválida', async () => {
    await expect(setup({ noProfile: true }).reader.training()).rejects.toThrow('no tenés perfil');
    await expect(setup({ noRoutine: true }).reader.training()).rejects.toThrow('No hay una rutina seleccionada');
    await expect(setup({ timezone: 'Mars/Phobos' }).reader.training()).rejects.toThrow('zona horaria');
  });
  it('maneja cambio de año, DST y fechas inexistentes', async () => {
    expect((await setup({ noWeek: true, now: '2027-01-01T02:00:00Z' }).reader.training('mañana')).fecha).toBe('2027-01-01');
    expect((await setup({ noWeek: true, now: '2026-03-08T06:30:00Z' }).reader.training('mañana')).fecha).toBe('2026-03-09');
    expect(validDate('2024-02-29')).toBe('2024-02-29');
    for (const date of ['2026-02-29', '2026-13-01', '../other', '1999-01-01', '2100-01-01']) expect(() => validDate(date)).toThrow();
  });
  it('el catálogo rechaza rutas externas, contenido sobredimensionado y rutinas desconocidas', async () => {
    const invalid = setup({ invalidFile: true });
    await expect(invalid.reader.listRoutines()).rejects.toThrow();
    expect(invalid.requests).toHaveLength(1);
    await expect(setup({ oversized: true }).reader.listRoutines()).rejects.toThrow('tamaño');
    const valid = setup();
    await expect(createRoutineCatalog(app, valid.fetcher).get('unknown')).rejects.toThrow('no está en el catálogo');
    expect(() => createRoutineCatalog('http://localhost/internal', valid.fetcher)).toThrow();
  });
});

describe('estadísticas MCP', () => {
  it('resuelve semanas de lunes a domingo, mes, histórico y rangos personalizados', () => {
    expect(statisticsRange('2026-10-14', 'esta_semana')).toEqual({ desde: '2026-10-12', hasta: '2026-10-14' });
    expect(statisticsRange('2026-10-14', 'semana_pasada')).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' });
    expect(statisticsRange('2026-10-14', 'este_mes')).toEqual({ desde: '2026-10-01', hasta: '2026-10-14' });
    expect(statisticsRange('2026-10-14', 'historico')).toEqual({ desde: null, hasta: '2026-10-14' });
    expect(statisticsRange('2026-10-14', 'historico', '2026-09-01', '2026-09-30')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(() => statisticsRange('2026-10-14', 'historico', '2026-09-01')).toThrow();
    expect(() => statisticsRange('2026-10-14', 'historico', '2026-10-15', '2026-10-14')).toThrow();
  });
  it('no marca un día como pendiente si ya tiene una sesión completa esta semana', async () => {
    const { reader, week, requests } = setup();
    const day = week.routineSnapshot.days[0];
    for (const exercise of day.sections.flatMap(section => section.exercises)) week.sessions[0] = applyOperation(week.sessions[0], day, { kind: 'exercise', exerciseId: exercise.id, completed: true });
    const result = await reader.statistics('esta_semana');
    expect(result.avanceSemanaActual?.[0]).toMatchObject({ estado: 'completo', sesionesCompletas: 1 });
    expect(result.avanceSemanaActual?.[1].estado).toBe('pendiente');
    const rpc = requests.find(request => request.method === 'POST')!;
    expect(await rpc.clone().json()).toEqual({ p_from: '2026-10-12', p_to: '2026-10-12' });
    expect(result.minutos).toContain('no tiempo cronometrado');
    expect(result.aviso).toContain('pendientes del navegador');
  });
  it('historial vacío es cero, pero un error de permisos no se disfraza de cero', async () => {
    expect((await setup().reader.statistics()).estadisticas).toEqual(emptyStats);
    await expect(setup({ statsFail: true }).reader.statistics()).rejects.toThrow('migración 004');
  });
  it('conserva estadísticas si no hay rutina seleccionada o el catálogo está caído', async () => {
    const noRoutine = await setup({ noRoutine: true }).reader.statistics();
    expect(noRoutine.estadisticas).toEqual(emptyStats); expect(noRoutine.avanceSemanaActual).toBeNull();
    const failedCatalog = await setup({ noWeek: true, catalogFail: true }).reader.statistics();
    expect(failedCatalog.estadisticas).toEqual(emptyStats); expect(failedCatalog.avisoSemana).toBeTruthy();
  });
});
