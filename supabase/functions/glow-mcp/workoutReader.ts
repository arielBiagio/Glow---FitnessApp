import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { localDate, shiftDate, weekStart } from '../../../src/lib/dates.ts';
import { createRoutineCatalog, routineSchema, WorkoutReadError, type RoutineDocument, type RoutineDay } from './routines.ts';

const cloudNotice = 'Solo incluye datos sincronizados en Supabase; los cambios pendientes del navegador no se ven todavía.';
const profileSchema = z.object({ id: z.string().uuid(), display_name: z.string().nullable(), timezone: z.string(), selected_routine_id: z.string().nullable() });
const sessionSchema = z.object({
  id: z.string().uuid(), day_id: z.string(), session_date: z.string(), revision: z.number().int().min(0),
  status: z.enum(['scheduled', 'in_progress', 'completed']),
  exercises: z.array(z.object({ exercise_id: z.string(), completed: z.boolean(), sets: z.array(z.object({ set_index: z.number().int().min(0).max(49), completed: z.boolean() })) })),
});
const statisticsSchema = z.object({
  diasEntrenados: z.number().int().min(0), semanasActivas: z.number().int().min(0), sesionesCompletas: z.number().int().min(0),
  minutosEstimados: z.number().min(0), ejerciciosCompletos: z.number().int().min(0), seriesCompletas: z.number().int().min(0),
  primeraFechaActividad: z.string().nullable(), ultimaFechaActividad: z.string().nullable(),
});
type SessionRow = z.infer<typeof sessionSchema>;
type WeekRow = { id: string; routine_id: string; routine_version: number; routine_snapshot: unknown };
type Context = { routine: RoutineDocument; week: WeekRow | null; date: string; start: string; source: 'snapshot_semanal' | 'catalogo_json' };
export type StatisticsPeriod = 'historico' | 'esta_semana' | 'semana_pasada' | 'este_mes';

