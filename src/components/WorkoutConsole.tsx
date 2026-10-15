import { useMemo } from 'react';
import ExerciseCard from './ExerciseCard';
import CollapsibleInfo from './CollapsibleInfo';
import { Clock, RotateCcw } from 'lucide-react';
import type { CompletedMap, SetsMap, WorkoutDay } from '../types';

interface WorkoutConsoleProps {
  activeDayId: string;
  days: WorkoutDay[];
  completedExercises: CompletedMap;
  completedSets: SetsMap;
  onToggleSet: (exName: string, setIdx: number) => void;
  onToggleCompleted: (exName: string) => void;
  onClearDay: () => void;
}

export default function WorkoutConsole({
  activeDayId,
  days,
  completedExercises,
  completedSets,
  onToggleSet,
  onToggleCompleted,
  onClearDay,
}: WorkoutConsoleProps) {
  const activeDay = days.find((day) => day.id === activeDayId) || days[0];
  const allExercises = useMemo(
    () => activeDay?.sections.flatMap((section) => section.exercises) ?? [],
    [activeDay],
  );
  const totalExercises = allExercises.length;

  const dayCompletedMap = completedExercises[activeDayId] || {};
  const completedCount = allExercises.filter(e => dayCompletedMap[e.id]).length;
  const percent = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  if (!activeDay) return null;

  return (
    <div id="console-board" className="flex flex-col space-y-6">

      <div className="glass-card rounded-[2rem] p-5 border-glow flex items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-24 h-24 rounded-full bg-plasma/10 blur-2xl pointer-events-none"></div>

        <div>
          <span className="text-[10px] font-mono tracking-widest text-plasma-ink uppercase font-bold">
            Entrenamiento del día
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
            {activeDay.name} — {activeDay.subtitle}
          </h2>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-plasma" />
              {activeDay.summary.total} min
            </span>
            <span>
              {completedCount} de {totalExercises} ejercicios
            </span>
          </div>
        </div>

        <div className="relative flex items-center justify-center flex-shrink-0 select-none" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${percent}% completado`}>
          <svg className="w-20 h-20 transform -rotate-90" aria-hidden="true">
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-[#131322] fill-none"
              strokeWidth="5"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-emerald-500 fill-none"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[13px] font-bold text-emerald-400 text-glow-green">
              {percent}%
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6 pb-20">
        {activeDay.sections.map((section) => (
          <div key={`${activeDay.id}-${section.id}`} className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-1">
              <h3 className="font-sans font-semibold text-xs text-zinc-400 uppercase tracking-wider">
                {section.title}
              </h3>
              <span className={`text-[8px] font-mono tracking-widest px-2 py-0.5 rounded-full ${
                ['Warmup', 'Main', 'Cooldown'].includes(section.badge)
                  ? 'bg-plasma/10 text-plasma-ink border border-plasma/20'
                  : section.badgeStyle || 'bg-zinc-900 text-zinc-400'
              }`}>
                {section.badge}
              </span>
            </div>

            {section.note && (
              <CollapsibleInfo context={section.title}>
                <p className="leading-relaxed font-sans">{section.note}</p>
              </CollapsibleInfo>
            )}

            <div className="space-y-3">
              {section.exercises.map((exercise) => {
                const exCompleted = dayCompletedMap[exercise.id] || false;
                const exSets = completedSets[activeDayId]?.[exercise.id] || [];

                return (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    isCompleted={exCompleted}
                    completedSets={exSets}
                    onToggleSet={onToggleSet}
                    onToggleCompleted={onToggleCompleted}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {completedCount > 0 && (
          <div className="pt-2 pb-6">
            <button
              onClick={onClearDay}
              className="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-xs font-mono rounded-2xl text-rose-400 flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98]"
              aria-label="Reiniciar progreso de esta sesión"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar esta sesión
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
