import { useCallback, useEffect, useRef, useState } from 'react';
import type { Routine, RoutineManifestEntry } from '../types';

interface RoutineManifestResponse {
  routines?: RoutineManifestEntry[];
}

interface UseWorkoutRoutinesReturn {
  routines: RoutineManifestEntry[];
  selectedRoutine: Routine | null;
  selectedRoutineId: string;
  selectRoutine: (id: string) => void;
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo cargar la rutina';
}

async function fetchJson<T>(file: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(file, { signal });
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${file}`);
  }
  return response.json() as Promise<T>;
}

export function useWorkoutRoutines(): UseWorkoutRoutinesReturn {
  const [routines, setRoutines] = useState<RoutineManifestEntry[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [selectedRoutineId, setSelectedRoutineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const loadRoutine = useCallback(async (entry: RoutineManifestEntry, signal: AbortSignal) => {
    const routine = await fetchJson<Routine>(entry.file, signal);
    if (signal.aborted) return;

    setSelectedRoutine(routine);
    setSelectedRoutineId(routine.id);
    localStorage.setItem('glow-selected-routine', routine.id);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    requestControllerRef.current = controller;

    const loadManifestAndRoutine = async () => {
      try {
        const manifest = await fetchJson<RoutineManifestResponse>('/routines/index.json', controller.signal);
        const manifestRoutines = manifest.routines ?? [];
        if (manifestRoutines.length === 0) {
          throw new Error('No hay rutinas disponibles');
        }

        setRoutines(manifestRoutines);
        const persistedId = localStorage.getItem('glow-selected-routine');
        const entry = manifestRoutines.find((routine) => routine.id === persistedId) ?? manifestRoutines[0];
        await loadRoutine(entry, controller.signal);
        if (!controller.signal.aborted) setError(null);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(getErrorMessage(loadError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadManifestAndRoutine();

    return () => {
      controller.abort();
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    };
  }, [loadRoutine]);

  const selectRoutine = useCallback(async (id: string) => {
    const entry = routines.find((routine) => routine.id === id);
    if (!entry || id === selectedRoutineId) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const previousRoutineId = selectedRoutineId;
    setSelectedRoutineId(id);
    setLoading(true);
    setError(null);

    try {
      await loadRoutine(entry, controller.signal);
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setSelectedRoutineId(previousRoutineId);
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [loadRoutine, routines, selectedRoutineId]);

  return { routines, selectedRoutine, selectedRoutineId, selectRoutine, loading, error };
}
