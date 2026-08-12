import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompletedMap, ConfettiMap, Routine, SetsMap } from '../types';

interface StorageKeys {
  exercises: string;
  sets: string;
  confetti: string;
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
  const [completedExercises, setCompletedExercises] = useState<CompletedMap>({});
  const [completedSets, setCompletedSets] = useState<SetsMap>({});
  const [confettiFired, setConfettiFired] = useState<ConfettiMap>({});
  const [toastMessage, setToastMessage] = useState('');

  const routineId = routine?.id ?? '';
  const storageKeys = getStorageKeys(routineId);

  useEffect(() => {
    if (!routine) {
      setActiveTab('semana');
      setCompletedExercises({});
      setCompletedSets({});
      setConfettiFired({});
      return;
    }

    setCompletedExercises(loadFromStorage<CompletedMap>(storageKeys.exercises, {}));
    setCompletedSets(loadFromStorage<SetsMap>(storageKeys.sets, {}));
    setConfettiFired(loadFromStorage<ConfettiMap>(storageKeys.confetti, {}));
    setActiveTab(routine.days[0]?.id ?? 'semana');
  }, [routine, storageKeys.confetti, storageKeys.exercises, storageKeys.sets]);

  useDebouncedSave(storageKeys.exercises, completedExercises, Boolean(routine));
  useDebouncedSave(storageKeys.sets, completedSets, Boolean(routine));
  useDebouncedSave(storageKeys.confetti, confettiFired, Boolean(routine));

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2500);
  }, []);

  const getRequiredSets = useCallback((exerciseName: string) => {
    const exercise = routine?.days
      .flatMap((day) => day.sections)
      .flatMap((section) => section.exercises)
      .find((item) => item.name === exerciseName);
    return exercise?.sets || 3;
  }, [routine]);

  const handleToggleSet = useCallback((exerciseName: string, setIdx: number) => {
    if (!routine) return;

    setCompletedSets((previousSets) => {
      const daySets = previousSets[activeTab] || {};
      const currentSets = daySets[exerciseName] || [];
      const updatedSets = currentSets.includes(setIdx)
        ? currentSets.filter((index) => index !== setIdx)
        : [...currentSets, setIdx];
      const newCompletedSets = {
        ...previousSets,
        [activeTab]: { ...daySets, [exerciseName]: updatedSets },
      };

      setCompletedExercises((previousExercises) => ({
        ...previousExercises,
        [activeTab]: {
          ...(previousExercises[activeTab] || {}),
          [exerciseName]: updatedSets.length === getRequiredSets(exerciseName),
        },
      }));

      return newCompletedSets;
    });
  }, [activeTab, getRequiredSets, routine]);

  const handleToggleCompleted = useCallback((exerciseName: string) => {
    if (!routine) return;
    const requiredSets = getRequiredSets(exerciseName);

    setCompletedExercises((previousExercises) => {
      const dayExercises = previousExercises[activeTab] || {};
      const isNowCompleted = !dayExercises[exerciseName];

      setCompletedSets((previousSets) => ({
        ...previousSets,
        [activeTab]: {
          ...(previousSets[activeTab] || {}),
          [exerciseName]: isNowCompleted ? Array.from({ length: requiredSets }, (_, index) => index) : [],
        },
      }));

      if (!isNowCompleted) {
        setConfettiFired((previousConfetti) => ({ ...previousConfetti, [activeTab]: false }));
      }

      return {
        ...previousExercises,
        [activeTab]: { ...dayExercises, [exerciseName]: isNowCompleted },
      };
    });
  }, [activeTab, getRequiredSets, routine]);

  const handleClearDayProgress = useCallback(() => {
    if (!routine) return;
    setCompletedExercises((previous) => ({ ...previous, [activeTab]: {} }));
    setCompletedSets((previous) => ({ ...previous, [activeTab]: {} }));
    setConfettiFired((previous) => ({ ...previous, [activeTab]: false }));
    showToast('Progreso del día restablecido');
  }, [activeTab, routine, showToast]);

  const handleClearAllProgress = useCallback(() => {
    if (!routine) return;
    setCompletedExercises({});
    setCompletedSets({});
    setConfettiFired({});
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
    completedExercises,
    completedSets,
    confettiFired,
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
