import React, { useEffect, useRef, useState } from 'react';
import BottomNav from './BottomNav';
import WorkoutConsole from './WorkoutConsole';
import WorkoutSummary from './WorkoutSummary';
import CloudStatus from './CloudStatus';
import RoutineSelector from './RoutineSelector';
import AccountPanel from './AccountPanel';
import ProgressPanel from './ProgressPanel';
import ResetProgressDialog from './ResetProgressDialog';
import { Activity, BellRing } from 'lucide-react';
import { useWorkoutProgress } from '../hooks/useWorkoutProgress';
import { useWorkoutRoutines } from '../hooks/useWorkoutRoutines';
import type { useAuth } from '../hooks/useAuth';

export default function WorkoutApp({ auth, onLogin }: { auth: ReturnType<typeof useAuth>; onLogin: () => void }) {
  const {
    routines,
    selectedRoutine,
    selectedRoutineId,
    selectRoutine,
    loading: routineLoading,
    error: routineError,
  } = useWorkoutRoutines();

  const progress = useWorkoutProgress(selectedRoutine, {
    userId: auth.user?.id ?? null, timezone: auth.timezone, ready: !auth.loading && auth.profileReady && !routineLoading,
  });
  const trainingRoutine = progress.displayRoutine;

  const {
    activeTab,
    completedExercises,
    completedSets,
    completionEvent,
    toastMessage,
    showToast,
    handleToggleSet,
    handleToggleCompleted,
    handleClearDayProgress,
    handleSelectTab,
  } = progress;

  const preferenceApplied = useRef<string | null>(null);
  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId || !auth.preferredRoutineId || !routines.length || preferenceApplied.current === userId) return;
    preferenceApplied.current = userId;
    selectRoutine(auth.preferredRoutineId);
  }, [userId, auth.preferredRoutineId, routines, selectRoutine]);

  const scrollContainerRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const celebrated = useRef<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ routineId: string; dayId: string; date: string } | null>(null);
  const resetOpen = Boolean(resetTarget && resetTarget.routineId === trainingRoutine?.id && resetTarget.dayId === activeTab && resetTarget.date === progress.today);

  useEffect(() => {
    if (!completionEvent || celebrated.current === completionEvent.id) return;
    // Claim before firing, including React's repeated development effects.
    celebrated.current = completionEvent.id;
    void import('canvas-confetti').then(({ default: confetti }) => confetti({
      particleCount: 120,
      spread: 60,
      colors: ['#7B61FF', '#10B981', '#F59E0B', '#EF4444'],
      origin: { y: 0.75 },
      disableForReducedMotion: true,
    })).catch(() => { /* A visual effect must never interrupt saved progress. */ });
    showToast('¡100% del Entrenamiento Completado!');
  }, [completionEvent, showToast]);

  useEffect(() => { scrollContainerRef.current?.scrollTo({ top: 0 }); }, [activeTab, selectedRoutineId]);

  const onSelectTab = (tabId: string) => {
    if (tabId === activeTab) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      handleSelectTab(tabId);
    }
  };

  const onClearDay = () => {
    if (trainingRoutine && progress.canEdit) setResetTarget({ routineId: trainingRoutine.id, dayId: activeTab, date: progress.today });
  };

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [role="listbox"]')) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;

    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      const tabIds = ['resumen', ...(trainingRoutine?.days.map((day) => day.id) ?? [])];
      const currentIndex = tabIds.indexOf(activeTab);
      if (currentIndex < 0) return;
      if (deltaX > 0 && currentIndex < tabIds.length - 1) {
        handleSelectTab(tabIds[currentIndex + 1]);
      } else if (deltaX < 0 && currentIndex > 0) {
        handleSelectTab(tabIds[currentIndex - 1]);
      }
    }
  };

  return (
    <div className="app-viewport w-full h-full bg-[#07070E] md:bg-[#030307] flex items-center justify-center select-none">

      <div className="app-shell app-shell-height w-full max-w-md bg-[#07070E] flex flex-col relative md:border-x md:border-white/5 md:shadow-2xl overflow-hidden">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-plasma/20 blur-[85px] pointer-events-none"></div>
        <div className="absolute bottom-20 right-[-10%] w-64 h-64 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none"></div>
        <div className="absolute top-[35%] left-[-20%] w-56 h-56 rounded-full bg-[#7B61FF]/15 blur-[75px] pointer-events-none"></div>

        {/* Top Navbar with iOS Safe Area Inset Support */}
        <header className="relative shrink-0 bg-[#0A0A14]/85 backdrop-blur-md border-b border-white/5 px-5 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 flex items-center justify-between select-none z-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-plasma/10 border border-plasma/30 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-plasma-ink animate-pulse" />
            </div>
            <span className="font-sans font-bold text-sm tracking-wider text-white">
              GLOW
            </span>
          </div>

          <CloudStatus progress={progress} accountError={auth.error} />
        </header>

        {toastMessage && (
          <div
            className="absolute top-[calc(env(safe-area-inset-top,0px)+60px)] left-4 right-4 z-50 bg-[#101020] border border-emerald-500/30 text-emerald-400 font-mono text-[9px] uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/5 flex items-center justify-center gap-2 animate-bounce"
            role="alert"
            aria-live="assertive"
          >
            <BellRing className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            {toastMessage}
          </div>
        )}

        <main
          ref={scrollContainerRef}
          id="main-content"
          role="main"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+110px)] hide-scrollbar relative z-10"
        >
          {auth.error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-3 mb-4 text-xs text-rose-300">
            <p>{auth.error}</p>
            <button onClick={auth.retryProfile} className="mt-2 underline">Reintentar cargar la cuenta</button>
          </div>}

          {selectedRoutine && <ProgressPanel progress={progress} />}

          <div key={activeTab} className="routine-content-transition">
            {activeTab === 'resumen' ? (
              <>
                <div className="mb-5">
                  <p className={`font-mono text-[9px] uppercase ${auth.displayName ? 'tracking-normal' : 'tracking-[0.18em]'} text-plasma-ink mb-1 break-words`}>{auth.displayName ? `¡Hola, ${auth.displayName}!` : 'Tu entrenamiento'}</p>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Resumen</h1>
                </div>
                <RoutineSelector
                  routines={routines}
                  selectedRoutine={selectedRoutine}
                  selectedRoutineId={selectedRoutineId}
                  onSelectRoutine={selectRoutine}
                  loading={routineLoading}
                  error={routineError}
                />
                <WorkoutSummary userId={auth.user?.id ?? null} ready={auth.profileReady && !auth.loading} progress={progress} routine={trainingRoutine} onSelectDay={onSelectTab} />
                <div className="mt-5"><AccountPanel user={auth.user} error="" pending={progress.pendingCount} onLogin={onLogin} /></div>
              </>
            ) : !trainingRoutine ? (
              <div className="glass-card rounded-[2rem] p-6 text-center text-sm text-zinc-400">
                {routineLoading ? 'Cargando rutinas…' : routineError || 'No hay una rutina disponible.'}
              </div>
            ) : (
              <fieldset disabled={!progress.canEdit} className="min-w-0" aria-label="Ejercicios de hoy">
              <WorkoutConsole
                activeDayId={activeTab}
                days={trainingRoutine.days}
                completedExercises={completedExercises}
                completedSets={completedSets}
                onToggleSet={handleToggleSet}
                onToggleCompleted={handleToggleCompleted}
                onClearDay={onClearDay}
              />
              </fieldset>
            )}
          </div>
        </main>

        <BottomNav
          days={trainingRoutine?.days ?? []}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />

        <ResetProgressDialog
          open={resetOpen}
          dayName={trainingRoutine?.days.find(day => day.id === resetTarget?.dayId)?.name ?? 'Entrenamiento'}
          disabled={!progress.canEdit}
          onClose={() => setResetTarget(null)}
          onConfirm={() => {
            if (!resetOpen || !progress.canEdit) return;
            handleClearDayProgress();
            setResetTarget(null);
          }}
        />

      </div>
    </div>
  );
}
