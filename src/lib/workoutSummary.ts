import { supabase } from './supabase';
import type { WorkoutDay } from '../types';
import type { WorkoutWeek } from './workouts';

export interface ActivityEntry {
  id: string;
  revision: number;
  date: string;
  weekStart: string;
  completed: boolean;
  started: boolean;
  exercises: number;
  sets: number;
  estimatedMinutes: number;
}

export function weekActivity(week: WorkoutWeek): ActivityEntry[] {
  return week.sessions.map(session => ({
    id: session.id, revision: session.revision, date: session.sessionDate, weekStart: week.weekStart,
    completed: session.status === 'completed', started: session.status !== 'scheduled',
    exercises: session.exercises.filter(exercise => exercise.completed).length,
    sets: session.exercises.reduce((total, exercise) => total + exercise.completedSets.length, 0),
    estimatedMinutes: session.status === 'completed' ? week.routineSnapshot.days.find(day => day.id === session.dayId)?.summary.total ?? 0 : 0,
  }));
}

interface HistoryRow {
  id: string;
  revision: number;
  week_id: string;
  day_id: string;
  session_date: string;
  status: string;
  exercises: { completed: boolean; sets: { completed: boolean }[] }[];
}

interface HistoryWeek { id: string; week_start: string; days: WorkoutDay[] }

// Read the existing owner-protected tables; no additional SQL or schema is needed.
export async function getRemoteActivity(userId: string, signal: AbortSignal): Promise<ActivityEntry[]> {
  if (!supabase) throw new Error('La nube no está configurada.');
  const entries: ActivityEntry[] = [];
  const pageSize = 250;
  const weeks = new Map<string, HistoryWeek>();
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('workout_weeks')
      .select('id,week_start,days:routine_snapshot->days').eq('user_id', userId).order('id')
      .range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    const rows = (data ?? []) as unknown as HistoryWeek[];
    for (const row of rows) weeks.set(row.id, row);
    if (rows.length < pageSize) break;
  }
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('workout_sessions')
      .select('id,revision,week_id,day_id,session_date,status,exercises:workout_exercises(completed,sets:workout_sets(completed))')
      .eq('user_id', userId).gt('revision', 0).order('id')
      .range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    const rows = (data ?? []) as unknown as HistoryRow[];
    for (const row of rows) {
      const week = weeks.get(row.week_id);
      if (!week) throw new Error('El historial cambió durante la lectura. Reintentá actualizarlo.');
      entries.push({
        id: row.id, revision: row.revision, date: row.session_date, weekStart: week.week_start,
        completed: row.status === 'completed', started: row.status !== 'scheduled',
        exercises: row.exercises.filter(exercise => exercise.completed).length,
        sets: row.exercises.reduce((total, exercise) => total + exercise.sets.filter(set => set.completed).length, 0),
        estimatedMinutes: row.status === 'completed' ? week.days.find(day => day.id === row.day_id)?.summary.total ?? 0 : 0,
      });
    }
    if (rows.length < pageSize) return entries;
  }
}

export function summarizeActivity(entries: ActivityEntry[]) {
  const activity = entries.filter(entry => entry.started);
  return {
    days: new Set(activity.map(entry => entry.date)).size,
    weeks: new Set(activity.map(entry => entry.weekStart)).size,
    sessions: activity.filter(entry => entry.completed).length,
    exercises: activity.reduce((total, entry) => total + entry.exercises, 0),
    sets: activity.reduce((total, entry) => total + entry.sets, 0),
    minutes: activity.reduce((total, entry) => total + entry.estimatedMinutes, 0),
  };
}
