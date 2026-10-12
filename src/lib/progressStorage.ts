import { openDB, type DBSchema } from 'idb';
import { applyOperation, createLocalWeek, type ProgressOperation, type WorkoutWeek, type WorkoutSession } from './workouts';
import type { Routine } from '../types';

export interface PendingOperation {
  sequence?: number;
  owner: string;
  key: string;
  sessionId: string;
  operationId: string;
  expectedRevision: number;
  operation: ProgressOperation;
}
interface CacheRecord { key: string; owner: string; week: WorkoutWeek; confirmed: WorkoutWeek }
interface ProgressDB extends DBSchema {
  weeks: { key: string; value: CacheRecord };
  pending: { key: number; value: PendingOperation; indexes: { owner: string } };
}

const database = () => openDB<ProgressDB>('glow-workouts-v2', 1, {
  upgrade(db) {
    db.createObjectStore('weeks', { keyPath: 'key' });
    const pending = db.createObjectStore('pending', { keyPath: 'sequence', autoIncrement: true });
    pending.createIndex('owner', 'owner');
  },
});

export const cacheKey = (owner: string, routineId: string, start: string, date?: string) => JSON.stringify([owner, routineId, start, date ?? '']);

export async function getCachedWeek(key: string): Promise<WorkoutWeek | null> {
  const db = await database();
  try { return (await db.get('weeks', key))?.week ?? null; } finally { db.close(); }
}

export async function getCachedWeeks(owner: string): Promise<WorkoutWeek[]> {
  const db = await database();
  try { return (await db.getAll('weeks')).filter(record => record.owner === owner).map(record => record.week); }
  finally { db.close(); }
}

export async function pendingOperations(owner: string): Promise<PendingOperation[]> {
  const db = await database();
  try { return await db.getAllFromIndex('pending', 'owner', owner); } finally { db.close(); }
}

export async function saveWeek(owner: string, key: string, week: WorkoutWeek): Promise<void> {
  const db = await database();
  try { await db.put('weeks', { key, owner, week, confirmed: structuredClone(week) }); } finally { db.close(); }
}

export async function prepareLocalDay(key: string, routine: Routine, start: string, timezone: string, date: string): Promise<WorkoutWeek> {
  const db = await database();
  try {
    const tx = db.transaction('weeks', 'readwrite');
    const stored = await tx.store.get(key);
    const week = stored?.week ?? createLocalWeek(routine, start, timezone, date);
    if (!week.sessions.some(session => session.sessionDate === date)) {
      week.sessions.push(...createLocalWeek(week.routineSnapshot, start, week.timezone, date).sessions);
    }
    await tx.store.put({ key, owner: 'local', week, confirmed: structuredClone(week) });
    await tx.done;
    return week;
  } finally { db.close(); }
}

// Optimistic state and its outbox entry are persisted in ONE IndexedDB transaction.
export async function enqueue(owner: string, key: string, sessionId: string, operation: ProgressOperation): Promise<WorkoutWeek> {
  const db = await database();
  try {
    const tx = db.transaction(['weeks', 'pending'], 'readwrite');
    const record = await tx.objectStore('weeks').get(key);
    if (!record || record.owner !== owner) throw new Error('No se pudo recuperar la sesión local.');
    const session = record.week.sessions.find(item => item.id === sessionId);
    const day = record.week.routineSnapshot.days.find(item => item.id === session?.dayId);
    if (!session || !day) throw new Error('Sesión desconocida.');
    const next = applyOperation(session, day, operation);
    record.week.sessions = record.week.sessions.map(item => item.id === sessionId ? next : item);
    if (owner !== 'local') {
      await tx.objectStore('pending').add({
        owner, key, sessionId, operationId: crypto.randomUUID(), expectedRevision: session.revision, operation,
      });
    }
    await tx.objectStore('weeks').put(record);
    await tx.done;
    return record.week;
  } finally { db.close(); }
}

