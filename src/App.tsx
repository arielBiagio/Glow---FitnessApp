import React, { useEffect, useRef } from 'react';
import BottomNav from './components/BottomNav';
import WorkoutConsole from './components/WorkoutConsole';
import WeeklySchedule from './components/WeeklySchedule';
import { Activity, BellRing } from 'lucide-react';
import { workoutData } from './data/workoutData';
import { useWorkoutProgress } from './hooks/useWorkoutProgress';
import confetti from 'canvas-confetti';
import gsap from 'gsap';

const TABS = ['dia-a', 'dia-b', 'dia-c', 'dia-d', 'semana'];

export default function App() {
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
  } = useWorkoutProgress();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (activeTab === 'semana') return;

    const activeDay = workoutData.find(d => d.id === activeTab);
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
  }, [completedExercises, activeTab, confettiFired, setConfettiFired, showToast]);

  useEffect(() => {
    gsap.fromTo('.app-shell',
      { opacity: 0, scale: 0.98 },
      { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }
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

    // Minimum swipe threshold & lock to horizontal intent
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      const currentIndex = TABS.indexOf(activeTab);
      if (deltaX > 0 && currentIndex < TABS.length - 1) {
        // Swiped Left -> Next Tab
        handleSelectTab(TABS[currentIndex + 1]);
      } else if (deltaX < 0 && currentIndex > 0) {
        // Swiped Right -> Previous Tab
        handleSelectTab(TABS[currentIndex - 1]);
      }
    }
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#030307] flex items-center justify-center select-none">

      <div className="app-shell w-full max-w-md h-screen bg-[#07070E] flex flex-col relative md:border-x md:border-white/5 md:shadow-2xl overflow-hidden">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-plasma/20 blur-[85px] pointer-events-none"></div>
        <div className="absolute bottom-20 right-[-10%] w-64 h-64 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none"></div>
        <div className="absolute top-[35%] left-[-20%] w-56 h-56 rounded-full bg-[#7B61FF]/15 blur-[75px] pointer-events-none"></div>

        <div className="bg-[#0A0A14]/85 backdrop-blur-md border-b border-white/5 px-5 py-4 flex items-center justify-between select-none z-10">
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
            className="absolute top-16 left-4 right-4 z-50 bg-[#101020] border border-emerald-500/30 text-emerald-400 font-mono text-[9px] uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/5 flex items-center justify-center gap-2 animate-bounce"
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
          className="flex-1 overflow-y-auto px-4 pt-4 pb-24 hide-scrollbar relative z-10"
        >
          {activeTab === 'semana' ? (
            <WeeklySchedule
              onSelectDay={onSelectTab}
              onClearProgress={onClearAll}
            />
          ) : (
            <WorkoutConsole
              activeDayId={activeTab}
              completedExercises={completedExercises}
              completedSets={completedSets}
              onToggleSet={handleToggleSet}
              onToggleCompleted={handleToggleCompleted}
              onClearDay={onClearDay}
            />
          )}
        </div>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />

      </div>
    </div>
  );
}
