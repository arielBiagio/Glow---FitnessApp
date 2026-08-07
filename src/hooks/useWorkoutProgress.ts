import { useState, useEffect, useRef, useCallback } from 'react';
import type { CompletedMap, SetsMap, ConfettiMap } from '../types';
import { workoutData } from '../data/workoutData';

const STORAGE_KEYS = {
  exercises: 'glow-split-completed-exercises',
  sets: 'glow-split-completed-sets',
  confetti: 'glow-split-confetti-fired',
} as const;

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
    // localStorage might be full or unavailable — silently fail
  }
}

function useDebouncedSave(key: string, value: unknown, delay = 300): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveToStorage(key, value);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, value, delay]);
}

export function useWorkoutProgress() {
  const [activeTab, setActiveTab] = useState('dia-a');

  const [completedExercises, setCompletedExercises] = useState<CompletedMap>(() =>
    loadFromStorage<CompletedMap>(STORAGE_KEYS.exercises, {})
  );

  const [completedSets, setCompletedSets] = useState<SetsMap>(() =>
    loadFromStorage<SetsMap>(STORAGE_KEYS.sets, {})
  );

  const [confettiFired, setConfettiFired] = useState<ConfettiMap>(() =>
    loadFromStorage<ConfettiMap>(STORAGE_KEYS.confetti, {})
  );

  const [toastMessage, setToastMessage] = useState('');

  useDebouncedSave(STORAGE_KEYS.exercises, completedExercises);
  useDebouncedSave(STORAGE_KEYS.sets, completedSets);
  useDebouncedSave(STORAGE_KEYS.confetti, confettiFired);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  }, []);

  const handleToggleSet = useCallback((exName: string, setIdx: number) => {
    setCompletedSets(prevSets => {
      const daySets: Record<string, number[]> = prevSets[activeTab] || {};
      const currentSets: number[] = daySets[exName] || [];

      const updatedSets = currentSets.includes(setIdx)
        ? currentSets.filter(i => i !== setIdx)
        : [...currentSets, setIdx];

      const newDaySets = { ...daySets, [exName]: updatedSets };
      const newCompletedSets = { ...prevSets, [activeTab]: newDaySets };

      const dayData = workoutData.find(d => d.id === activeTab);
      const exConfig = dayData?.sections.flatMap(s => s.exercises).find(e => e.name === exName);
      const requiredSets = exConfig?.sets || 3;

      setCompletedExercises(prevEx => {
        const dayEx = prevEx[activeTab] || {};
        const isNowCompleted = updatedSets.length === requiredSets;
        const newDayEx = { ...dayEx, [exName]: isNowCompleted };
        return { ...prevEx, [activeTab]: newDayEx };
      });

      return newCompletedSets;
    });
  }, [activeTab]);

  const handleToggleCompleted = useCallback((exName: string) => {
    const dayData = workoutData.find(d => d.id === activeTab);
    const exConfig = dayData?.sections.flatMap(s => s.exercises).find(e => e.name === exName);
    const requiredSets = exConfig?.sets || 3;

    setCompletedExercises(prevEx => {
      const dayEx = prevEx[activeTab] || {};
      const wasCompleted = dayEx[exName] || false;
      const isNowCompleted = !wasCompleted;

      const newDayEx = { ...dayEx, [exName]: isNowCompleted };

      setCompletedSets(prevSets => {
        const daySets = prevSets[activeTab] || {};
        const updatedSets = isNowCompleted
          ? Array.from({ length: requiredSets }).map((_, i) => i)
          : [];
        const newDaySets = { ...daySets, [exName]: updatedSets };
        return { ...prevSets, [activeTab]: newDaySets };
      });

      if (!isNowCompleted) {
        setConfettiFired(prev => ({ ...prev, [activeTab]: false }));
      }

      return { ...prevEx, [activeTab]: newDayEx };
    });
  }, [activeTab]);

  const handleClearDayProgress = useCallback(() => {
    setCompletedExercises(prevEx => ({ ...prevEx, [activeTab]: {} }));
    setCompletedSets(prevSets => ({ ...prevSets, [activeTab]: {} }));
    setConfettiFired(prev => ({ ...prev, [activeTab]: false }));
    showToast('Progreso del día restablecido');
  }, [activeTab, showToast]);

  const handleClearAllProgress = useCallback(() => {
    setCompletedExercises({});
    setCompletedSets({});
    setConfettiFired({});
    saveToStorage(STORAGE_KEYS.exercises, {});
    saveToStorage(STORAGE_KEYS.sets, {});
    saveToStorage(STORAGE_KEYS.confetti, {});
    showToast('Historial completo restablecido');
  }, [showToast]);

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  return {
    activeTab,
    setActiveTab,
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