function overlay(week: WorkoutWeek, confirmed: WorkoutSession, pending: PendingOperation[]): void {
  const day = week.routineSnapshot.days.find(item => item.id === confirmed.dayId)!;
  let session = confirmed;
  for (const item of pending.filter(item => item.sessionId === confirmed.id)) {
    // An import retried after an ambiguous response is already reflected remotely.
    if (item.operation.kind === 'import' && session.revision > 0) continue;
    session = applyOperation(session, day, item.operation);
  }
  week.sessions = week.sessions.map(item => item.id === session.id ? session : item);
}

export async function mergeRemote(owner: string, key: string, remote: WorkoutWeek): Promise<WorkoutWeek> {
  const db = await database();
  try {
    const tx = db.transaction(['weeks', 'pending'], 'readwrite');
    const existing = await tx.objectStore('weeks').get(key);
    const confirmed = structuredClone(remote);
    for (const session of confirmed.sessions) {
      const newer = existing?.confirmed?.sessions.find(item => item.id === session.id);
      if (newer && newer.revision > session.revision) confirmed.sessions = confirmed.sessions.map(item => item.id === session.id ? newer : item);
    }
    const week = structuredClone(confirmed);
    const pending = (await tx.objectStore('pending').index('owner').getAll(owner)).filter(item => item.key === key);
    for (const session of confirmed.sessions) overlay(week, session, pending);
    await tx.objectStore('weeks').put({ owner, key, week, confirmed });
    await tx.done;
    return week;
  } finally { db.close(); }
}

export async function acknowledge(item: PendingOperation, confirmed: WorkoutSession): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(['weeks', 'pending'], 'readwrite');
    const queued = await tx.objectStore('pending').get(item.sequence!);
    // Another tab may have acknowledged this receipt already. Never regress its cache.
    if (!queued) { await tx.done; return; }
    const record = await tx.objectStore('weeks').get(item.key);
    await tx.objectStore('pending').delete(item.sequence!);
    if (record && record.owner === item.owner) {
      const pending = await tx.objectStore('pending').index('owner').getAll(item.owner);
      const previous = record.confirmed.sessions.find(session => session.id === confirmed.id);
      if (!previous || confirmed.revision >= previous.revision) record.confirmed.sessions = record.confirmed.sessions.map(session => session.id === confirmed.id ? confirmed : session);
      record.week = structuredClone(record.confirmed);
      for (const session of record.confirmed.sessions) overlay(record.week, session, pending.filter(next => next.key === item.key));
      await tx.objectStore('weeks').put(record);
    }
    await tx.done;
  } finally { db.close(); }
}

// Explicit conflict choices only. Reset/import are never silently rebased.
export async function resolveQueue(owner: string, key: string, remote: WorkoutWeek, keepLocal: boolean, sessionId?: string): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(['weeks', 'pending'], 'readwrite');
    const pending = (await tx.objectStore('pending').index('owner').getAll(owner)).filter(item => item.key === key && (!sessionId || item.sessionId === sessionId));
    const week = structuredClone(remote);
    for (const item of pending) {
      if (!keepLocal) { await tx.objectStore('pending').delete(item.sequence!); continue; }
      const session = week.sessions.find(next => next.id === item.sessionId)!;
      item.expectedRevision = session.revision;
      const day = week.routineSnapshot.days.find(next => next.id === session.dayId)!;
      const next = applyOperation(session, day, item.operation);
      week.sessions = week.sessions.map(value => value.id === next.id ? next : value);
      await tx.objectStore('pending').put(item);
    }
    const remaining = (await tx.objectStore('pending').index('owner').getAll(owner)).filter(item => item.key === key);
    const optimistic = structuredClone(remote);
    for (const session of remote.sessions) overlay(optimistic, session, remaining);
    await tx.objectStore('weeks').put({ owner, key, week: optimistic, confirmed: structuredClone(remote) });
    await tx.done;
  } finally { db.close(); }
}
