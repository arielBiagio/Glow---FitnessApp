import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Routine } from '../types';
import { claimCelebration } from '../lib/celebrations';
import { deviceTimezone, localDate, weekStart as getWeekStart } from '../lib/dates';
import { progressMaps, suggestedDayId, type ProgressOperation, type WorkoutWeek } from '../lib/workouts';
import { cacheKey, enqueue, getCachedWeek, mergeRemote, pendingOperations, prepareLocalDay, resolveQueue } from '../lib/progressStorage';
import { activateRemoteWeek, getRemoteWeek, RepositoryError, synchronize } from '../lib/workoutRepository';

type SaveStatus = 'local' | 'saved' | 'saving' | 'offline' | 'error' | 'conflict';
interface Identity { userId: string | null; timezone: string; ready: boolean }

export function useWorkoutProgress(routine: Routine | null, identity: Identity = { userId: null, timezone: deviceTimezone(), ready: true }) {
  const owner = identity.userId ?? 'local';
  const [clock, setClock] = useState(() => new Date());
  const today = localDate(clock, identity.timezone);
  const start = getWeekStart(clock, identity.timezone);
  const key = cacheKey(owner, routine?.id ?? '', start);
  const context = useRef({ owner, key });
  context.current = { owner, key };
  const [state, setState] = useState<{ key: string; week: WorkoutWeek | null }>({ key: '', week: null });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>('local');
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [conflict, setConflict] = useState<{ key: string; routineId: string; start: string; sessionId: string } | null>(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [completionEvent, setCompletionEvent] = useState<{ id: string; key: string; date: string } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutations = useRef<Promise<unknown>>(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [syncTick, setSyncTick] = useState(0);
  const week = state.key === key ? state.week : null;
  const displayRoutine = week?.routineSnapshot ?? routine;
  const maps = useMemo(() => progressMaps(week, today), [week, today]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(''), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const update = () => setClock(new Date());
    const timer = setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  useEffect(() => { setPendingCount(0); setConflict(null); setToastMessage(''); }, [owner]);
  const suggestedDay = suggestedDayId(displayRoutine, today);
  useEffect(() => { setActiveTab(previous => previous === 'resumen' ? previous : suggestedDay); }, [routine?.id, today, suggestedDay]);

  useEffect(() => {
    let alive = true;
    const current = () => alive && context.current.key === key;
    setLoading(true); setError(''); setStatus(owner === 'local' ? 'local' : 'saving');
    setState(previous => previous.key === key ? previous : { key, week: null });
    if (!routine || !identity.ready) return () => { alive = false; };
    void (async () => {
      const cached = await getCachedWeek(key);
      if (!current()) return;
      if (owner === 'local') {
        const next = await prepareLocalDay(key, routine, start, identity.timezone, today);
        if (current()) setState({ key, week: next });
        return;
      }
      setState({ key, week: cached });
      const pending = await pendingOperations(owner);
      if (!current()) return;
      setPendingCount(pending.length);
      if (!navigator.onLine) { setStatus('offline'); return; }
      // Idempotently prepare today's sessions without any activation step in the UI.
      const remote = await activateRemoteWeek(routine, start, identity.timezone, today);
      if (!current()) return;
      if (remote) {
        const merged = await mergeRemote(owner, key, remote);
        if (current()) setState({ key, week: merged });
      }
      if (current()) { setStatus('saved'); setSyncTick(value => value + 1); }
    })().catch(() => {
      if (current()) { setStatus('error'); setError('No se pudo cargar el progreso. Podés reintentar; tus cambios locales se conservan.'); }
    }).finally(() => { if (current()) setLoading(false); });
    return () => { alive = false; };
  }, [key, owner, routine, start, today, identity.timezone, identity.ready, reload]);

  useEffect(() => {
    if (owner === 'local' || !identity.ready) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const current = () => alive && context.current.owner === owner;
    const refresh = async () => {
      const currentKey = context.current.key;
      const cached = await getCachedWeek(currentKey);
      const remaining = await pendingOperations(owner);
      if (current() && context.current.key === currentKey) {
        setState({ key: currentKey, week: cached });
        setPendingCount(remaining.length);
        setStatus(remaining.length ? 'saving' : 'saved');
      }
    };
    const run = async () => {
      clearTimeout(timer);
      if (!current()) return;
      if (!navigator.onLine) { setStatus('offline'); return; }
      try {
        const pending = await pendingOperations(owner);
        if (!current()) return;
        setPendingCount(pending.length);
        if (!pending.length) return;
        setStatus('saving');
        await synchronize(owner, () => { void refresh(); }, current);
        if (current()) { await refresh(); setError(''); setConflict(null); }
      } catch (cause) {
        if (!current()) return;
        const pending = (await pendingOperations(owner))[0];
        if (!current()) return;
        if (cause instanceof RepositoryError && cause.code === '40001' && pending) {
          const cached = await getCachedWeek(pending.key);
          if (cached && current()) {
            setConflict({ key: pending.key, routineId: cached.routineSnapshot.id, start: cached.weekStart, sessionId: pending.sessionId });
            setStatus('conflict'); setError('Esta sesión cambió en otro dispositivo. Elegí qué versión conservar.');
          }
          return;
        }
        setStatus(navigator.onLine ? 'error' : 'offline');
        setError('Hay cambios pendientes. Revisá la conexión o ingresá nuevamente para guardarlos.');
        if (!(cause instanceof RepositoryError) || !['AUTH', '42501', '22023', 'PGRST202'].includes(cause.code)) {
          if (++attempts <= 5) timer = setTimeout(() => { void run(); }, Math.min(30000, 1000 * 2 ** attempts));
        }
      }
    };
    const resume = () => { attempts = 0; void run(); };
    void run();
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    return () => { alive = false; clearTimeout(timer); window.removeEventListener('online', resume); window.removeEventListener('focus', resume); };
  }, [owner, identity.ready, syncTick]);

  const mutate = (builder: (week: WorkoutWeek) => { sessionId: string; operation: ProgressOperation } | null) => {
    if (!week || loading || !identity.ready || status === 'conflict') return;
    const captured = { key, owner };
    mutations.current = mutations.current.catch(() => {}).then(async () => {
      const stored = await getCachedWeek(captured.key);
      if (!stored) return;
      const action = builder(stored);
      if (!action) return;
      const previousSession = stored.sessions.find(session => session.id === action.sessionId);
      const next = await enqueue(captured.owner, captured.key, action.sessionId, action.operation);
      if (context.current.key === captured.key) {
        setState({ key: captured.key, week: next });
        setStatus(captured.owner === 'local' ? 'local' : 'saving');
      }
      if (context.current.owner === captured.owner && captured.owner !== 'local') setSyncTick(value => value + 1);
      const updatedSession = next.sessions.find(session => session.id === action.sessionId);
      if (previousSession?.status !== 'completed' && updatedSession?.status === 'completed' && ['set', 'exercise'].includes(action.operation.kind)) {
        // Never celebrate loaded/synchronized data, only a new user completion.
        const id = await claimCelebration(captured.owner, next.routineSnapshot.id, updatedSession.dayId, updatedSession.sessionDate).catch(() => null);
        if (id && context.current.key === captured.key) setCompletionEvent({ id, key: captured.key, date: updatedSession.sessionDate });
      }
    }).catch(() => {
      if (context.current.key === captured.key) { setStatus('error'); setError('No se pudo guardar el cambio en este dispositivo. Intentá nuevamente.'); }
    });
  };

  const handleToggleSet = (exerciseId: string, setIndex: number) => {
    const tab = activeTab;
    mutate(stored => {
      const session = stored.sessions.find(item => item.dayId === tab && item.sessionDate === today);
      const exercise = session?.exercises.find(item => item.exerciseId === exerciseId);
      return session && exercise ? { sessionId: session.id, operation: { kind: 'set', exerciseId, setIndex, completed: !exercise.completedSets.includes(setIndex) } } : null;
    });
  };
  const handleToggleCompleted = (exerciseId: string) => {
    const tab = activeTab;
    mutate(stored => {
      const session = stored.sessions.find(item => item.dayId === tab && item.sessionDate === today);
      const exercise = session?.exercises.find(item => item.exerciseId === exerciseId);
      return session && exercise ? { sessionId: session.id, operation: { kind: 'exercise', exerciseId, completed: !exercise.completed } } : null;
    });
  };
  const handleClearDayProgress = () => {
    const tab = activeTab;
    mutate(stored => {
      const session = stored.sessions.find(item => item.dayId === tab && item.sessionDate === today);
      return session ? { sessionId: session.id, operation: { kind: 'reset' } } : null;
    });
  };

  const resolveConflict = async (keepLocal: boolean) => {
    if (!conflict || busy) return;
    setBusy(true);
    try {
      const remote = await getRemoteWeek(conflict.routineId, conflict.start);
      if (!remote) throw new Error('Plan no encontrado.');
      await resolveQueue(owner, conflict.key, remote, keepLocal, conflict.sessionId);
      setConflict(null); setError(''); setReload(value => value + 1); setSyncTick(value => value + 1);
    } catch { setError('No se pudo resolver el conflicto. Reintentá con conexión; los cambios siguen pendientes.'); }
    finally { setBusy(false); }
  };
  return {
    activeTab, ...maps, completionEvent: completionEvent?.key === key && completionEvent.date === today ? completionEvent : null, toastMessage, showToast,
    handleToggleSet, handleToggleCompleted, handleClearDayProgress,
    handleSelectTab: setActiveTab, displayRoutine, week, today,
    loading: loading || !identity.ready || state.key !== key, busy,
    canEdit: Boolean(week?.sessions.some(session => session.sessionDate === today) && !loading && identity.ready && status !== 'conflict' && !busy),
    saveStatus: status, error, pendingCount, conflict, resolveConflict,
    retry: () => { setReload(value => value + 1); setSyncTick(value => value + 1); },
  };
}
