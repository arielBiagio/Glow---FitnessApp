import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { CompletedMap, ConfettiMap, Routine, SetsMap } from '../types';

interface StorageKeys {
  exercises: string;
  sets: string;
  confetti: string;
}

interface ProgressState {
  completedExercises: CompletedMap;
  completedSets: SetsMap;
  confettiFired: ConfettiMap;
}

function getStorageKeys(routineId: string): StorageKeys {
  return {
    exercises: `glow-split:${routineId}:completed-exercises`,
    sets: `glow-split:${routineId}:completed-sets`,
    confetti: `glow-split:${routineId}:confetti-fired`,
  };
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage might be full or unavailable.
  }
}

function useDebouncedSave(key: string, value: unknown, enabled: boolean, delay = 300): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => saveToStorage(key, value), delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, value, enabled, delay]);
}

export function useWorkoutProgress(routine: Routine | null) {
  const [activeTab, setActiveTab] = useState('semana');
  const [progress, setProgress] = useState<ProgressState>({
    completedExercises: {},
    completedSets: {},
    confettiFired: {},
  });
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRoutineIdRef = useRef<string | null>(null);

  const routineId = routine?.id ?? '';
  const storageKeys = useMemo(() => getStorageKeys(routineId), [routineId]);

  const exerciseIndex = useMemo(() => {
    const index = new Map<string, { loggable?: boolean; sets?: number }>();
    routine?.days.forEach((day) => {
      day.sections.forEach((section) => {
        section.exercises.forEach((exercise) => {
          index.set(`${day.id}:${exercise.name}`, exercise);
        });
      });
    });
    return index;
  }, [routine]);

  useEffect(() => {
    loadedRoutineIdRef.current = null;

    if (!routine) {
      setActiveTab('semana');
      setProgress({ completedExercises: {}, completedSets: {}, confettiFired: {} });
      return;
    }

    setProgress({
      completedExercises: loadFromStorage<CompletedMap>(storageKeys.exercises, {}),
      completedSets: loadFromStorage<SetsMap>(storageKeys.sets, {}),
      confettiFired: loadFromStorage<ConfettiMap>(storageKeys.confetti, {}),
    });
    setActiveTab(routine.days[0]?.id ?? 'semana');
    loadedRoutineIdRef.current = routine.id;
  }, [routine, storageKeys.confetti, storageKeys.exercises, storageKeys.sets]);

  const storageReady = Boolean(routine && loadedRoutineIdRef.current === routine.id);
  useDebouncedSave(storageKeys.exercises, progress.completedExercises, storageReady);
  useDebouncedSave(storageKeys.sets, progress.completedSets, storageReady);
  useDebouncedSave(storageKeys.confetti, progress.confettiFired, storageReady);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimeoutRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  const setConfettiFired = useCallback((value: SetStateAction<ConfettiMap>) => {
    setProgress((previous) => ({
      ...previous,
      confettiFired: typeof value === 'function' ? value(previous.confettiFired) : value,
    }));
  }, []);

  const handleToggleSet = useCallback((exerciseName: string, setIdx: number) => {
    if (!routine) return;

    const exercise = exerciseIndex.get(`${activeTab}:${exerciseName}`);
    if (!exercise?.loggable) return;

    setProgress((previous) => {
      const daySets = previous.completedSets[activeTab] || {};
      const currentSets = daySets[exerciseName] || [];
      const updatedSets = currentSets.includes(setIdx)
        ? currentSets.filter((index) => index !== setIdx)
        : [...currentSets, setIdx];
      const requiredSets = exercise.sets || 3;

      return {
        ...previous,
        completedSets: {
          ...previous.completedSets,
          [activeTab]: { ...daySets, [exerciseName]: updatedSets },
        },
        completedExercises: {
          ...previous.completedExercises,
          [activeTab]: {
            ...(previous.completedExercises[activeTab] || {}),
            [exerciseName]: updatedSets.length === requiredSets,
          },
        },
      };
    });
  }, [activeTab, exerciseIndex, routine]);

  const handleToggleCompleted = useCallback((exerciseName: string) => {
    if (!routine) return;

    const exercise = exerciseIndex.get(`${activeTab}:${exerciseName}`);
    const requiredSets = exercise?.sets || 3;

    setProgress((previous) => {
      const dayExercises = previous.completedExercises[activeTab] || {};
      const isNowCompleted = !dayExercises[exerciseName];
      const updatedSets = isNowCompleted && exercise?.loggable
        ? Array.from({ length: requiredSets }, (_, index) => index)
        : [];

      return {
        ...previous,
        completedExercises: {
          ...previous.completedExercises,
          [activeTab]: { ...dayExercises, [exerciseName]: isNowCompleted },
        },
        completedSets: {
          ...previous.completedSets,
          [activeTab]: {
            ...(previous.completedSets[activeTab] || {}),
            [exerciseName]: updatedSets,
          },
        },
        confettiFired: isNowCompleted
          ? previous.confettiFired
          : { ...previous.confettiFired, [activeTab]: false },
      };
    });
  }, [activeTab, exerciseIndex, routine]);

  const handleClearDayProgress = useCallback(() => {
    if (!routine) return;
    setProgress((previous) => ({
      ...previous,
      completedExercises: { ...previous.completedExercises, [activeTab]: {} },
      completedSets: { ...previous.completedSets, [activeTab]: {} },
      confettiFired: { ...previous.confettiFired, [activeTab]: false },
    }));
    showToast('Progreso del día restablecido');
  }, [activeTab, routine, showToast]);

  const handleClearAllProgress = useCallback(() => {
    if (!routine) return;
    setProgress({ completedExercises: {}, completedSets: {}, confettiFired: {} });
    saveToStorage(storageKeys.exercises, {});
    saveToStorage(storageKeys.sets, {});
    saveToStorage(storageKeys.confetti, {});
    showToast('Historial de esta rutina restablecido');
  }, [routine, showToast, storageKeys.confetti, storageKeys.exercises, storageKeys.sets]);

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  return {
    activeTab,
    completedExercises: progress.completedExercises,
    completedSets: progress.completedSets,
    confettiFired: progress.confettiFired,
    setConfettiFired,
    toastMessage,
    showToast,
    handleToggleSet,
    handleToggleCompleted,
    handleClearDayProgress,
    handleClearAllProgress,
    handleSelectTab,
  };
}