export function validDate(value: string): string {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new WorkoutReadError('Usá una fecha YYYY-MM-DD entre 2000 y 2099.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new WorkoutReadError('La fecha no existe.');
  return value;
}
const startOfWeek = (date: string) => weekStart(new Date(`${date}T12:00:00Z`), 'UTC');
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() || 7;

function queryError(error: { code?: string } | null) {
  if (!error) return;
  if (['42501', 'PGRST202'].includes(error.code ?? '')) throw new WorkoutReadError('Falta habilitar la migración 004 de lectura de entrenamientos para el MCP.');
  throw new WorkoutReadError('No se pudo consultar el historial de GLOW. Intentá nuevamente.');
}

export function statisticsRange(today: string, period: StatisticsPeriod, from?: string, to?: string) {
  const start = startOfWeek(today);
  let desde: string | null = null; let hasta: string | null = today;
  if (period === 'esta_semana') desde = start;
  if (period === 'semana_pasada') { desde = shiftDate(start, -7); hasta = shiftDate(start, -1); }
  if (period === 'este_mes') desde = `${today.slice(0, 7)}-01`;
  if (from !== undefined || to !== undefined) {
    if (from === undefined || to === undefined) throw new WorkoutReadError('Para un período personalizado indicá desde y hasta.');
    desde = validDate(from); hasta = validDate(to);
  }
  if (desde && hasta && desde > hasta) throw new WorkoutReadError('La fecha desde debe ser anterior o igual a hasta.');
  return { desde, hasta };
}

export function createWorkoutReader(client: SupabaseClient, userId: string, appUrl: string, fetcher: typeof fetch, now = new Date()) {
  const catalog = createRoutineCatalog(appUrl, fetcher);
  let profile: Promise<z.infer<typeof profileSchema> | null> | undefined;
  const readProfile = () => profile ??= (async () => {
    const { data, error } = await client.from('profiles').select('id,display_name,timezone,selected_routine_id').eq('id', userId).maybeSingle();
    queryError(error);
    return data ? profileSchema.parse(data) : null;
  })();
  const ownProfile = async () => {
    const value = await readProfile();
    if (!value) throw new WorkoutReadError('Todavía no tenés perfil de entrenamiento. Abrí GLOW para configurarlo.');
    try { localDate(now, value.timezone); } catch { throw new WorkoutReadError('La zona horaria de tu perfil no es válida.'); }
    return value;
  };
  const context = async (date: string, routineId?: string): Promise<Context> => {
    const owner = await ownProfile();
    const id = routineId ?? owner.selected_routine_id;
    if (!id) throw new WorkoutReadError('No hay una rutina seleccionada. Elegila en GLOW antes de consultar tu entrenamiento.');
    const start = startOfWeek(date);
    const { data, error } = await client.from('workout_weeks').select('id,routine_id,routine_version,routine_snapshot')
      .eq('user_id', userId).eq('routine_id', id).eq('week_start', start).maybeSingle();
    queryError(error);
    if (data) {
      const week = data as WeekRow;
      const routine = routineSchema.parse(week.routine_snapshot);
      if (routine.id !== id || routine.version !== week.routine_version) throw new WorkoutReadError('La versión guardada de tu rutina no coincide con el historial.');
      return { routine, week, date, start, source: 'snapshot_semanal' };
    }
    return { routine: await catalog.get(id), week: null, date, start, source: 'catalogo_json' };
  };
  const sessions = async (value: Context, date?: string): Promise<SessionRow[]> => {
    if (!value.week) return [];
    let query = client.from('workout_sessions').select('id,day_id,session_date,status,revision,exercises:workout_exercises(exercise_id,completed,sets:workout_sets(set_index,completed))')
      .eq('user_id', userId).eq('week_id', value.week.id).order('session_date').order('day_id').limit(100);
    if (date) query = query.eq('session_date', date);
    const { data, error } = await query;
    queryError(error);
    // A week has at most 7 days × 7 templates. Never silently truncate bad data.
    if ((data?.length ?? 0) >= 100) throw new WorkoutReadError('El historial semanal supera el límite esperado.');
    return z.array(sessionSchema).parse(data ?? []);
  };
  const dayDetails = (day: RoutineDay, session?: SessionRow) => {
    const definitions = day.sections.flatMap(section => section.exercises);
    if (session && (session.exercises.length !== definitions.length || session.exercises.some(item => !definitions.some(def => def.id === item.exercise_id)))) {
      throw new WorkoutReadError('El detalle de ejercicios no coincide con la sesión guardada.');
    }
    const sections = day.sections.map(section => ({ id: section.id, nombre: section.title, nota: section.note ?? null,
      ejercicios: section.exercises.map(item => {
        const saved = session?.exercises.find(value => value.exercise_id === item.id);
        const completedSets = [...new Set(saved?.sets.filter(value => value.completed).map(value => value.set_index + 1) ?? [])].sort((a, b) => a - b);
        return { id: item.id, nombre: item.name, volumen: item.volume, descanso: item.rest ?? null,
          indicaciones: item.description ?? null, consejo: item.tip ?? null, fundamento: item.science ?? null,
          completado: saved?.completed ?? false, seriesObjetivo: item.loggable ? item.sets! : null,
          seriesCompletas: completedSets,
          seriesPendientes: item.loggable ? Array.from({ length: item.sets! }, (_, index) => index + 1).filter(index => !completedSets.includes(index)) : null };
      }) }));
    const exercises = sections.flatMap(section => section.ejercicios);
    return { id: day.id, nombre: day.name, enfoque: day.subtitle, minutosPrevistos: day.summary.total,
      registroEnNube: Boolean(session), estado: session?.status ?? 'sin_registro',
      ejerciciosCompletos: exercises.filter(item => item.completado).length, ejerciciosTotales: exercises.length,
      ejerciciosPendientes: exercises.filter(item => !item.completado).map(item => item.nombre), secciones: sections };
  };
  const selectedRoutine = async (routineId?: string) => {
    const owner = await ownProfile(); const today = localDate(now, owner.timezone);
    const value = await context(today, routineId);
    const routine = value.routine;
    const currentSessions = await sessions(value);
    return { fechaLocal: today, zonaHoraria: owner.timezone, fuente: value.source,
      rutina: { id: routine.id, version: routine.version, nombre: routine.name, descripcion: routine.description,
        objetivo: routine.goal, nivel: routine.level, frecuencia: routine.frequency,
        calendario: routine.weeklySchedule.map(item => ({ diaSemana: item.weekday, dia: item.day, sesion: item.session, nombre: item.name, diaId: item.dayId ?? null })),
        dias: routine.days.map(day => ({ id: day.id, nombre: day.name, enfoque: day.subtitle, minutosPrevistos: day.summary.total,
          secciones: day.sections.map(section => ({ nombre: section.title, nota: section.note ?? null,
            ejercicios: section.exercises.map(item => ({ id: item.id, nombre: item.name, volumen: item.volume, descanso: item.rest ?? null,
              indicaciones: item.description ?? null, consejo: item.tip ?? null, fundamento: item.science ?? null,
              seriesRegistrables: item.loggable ? item.sets! : null })) })) })),
      },
      avanceSemana: routine.days.map(day => ({ id: day.id, nombre: day.name,
        sesionesCompletas: currentSessions.filter(session => session.day_id === day.id && session.status === 'completed').length,
        sesionesEnCurso: currentSessions.filter(session => session.day_id === day.id && session.status === 'in_progress').length,
      })),
      aviso: cloudNotice,
    };
  };
  return {
    listRoutines: async () => ({ rutinas: await catalog.list(), fuente: 'catalogo_json' }),
    selectedRoutine,
    training: async (requested = 'hoy') => {
      const owner = await ownProfile(); const today = localDate(now, owner.timezone);
      const date = requested === 'hoy' ? today : ['mañana', 'manana'].includes(requested) ? shiftDate(today, 1) : validDate(requested);
      const value = await context(date);
      const rows = await sessions(value, date);
      const calendar = value.routine.weeklySchedule.filter(item => item.weekday === weekday(date));
      const planned = value.routine.days.filter(day => calendar.some(item => item.dayId === day.id));
      let next: { fecha: string; nombres: string[]; tipo: string } | null = null;
      for (let offset = 1; offset <= 7 && !next; offset++) {
        const nextDate = shiftDate(date, offset);
        const entries = value.routine.weeklySchedule.filter(item => item.weekday === weekday(nextDate) && item.dayId);
        if (entries.length) next = { fecha: nextDate, nombres: entries.map(item => item.name), tipo: 'proyeccion_del_calendario' };
      }
      return { fecha: date, hoy: today, zonaHoraria: owner.timezone, fuente: value.source,
        rutina: { id: value.routine.id, nombre: value.routine.name, version: value.routine.version },
        descanso: planned.length === 0 && calendar.length > 0,
        planDisponible: calendar.length > 0, actividadesDelCalendario: calendar.map(item => item.name),
        advertenciaPlan: date < today && !value.week ? 'No hay un snapshot de esa semana; se muestra una proyección del calendario actual, no un plan histórico confirmado.' : null,
        entrenamientos: planned.map(day => dayDetails(day, rows.find(session => session.day_id === day.id))),
        sesionesRegistradas: rows.filter(row => row.revision > 0).map(row => ({ diaId: row.day_id, estado: row.status,
          coincideConPlan: planned.some(day => day.id === row.day_id),
          ejerciciosCompletos: row.exercises.filter(item => item.completed).length,
          seriesCompletas: row.exercises.reduce((sum, item) => sum + item.sets.filter(set => set.completed).length, 0) })),
        proximoEntrenamiento: next, aviso: cloudNotice,
      };
    },
    statistics: async (period: StatisticsPeriod = 'historico', from?: string, to?: string) => {
      const owner = await ownProfile(); const today = localDate(now, owner.timezone);
      const range = statisticsRange(today, period, from, to);
      const { data, error } = await client.rpc('glow_mcp_statistics', { p_from: range.desde, p_to: range.hasta });
      queryError(error);
      const statistics = statisticsSchema.parse(data);
      let progress: { diaId: string; nombre: string; estado: string; sesionesCompletas: number }[] | null = null;
      let notice: string | null = null;
      if (owner.selected_routine_id) {
        try {
          const value = await context(today); const rows = await sessions(value);
          progress = value.routine.days.map(day => {
            const complete = rows.filter(row => row.day_id === day.id && row.status === 'completed').length;
            const started = rows.some(row => row.day_id === day.id && row.status === 'in_progress');
            return { diaId: day.id, nombre: day.name, estado: complete ? 'completo' : started ? 'en_curso' : 'pendiente', sesionesCompletas: complete };
          });
        } catch { notice = 'Las estadísticas se cargaron, pero no se pudo obtener el avance de la rutina actual.'; }
      }
      return { periodo: from !== undefined ? 'personalizado' : period, ...range, fechaLocal: today, zonaHoraria: owner.timezone,
        estadisticas: statistics, avanceSemanaActual: progress, avisoSemana: notice,
        minutos: 'Duración prevista de las sesiones completas; no tiempo cronometrado.', aviso: cloudNotice };
    },
  };
}
