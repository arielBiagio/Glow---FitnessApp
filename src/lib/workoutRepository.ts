import { supabase } from './supabase';
import type { Routine } from '../types';
import type { WorkoutSession, WorkoutWeek } from './workouts';
import { acknowledge, pendingOperations, type PendingOperation } from './progressStorage';

export class RepositoryError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new RepositoryError('La nube todavía no está configurada.', 'CONFIG');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new RepositoryError(error.message, error.code ?? 'NETWORK');
  return data as T;
}

export function getProfile(timezone: string): Promise<{ timezone: string; selectedRoutineId: string | null }> {
  return rpc('glow_get_profile', { p_timezone: timezone });
}

export async function getDisplayName(userId: string): Promise<string | null> {
  if (!supabase) return null;
  // Keep the existing profile RPC intact; read the added column with owner RLS.
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  if (error) throw new RepositoryError(error.message, error.code ?? 'NETWORK');
  return typeof data?.display_name === 'string' ? data.display_name.trim().replace(/\s+/g, ' ') || null : null;
}
export function getRemoteWeek(routineId: string, start: string): Promise<WorkoutWeek | null> {
  return rpc('glow_get_week', { p_routine_id: routineId, p_week_start: start });
}
export function activateRemoteWeek(routine: Routine, start: string, timezone: string, date: string): Promise<WorkoutWeek> {
  return rpc('glow_activate_week', { p_routine: routine, p_week_start: start, p_timezone: timezone, p_session_date: date });
}

export async function sendOperation(item: PendingOperation): Promise<WorkoutSession> {
  const { data } = await supabase!.auth.getSession();
  if (data.session?.user.id !== item.owner) throw new RepositoryError('Ingresá nuevamente para guardar tus cambios.', 'AUTH');
  return rpc('glow_save_progress', {
    p_session_id: item.sessionId, p_operation_id: item.operationId,
    p_expected_revision: item.expectedRevision, p_operation: item.operation,
  });
}

const running = new Map<string, Promise<void>>();
export function synchronize(owner: string, onSaved: () => void, isCurrent: () => boolean): Promise<void> {
  const existing = running.get(owner);
  if (existing) return existing.then(() => isCurrent() ? synchronize(owner, onSaved, isCurrent) : undefined);
  const promise = (async () => {
    while (isCurrent()) {
      const item = (await pendingOperations(owner))[0];
      if (!item || !isCurrent()) break;
      const confirmed = await sendOperation(item);
      await acknowledge(item, confirmed);
      if (isCurrent()) onSaved();
    }
  })().finally(() => { if (running.get(owner) === promise) running.delete(owner); });
  running.set(owner, promise);
  return promise;
}
