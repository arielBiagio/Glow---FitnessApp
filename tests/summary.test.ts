import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createLocalWeek, applyOperation } from '../src/lib/workouts';
import { claimCelebration } from '../src/lib/celebrations';

const api = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: api }));
import { getRemoteActivity, summarizeActivity, weekActivity } from '../src/lib/workoutSummary';
const routine = JSON.parse(readFileSync('public/routines/glow-cele-split.json', 'utf8'));

describe('Resumen y celebración', () => {
  it('cuenta fechas y semanas distintas, no aperturas ni días planificados', () => {
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    expect(summarizeActivity(weekActivity(week)).days).toBe(0);
    week.sessions[0] = applyOperation(week.sessions[0], routine.days[0], { kind: 'exercise', exerciseId: week.sessions[0].exercises[0].exerciseId, completed: true });
    week.sessions[1] = applyOperation(week.sessions[1], routine.days[1], { kind: 'exercise', exerciseId: week.sessions[1].exercises[0].exerciseId, completed: true });
    expect(summarizeActivity(weekActivity(week))).toMatchObject({ days: 1, weeks: 1, sessions: 0, minutes: 0, exercises: 2 });
    week.sessions[0] = applyOperation(week.sessions[0], routine.days[0], { kind: 'reset' });
    expect(summarizeActivity(weekActivity(week)).exercises).toBe(1);
  });
  it('los minutos solo corresponden a sesiones completas', () => {
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    for (const exercise of week.sessions[0].exercises) week.sessions[0] = applyOperation(week.sessions[0], routine.days[0], { kind: 'exercise', exerciseId: exercise.exerciseId, completed: true });
    expect(summarizeActivity(weekActivity(week))).toMatchObject({ days: 1, weeks: 1, sessions: 1, minutes: routine.days[0].summary.total });
  });
  it('una celebración persiste entre lecturas y se reclama atómicamente', async () => {
    const owner = crypto.randomUUID();
    const claims = await Promise.all([claimCelebration(owner, routine.id, 'dia-a', '2026-10-12'), claimCelebration(owner, routine.id, 'dia-a', '2026-10-12')]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimCelebration(owner, routine.id, 'dia-a', '2026-10-12')).toBeNull();
    expect(await claimCelebration(owner, routine.id, 'dia-a', '2026-10-13')).not.toBeNull();
    expect(await claimCelebration(crypto.randomUUID(), routine.id, 'dia-a', '2026-10-12')).not.toBeNull();
  });
  it('lee las plantillas una vez por semana y pagina las sesiones sin repetir snapshots', async () => {
    const calls: { table: string; select: string; owner: string; offset: number }[] = [];
    api.from.mockImplementation((table: string) => {
      const call = { table, select: '', owner: '', offset: 0 };
      calls.push(call);
      const builder = {
        select: (value: string) => { call.select = value; return builder; },
        eq: (_key: string, value: string) => { call.owner = value; return builder; },
        gt: () => builder, order: () => builder,
        range: (offset: number) => { call.offset = offset; return builder; },
        abortSignal: () => Promise.resolve({ error: null, data: table === 'workout_weeks' ? [{ id: 'week-1', week_start: '2026-10-12', days: routine.days }] : Array.from({ length: call.offset ? 1 : 250 }, (_, i) => ({ id: `s-${call.offset + i}`, revision: 1, week_id: 'week-1', day_id: routine.days[0].id, session_date: '2026-10-12', status: 'completed', exercises: [{ completed: true, sets: [{ completed: true }] }] })) }),
      };
      return builder;
    });
    const entries = await getRemoteActivity('user-a', new AbortController().signal);
    expect(entries).toHaveLength(251);
    expect(calls.map(call => call.table)).toEqual(['workout_weeks', 'workout_sessions', 'workout_sessions']);
    expect(calls.every(call => call.owner === 'user-a')).toBe(true);
    expect(calls[1].select).not.toContain('routine_snapshot');
    expect(calls[2].offset).toBe(250);
    expect(entries[0].estimatedMinutes).toBe(routine.days[0].summary.total);
  });
});
