import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyOperation, createLocalWeek, progressMaps, readLegacy, suggestedDayId, validateRoutine } from '../src/lib/workouts';
import { localDate, weekStart } from '../src/lib/dates';
const routine = JSON.parse(readFileSync('public/routines/glow-cele-split.json', 'utf8'));

describe('Calendario e identidad del progreso', () => {
  it('sugiere el día del calendario y el próximo entrenamiento durante el descanso', () => {
    expect(suggestedDayId(routine, '2026-10-12')).toBe('dia-a');
    expect(suggestedDayId(routine, '2026-10-13')).toBe('dia-b');
    expect(suggestedDayId(routine, '2026-10-14')).toBe('dia-c');
    expect(suggestedDayId(routine, '2026-10-18')).toBe('dia-a');
  });
  it('los mapas de hoy no incluyen marcas hechas ayer en el mismo Día A', () => {
    const monday = createLocalWeek(routine, '2026-10-12', 'UTC', '2026-10-12');
    monday.sessions[0].exercises[0].completed = true;
    const tuesday = createLocalWeek(routine, '2026-10-12', 'UTC', '2026-10-13');
    monday.sessions.push(...tuesday.sessions);
    const exercise = monday.sessions[0].exercises[0].exerciseId;
    expect(progressMaps(monday, '2026-10-12').completedExercises['dia-a'][exercise]).toBe(true);
    expect(progressMaps(monday, '2026-10-13').completedExercises['dia-a'][exercise]).toBe(false);
  });
  it('usa lunes local, incluso cuando UTC ya es lunes', () => {
    expect(weekStart(new Date('2026-10-12T02:00:00Z'), 'America/New_York')).toBe('2026-10-05');
    expect(weekStart(new Date('2026-10-12T04:00:00Z'), 'America/New_York')).toBe('2026-10-12');
    expect(localDate(new Date('2026-11-01T05:30:00Z'), 'America/New_York')).toBe('2026-11-01');
  });
  it('conserva snapshots y separa semanas', () => {
    const first = createLocalWeek(routine, '2026-10-05', 'UTC');
    const next = createLocalWeek(routine, '2026-10-12', 'UTC');
    expect(first.sessions[0].id).not.toBe(next.sessions[0].id);
    first.routineSnapshot.days[0].sections[0].exercises[0].name = 'Editado';
    expect(routine.days[0].sections[0].exercises[0].name).not.toBe('Editado');
  });
  it('rechaza IDs duplicados y límites inválidos', () => {
    const invalid = structuredClone(routine);
    invalid.days[0].sections[0].exercises[1].id = invalid.days[0].sections[0].exercises[0].id;
    expect(() => validateRoutine(invalid)).toThrow();
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    expect(() => applyOperation(week.sessions[0], routine.days[0], { kind: 'set', exerciseId: routine.days[0].sections[0].exercises[0].id, setIndex: -1, completed: true })).toThrow();
  });
  it('sincroniza el checkbox y todas sus series sin mutar el estado original', () => {
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    const exercise = routine.days[0].sections.flatMap((s: { exercises: { id: string; loggable?: boolean }[] }) => s.exercises).find((e: { loggable?: boolean }) => e.loggable)!;
    const next = applyOperation(week.sessions[0], routine.days[0], { kind: 'exercise', exerciseId: exercise.id, completed: true });
    expect(next.exercises.find(e => e.exerciseId === exercise.id)?.completedSets.length).toBeGreaterThan(0);
    expect(week.sessions[0].revision).toBe(0);
    expect(next.revision).toBe(1);
    const undone = applyOperation(next, routine.days[0], { kind: 'set', exerciseId: exercise.id, setIndex: 0, completed: false });
    expect(undone.exercises.find(e => e.exerciseId === exercise.id)?.completed).toBe(false);
  });
  it('importa nombres antiguos de forma segura y no inventa fechas', () => {
    const day = routine.days[0];
    const exercise = day.sections.flatMap((s: { exercises: { id: string; name: string; loggable?: boolean }[] }) => s.exercises).find((e: { loggable?: boolean }) => e.loggable)!;
    const storage = { getItem: (key: string) => key.endsWith('completed-sets') ? JSON.stringify({ [day.id]: { [exercise.name]: [0, 0, -1, 99, '1'] } }) : '{}' };
    const imported = readLegacy(routine, storage);
    expect(imported[day.id][0].completedSets).toEqual([0]);
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    const next = applyOperation(week.sessions[0], day, { kind: 'import', exercises: imported[day.id] });
    expect(next.performedDate).toBeNull();
    expect(() => applyOperation(next, day, { kind: 'import', exercises: imported[day.id] })).toThrow();
  });
});
