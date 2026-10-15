import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Routine } from '../src/types';
import { validateRoutine, createLocalWeek, applyOperation } from '../src/lib/workouts';
import { routineSchema } from '../supabase/functions/glow-mcp/routines.ts';

const routine: Routine = JSON.parse(readFileSync('public/routines/ariel-masa-fuerza.json', 'utf8'));
const manifest = JSON.parse(readFileSync('public/routines/index.json', 'utf8'));
const original: Routine = JSON.parse(readFileSync('public/routines/upper-lower-hypertrophy.json', 'utf8'));

describe('programa Ariel: JSON, calendario y registro', () => {
  it('conserva el esquema existente y es compatible con los dos validadores', () => {
    expect(Object.keys(routine).sort()).toEqual(Object.keys(original).sort());
    expect(validateRoutine(routine).id).toBe('ariel-masa-fuerza');
    expect(routineSchema.parse(routine).days).toHaveLength(4);
    expect(routine.name).toMatch(/^Ariel N°1/);
    expect(Buffer.byteLength(JSON.stringify(routine))).toBeLessThan(200000);
  });
  it('se añade al catálogo sin reemplazar las cuatro rutinas anteriores', () => {
    expect(manifest.routines.map((entry: { id: string }) => entry.id)).toEqual([
      'glow-cele-split', 'upper-lower-hypertrophy', 'fuerza-funcional', 'full-body-foundation', 'ariel-masa-fuerza',
    ]);
    const entry = manifest.routines.find((item: { id: string }) => item.id === routine.id);
    for (const field of ['id', 'name', 'description', 'level', 'frequency', 'goal', 'accentColor'] as const) {
      expect(entry[field]).toBe(routine[field]);
    }
    expect(entry.file).toBe('/routines/ariel-masa-fuerza.json');
  });
  it('distribuye los cuatro días con descansos y presupuesto de 60 minutos', () => {
    expect(routine.weeklySchedule.map(item => item.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(routine.weeklySchedule.filter(item => item.dayId).map(item => item.weekday)).toEqual([1, 2, 4, 5]);
    expect(routine.weeklySchedule.filter(item => !item.dayId)).toHaveLength(3);
    for (const day of routine.days) {
      expect(day.summary).toEqual({ warmup: 6, main: 42, metabolic: 8, cooldown: 4, total: 60 });
      expect(day.summary.warmup + day.summary.main + day.summary.metabolic! + day.summary.cooldown!).toBe(day.summary.total);
      expect(day.sections.map(section => section.badge)).toEqual(['Warmup', 'Main', 'Motor', 'Cooldown']);
      for (const section of day.sections) for (const exercise of section.exercises) {
        expect(Boolean(exercise.loggable)).toBe(section.badge === 'Main');
        if (exercise.loggable) expect(Number(exercise.volume.match(/^(\d+) ×/)?.[1])).toBe(exercise.sets);
      }
    }
  });
  it('usa IDs únicos y cantidades de series coherentes, sin material no disponible', () => {
    const exercises = routine.days.flatMap(day => day.sections.flatMap(section => section.exercises));
    expect(new Set(exercises.map(item => item.id)).size).toBe(exercises.length);
    expect(routine.days.map(day => day.sections[1].exercises.reduce((sum, item) => sum + item.sets!, 0))).toEqual([16, 12, 16, 14]);
    for (const exercise of exercises) {
      expect(exercise.name).not.toMatch(/press banca|barra olímpica|dominadas|paralelas|cajón|prensa|banda|foam roll/i);
    }
  });
  it.each(routine.days)('registra series y completa $name sin duplicar unilaterales', day => {
    const week = createLocalWeek(routine, '2026-10-12', 'America/New_York');
    let session = week.sessions.find(item => item.dayId === day.id)!;
    const first = day.sections[1].exercises[0];
    session = applyOperation(session, day, { kind: 'set', exerciseId: first.id, setIndex: 0, completed: true });
    expect(session.exercises.find(item => item.exerciseId === first.id)?.completedSets).toEqual([0]);
    for (const section of day.sections) for (const exercise of section.exercises) {
      if (exercise.loggable) {
        for (let index = 0; index < exercise.sets!; index++) {
          session = applyOperation(session, day, { kind: 'set', exerciseId: exercise.id, setIndex: index, completed: true });
        }
        expect(session.exercises.find(item => item.exerciseId === exercise.id)?.completedSets).toHaveLength(exercise.sets!);
      } else {
        session = applyOperation(session, day, { kind: 'exercise', exerciseId: exercise.id, completed: true });
      }
    }
    expect(session.status).toBe('completed');
    expect(week.routineSnapshot).toEqual(routine);
  });
});
