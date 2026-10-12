import type { Routine, WorkoutDay, CompletedMap, SetsMap } from '../types';
import { shiftDate } from './dates';

export interface SessionExercise {
  exerciseId: string;
  completed: boolean;
  completedSets: number[];
}
export interface WorkoutSession {
  id: string;
  dayId: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  revision: number;
  plannedDate: string;
  sessionDate: string;
  performedDate: string | null;
  exercises: SessionExercise[];
}
export interface WorkoutWeek {
  id: string;
  weekStart: string;
  timezone: string;
  isActive: boolean;
  routineSnapshot: Routine;
  sessions: WorkoutSession[];
}
export type ProgressOperation =
  | { kind: 'set'; exerciseId: string; setIndex: number; completed: boolean }
  | { kind: 'exercise'; exerciseId: string; completed: boolean }
  | { kind: 'reset' }
  | { kind: 'import'; exercises: SessionExercise[] };

export function validateRoutine(value: Routine): Routine {
  if (!value?.id || !Number.isInteger(value.version) || value.version < 1 || !value.days?.length || !Array.isArray(value.weeklySchedule)) {
    throw new Error('La rutina tiene un formato inválido.');
  }
  const dayIds = new Set<string>();
  for (const day of value.days) {
    if (!day.id || dayIds.has(day.id) || !day.sections?.length) throw new Error('Días de rutina inválidos.');
    dayIds.add(day.id);
    const ids = new Set<string>();
    for (const section of day.sections) for (const exercise of section.exercises) {
      if (!section.id || !exercise.id || !exercise.name || ids.has(exercise.id)) throw new Error('Identificadores de ejercicio inválidos.');
      if (exercise.loggable && (!Number.isInteger(exercise.sets) || exercise.sets! < 1 || exercise.sets! > 50)) throw new Error('Series previstas inválidas.');
      ids.add(exercise.id);
    }
    if (!ids.size) throw new Error('Un día no puede estar vacío.');
  }
  for (const dayId of dayIds) {
    const entries = value.weeklySchedule.filter(entry => entry.dayId === dayId);
    if (entries.length !== 1 || !Number.isInteger(entries[0].weekday) || entries[0].weekday < 1 || entries[0].weekday > 7) {
      throw new Error('El calendario debe asignar una fecha a cada entrenamiento.');
    }
  }
  return value;
}

export function createLocalWeek(routine: Routine, start: string, timezone: string, sessionDate = start): WorkoutWeek {
  validateRoutine(routine);
  return {
    id: crypto.randomUUID(), weekStart: start, timezone, isActive: true,
    routineSnapshot: structuredClone(routine),
    sessions: routine.days.map(day => ({
      id: crypto.randomUUID(), dayId: day.id, status: 'scheduled', revision: 0,
      plannedDate: shiftDate(start, routine.weeklySchedule.find(entry => entry.dayId === day.id)!.weekday - 1),
      sessionDate,
      performedDate: null,
      exercises: day.sections.flatMap(section => section.exercises.map(exercise => ({
        exerciseId: exercise.id, completed: false, completedSets: [],
      }))),
    })),
  };
}

export function applyOperation(session: WorkoutSession, day: WorkoutDay, operation: ProgressOperation): WorkoutSession {
  const next = structuredClone(session);
  const definitions = day.sections.flatMap(section => section.exercises);
  if (operation.kind === 'reset') {
    next.exercises.forEach(exercise => { exercise.completed = false; exercise.completedSets = []; });
  } else if (operation.kind === 'import') {
    if (next.revision !== 0) throw new Error('La sesión ya tiene progreso.');
    for (const imported of operation.exercises) {
      const exercise = next.exercises.find(item => item.exerciseId === imported.exerciseId);
      const definition = definitions.find(item => item.id === imported.exerciseId);
      if (!exercise || !definition) throw new Error('Ejercicio desconocido.');
      if (imported.completedSets.some(index => !Number.isInteger(index) || index < 0 || index >= (definition.sets ?? 0))) throw new Error('Serie inválida.');
      exercise.completedSets = definition.loggable ? [...new Set(imported.completedSets)].sort((a, b) => a - b) : [];
      exercise.completed = definition.loggable ? exercise.completedSets.length === definition.sets : imported.completed;
    }
  } else {
    const exercise = next.exercises.find(item => item.exerciseId === operation.exerciseId);
    const definition = definitions.find(item => item.id === operation.exerciseId);
    if (!exercise || !definition) throw new Error('Ejercicio desconocido.');
    if (operation.kind === 'exercise') {
      exercise.completed = operation.completed;
      exercise.completedSets = definition.loggable && operation.completed ? Array.from({ length: definition.sets! }, (_, index) => index) : [];
    } else {
      if (!definition.loggable || !Number.isInteger(operation.setIndex) || operation.setIndex < 0 || operation.setIndex >= definition.sets!) throw new Error('Serie inválida.');
      const indices = new Set(exercise.completedSets);
      if (operation.completed) indices.add(operation.setIndex); else indices.delete(operation.setIndex);
      exercise.completedSets = [...indices].sort((a, b) => a - b);
      exercise.completed = indices.size === definition.sets;
    }
  }
  next.revision++;
  next.status = next.exercises.every(item => item.completed) ? 'completed' :
    next.exercises.some(item => item.completed || item.completedSets.length) ? 'in_progress' : 'scheduled';
  return next;
}

