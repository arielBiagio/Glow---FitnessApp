import React, { useEffect, useRef } from 'react';
import BottomNav from './components/BottomNav';
import WorkoutConsole from './components/WorkoutConsole';
import WeeklySchedule from './components/WeeklySchedule';
import RoutineSelector from './components/RoutineSelector';
import { Activity, BellRing } from 'lucide-react';
import { useWorkoutProgress } from './hooks/useWorkoutProgress';
import { useWorkoutRoutines } from './hooks/useWorkoutRoutines';
import confetti from 'canvas-confetti';
import gsap from 'gsap';

export default function App() {
  const {
    routines,
    selectedRoutine,
    selectedRoutineId,
    selectRoutine,
    loading: routineLoading,
    error: routineError,
  } = useWorkoutRoutines();

  const {
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
  } = useWorkoutProgress(selectedRoutine);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedRoutine || activeTab === 'semana') return;

    const activeDay = selectedRoutine.days.find((day) => day.id === activeTab);
    if (!activeDay) return;

    const allExercises = activeDay.sections.flatMap(s => s.exercises);
    const totalExercises = allExercises.length;

    const dayCompletedMap = completedExercises[activeTab] || {};
    const completedCount = allExercises.filter(e => dayCompletedMap[e.name]).length;
    const percent = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;

    if (percent === 100 && totalExercises > 0 && !confettiFired[activeTab]) {
      confetti({
        particleCount: 120,
        spread: 60,
        colors: ['#7B61FF', '#10B981', '#F59E0B', '#EF4444'],
        origin: { y: 0.75 }
      });

      setConfettiFired(prev => ({ ...prev, [activeTab]: true }));
      showToast('¡100% del Entrenamiento Completado!');
    }
  }, [completedExercises, activeTab, confettiFired, selectedRoutine, setConfettiFired, showToast]);

  useEffect(() => {
    gsap.fromTo('.app-shell',
      { opacity: 0 },
      { opacity: 1, duration: 0.8, ease: 'power3.out' }
    );
  }, []);

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
    if (window.confirm('¿Reiniciar el progreso del día de hoy?')) {
      handleClearDayProgress();
    }
  };

  const onClearAll = () => {
    if (window.confirm('¿Reiniciar todo el historial semanal? Esta acción no se puede deshacer.')) {
      handleClearAllProgress();
    }
  };

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
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
      const tabIds = [...(selectedRoutine?.days.map((day) => day.id) ?? []), 'semana'];
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
        <div className="bg-[#0A0A14]/85 backdrop-blur-md border-b border-white/5 px-5 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 flex items-center justify-between select-none z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-plasma/10 border border-plasma/30 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-plasma animate-pulse" />
            </div>
            <span className="font-sans font-bold text-sm tracking-wider text-white">
              GLOW <span className="font-drama italic text-plasma font-normal text-base ml-0.5">Cele</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-900 rounded-full px-2.5 py-1 text-[8px] tracking-widest text-zinc-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            APP ACTIVE
          </div>
        </div>

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

        <div
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+110px)] hide-scrollbar relative z-10"
        >
          <RoutineSelector
            routines={routines}
            selectedRoutine={selectedRoutine}
            selectedRoutineId={selectedRoutineId}
            onSelectRoutine={selectRoutine}
            loading={routineLoading}
            error={routineError}
          />

          <div key={selectedRoutine?.id ?? 'routine-loading'} className="routine-content-transition">
            {!selectedRoutine ? (
              <div className="glass-card rounded-[2rem] p-6 text-center text-sm text-zinc-400">
                {routineLoading ? 'Cargando rutinas…' : routineError || 'No hay una rutina disponible.'}
              </div>
            ) : activeTab === 'semana' ? (
              <WeeklySchedule
                weeklySchedule={selectedRoutine.weeklySchedule}
                scienceFactors={selectedRoutine.scienceFactors}
                onSelectDay={onSelectTab}
                onClearProgress={onClearAll}
              />
            ) : (
              <WorkoutConsole
                activeDayId={activeTab}
                days={selectedRoutine.days}
                completedExercises={completedExercises}
                completedSets={completedSets}
                onToggleSet={handleToggleSet}
                onToggleCompleted={handleToggleCompleted}
                onClearDay={onClearDay}
              />
            )}
          </div>
        </div>

        <BottomNav
          days={selectedRoutine?.days ?? []}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />

      </div>
    </div>
  );
}
