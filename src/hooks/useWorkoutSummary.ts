import { useEffect, useMemo, useState } from 'react';
import { getCachedWeeks, pendingOperations } from '../lib/progressStorage';
import { getRemoteActivity, summarizeActivity, weekActivity, type ActivityEntry } from '../lib/workoutSummary';
import type { useWorkoutProgress } from './useWorkoutProgress';

export function useWorkoutSummary(userId: string | null, progress: ReturnType<typeof useWorkoutProgress>, enabled: boolean, ready: boolean) {
  const owner = userId ?? 'local';
  const [history, setHistory] = useState<{ owner: string; entries: ActivityEntry[] }>({ owner: '', entries: [] });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { saveStatus, week } = progress;
  const syncReady = !progress.loading && saveStatus !== 'saving';

  useEffect(() => {
    if (!enabled) return;
    const update = () => setRefresh(value => value + 1);
    window.addEventListener('online', update);
    window.addEventListener('focus', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('focus', update); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready || !syncReady) return;
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true); setNotice('');
    void (async () => {
      const cached = (await getCachedWeeks(owner)).flatMap(weekActivity);
      if (!alive) return;
      setHistory({ owner, entries: cached });
      if (!userId) return;
      if (!navigator.onLine) { setNotice('Sin conexión: mostrando el historial disponible en este dispositivo.'); return; }
      try {
        const remote = await getRemoteActivity(userId, controller.signal);
        const pending = new Set((await pendingOperations(owner)).map(operation => operation.sessionId));
        const combined = new Map(remote.map(entry => [entry.id, entry]));
        for (const entry of cached) if (pending.has(entry.id)) combined.set(entry.id, entry);
        if (alive) setHistory({ owner, entries: [...combined.values()] });
      } catch {
        if (alive) setNotice('No se pudo actualizar el historial de la nube. Mostrando los datos de este dispositivo.');
      }
    })().catch(() => {
      if (alive) setNotice('No se pudo cargar el historial.');
    }).finally(() => { clearTimeout(timeout); if (alive) setLoading(false); });
    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [enabled, ready, owner, userId, syncReady, refresh]);

  const stats = useMemo(() => {
    const entries = new Map((history.owner === owner ? history.entries : []).map(entry => [entry.id, entry]));
    // Include optimistic changes immediately, including resets that remove activity.
    if (week) for (const entry of weekActivity(week)) {
      const recorded = entries.get(entry.id);
      if (!recorded || entry.revision >= recorded.revision) entries.set(entry.id, entry);
    }
    return summarizeActivity([...entries.values()]);
  }, [owner, history, week]);

  return { stats, loading: loading || !ready, notice, retry: () => setRefresh(value => value + 1) };
}