export function progressMaps(week: WorkoutWeek | null, sessionDate?: string): { completedExercises: CompletedMap; completedSets: SetsMap } {
  const completedExercises: CompletedMap = {};
  const completedSets: SetsMap = {};
  for (const session of week?.sessions ?? []) {
    if (sessionDate && session.sessionDate !== sessionDate) continue;
    completedExercises[session.dayId] = Object.fromEntries(session.exercises.map(item => [item.exerciseId, item.completed]));
    completedSets[session.dayId] = Object.fromEntries(session.exercises.map(item => [item.exerciseId, item.completedSets]));
  }
  return { completedExercises, completedSets };
}

export function suggestedDayId(routine: Routine | null, date: string): string {
  if (!routine) return 'resumen';
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  for (let offset = 0; offset < 7; offset++) {
    const day = routine.weeklySchedule.find(entry => entry.weekday === ((weekday - 1 + offset) % 7) + 1 && entry.dayId);
    if (day?.dayId) return day.dayId;
  }
  return routine.days[0]?.id ?? 'resumen';
}

export function readLegacy(routine: Routine, storage: Pick<Storage, 'getItem'> = localStorage, onIssue: (message: string) => void = () => {}): Record<string, SessionExercise[]> {
  const read = (suffix: string): Record<string, unknown> => {
    try {
      const value = JSON.parse(storage.getItem(`glow-split:${routine.id}:${suffix}`) ?? '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
      onIssue('El respaldo contiene un formato no reconocido.'); return {};
    } catch { onIssue('No se pudo leer parte del respaldo anterior.'); return {}; }
  };
  const completed = read('completed-exercises');
  const sets = read('completed-sets');
  for (const dayId of new Set([...Object.keys(completed), ...Object.keys(sets)])) {
    if (!routine.days.some(day => day.id === dayId)) onIssue(`No se reconoce el día anterior: ${dayId}.`);
  }
  const result: Record<string, SessionExercise[]> = {};
  for (const day of routine.days) {
    const dayCompleted = (completed[day.id] ?? {}) as Record<string, unknown>;
    const daySets = (sets[day.id] ?? {}) as Record<string, unknown>;
    const definitions = day.sections.flatMap(section => section.exercises);
    const names = definitions.map(item => item.name);
    for (const name of new Set([...Object.keys(dayCompleted), ...Object.keys(daySets)])) {
      if (names.filter(item => item === name).length !== 1) onIssue(`No se pudo asociar el ejercicio anterior: ${name}.`);
    }
    const entries = definitions.filter(item => names.filter(name => name === item.name).length === 1).map(item => {
      const raw = daySets[item.name];
      if (Array.isArray(raw) && raw.some(index => !Number.isInteger(index) || index < 0 || index >= (item.sets ?? 0))) onIssue(`Hay series inválidas en ${item.name}; solo se importarán las válidas.`);
      const indices = Array.isArray(raw) ? [...new Set(raw.filter(index => Number.isInteger(index) && index >= 0 && index < (item.sets ?? 0)))] as number[] : [];
      // An explicit sets array is authoritative; a legacy whole-exercise mark is used only when no array exists.
      const completedSets = item.loggable ? Array.isArray(raw) ? indices : dayCompleted[item.name] === true ? Array.from({ length: item.sets! }, (_, index) => index) : [] : [];
      if (item.loggable && Array.isArray(raw) && dayCompleted[item.name] === true && completedSets.length !== item.sets) onIssue(`Se usará el detalle de series de ${item.name}, aunque la marca general indique completado.`);
      return { exerciseId: item.id, completed: item.loggable ? completedSets.length === item.sets : dayCompleted[item.name] === true, completedSets };
    }).filter(item => item.completed || item.completedSets.length);
    if (entries.length) result[day.id] = entries;
  }
  return result;
}
