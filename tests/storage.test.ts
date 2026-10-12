import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { acknowledge, cacheKey, enqueue, getCachedWeek, mergeRemote, pendingOperations, prepareLocalDay, resolveQueue, saveWeek } from '../src/lib/progressStorage';
import { applyOperation, createLocalWeek } from '../src/lib/workouts';
const routine = JSON.parse(readFileSync('public/routines/glow-cele-split.json', 'utf8'));

describe('Persistencia local y cola durable', () => {
  it('prepara el día siguiente automáticamente sin borrar ni duplicar el anterior', async () => {
    const key = cacheKey('local', crypto.randomUUID(), '2026-10-12');
    const monday = await prepareLocalDay(key, routine, '2026-10-12', 'UTC', '2026-10-12');
    await enqueue('local', key, monday.sessions[0].id, { kind: 'exercise', exerciseId: monday.sessions[0].exercises[0].exerciseId, completed: true });
    const tuesday = await prepareLocalDay(key, routine, '2026-10-12', 'UTC', '2026-10-13');
    expect(tuesday.sessions).toHaveLength(routine.days.length * 2);
    expect(tuesday.sessions[0].exercises[0].completed).toBe(true);
    expect(tuesday.sessions.find(session => session.dayId === 'dia-a' && session.sessionDate === '2026-10-13')?.exercises[0].completed).toBe(false);
    expect((await prepareLocalDay(key, routine, '2026-10-12', 'UTC', '2026-10-13')).sessions).toHaveLength(routine.days.length * 2);
  });
  it('resolver un conflicto de una sesión no descarta cambios de otro día', async () => {
    const owner = crypto.randomUUID();
    const key = cacheKey(owner, routine.id, '2026-10-12');
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    await saveWeek(owner, key, week);
    for (const session of week.sessions.slice(0, 2)) {
      await enqueue(owner, key, session.id, { kind: 'exercise', exerciseId: session.exercises[0].exerciseId, completed: true });
    }
    await resolveQueue(owner, key, week, false, week.sessions[0].id);
    const pending = await pendingOperations(owner);
    expect(pending).toHaveLength(1); expect(pending[0].sessionId).toBe(week.sessions[1].id);
    const cached = await getCachedWeek(key);
    expect(cached?.sessions[0].exercises[0].completed).toBe(false);
    expect(cached?.sessions[1].exercises[0].completed).toBe(true);
  });
  it('una respuesta lenta de lectura nunca revierte un guardado confirmado más reciente', async () => {
    const owner = crypto.randomUUID();
    const key = cacheKey(owner, routine.id, '2026-10-12');
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    const session = week.sessions[0];
    const operation = { kind: 'exercise' as const, exerciseId: session.exercises[0].exerciseId, completed: true };
    await saveWeek(owner, key, week);
    await enqueue(owner, key, session.id, operation);
    const [pending] = await pendingOperations(owner);
    await acknowledge(pending, applyOperation(session, routine.days[0], operation));
    await mergeRemote(owner, key, week); // read started before the write finished
    expect((await getCachedWeek(key))?.sessions[0].revision).toBe(1);
    expect((await getCachedWeek(key))?.sessions[0].exercises[0].completed).toBe(true);
  });
  it('guarda estado y operación, aislados por cuenta, y conserva clics tras recargar', async () => {
    const owner = crypto.randomUUID();
    const key = cacheKey(owner, routine.id, '2026-10-12');
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    const session = week.sessions[0];
    const operation = { kind: 'exercise' as const, exerciseId: session.exercises[0].exerciseId, completed: true };
    await saveWeek(owner, key, week);
    await enqueue(owner, key, session.id, operation);
    const pending = await pendingOperations(owner);
    expect(pending).toHaveLength(1);
    expect(await pendingOperations('another-user')).toHaveLength(0);
    expect((await getCachedWeek(key))?.sessions[0].exercises[0].completed).toBe(true);
    expect(pending[0].expectedRevision).toBe(0);
    await acknowledge(pending[0], applyOperation(session, routine.days[0], operation));
    expect(await pendingOperations(owner)).toHaveLength(0);
    expect((await getCachedWeek(key))?.sessions[0].revision).toBe(1);
  });
  it('reconcilia confirmaciones sin perder el cambio siguiente', async () => {
    const owner = crypto.randomUUID();
    const key = cacheKey(owner, routine.id, '2026-10-12');
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    const session = week.sessions[0];
    const operation = { kind: 'exercise' as const, exerciseId: session.exercises[0].exerciseId, completed: true };
    await saveWeek(owner, key, week);
    await enqueue(owner, key, session.id, operation);
    await enqueue(owner, key, session.id, { ...operation, completed: false });
    const pending = await pendingOperations(owner);
    expect(pending.map(item => item.expectedRevision)).toEqual([0, 1]);
    await acknowledge(pending[0], applyOperation(session, routine.days[0], operation));
    expect((await getCachedWeek(key))?.sessions[0].exercises[0].completed).toBe(false);
    expect((await pendingOperations(owner))).toHaveLength(1);
    await acknowledge(pending[0], session); // repeated ACK cannot regress local state
    expect((await getCachedWeek(key))?.sessions[0].revision).toBe(2);
  });
  it('descarta cambios solo después de una decisión explícita de conflicto', async () => {
    const owner = crypto.randomUUID();
    const key = cacheKey(owner, routine.id, '2026-10-12');
    const week = createLocalWeek(routine, '2026-10-12', 'UTC');
    await saveWeek(owner, key, week);
    await enqueue(owner, key, week.sessions[0].id, { kind: 'reset' });
    await resolveQueue(owner, key, week, false);
    expect(await pendingOperations(owner)).toHaveLength(0);
    expect((await getCachedWeek(key))?.sessions[0].revision).toBe(0);
  });
});
