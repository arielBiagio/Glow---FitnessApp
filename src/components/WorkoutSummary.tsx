import { Activity, CalendarDays, CheckCheck, Clock3, Dumbbell, Layers } from 'lucide-react';
import type { Routine } from '../types';
import type { useWorkoutProgress } from '../hooks/useWorkoutProgress';
import { useWorkoutSummary } from '../hooks/useWorkoutSummary';
import AnimatedNumber from './AnimatedNumber';
import CollapsibleInfo from './CollapsibleInfo';

interface Props {
  userId: string | null;
  ready: boolean;
  progress: ReturnType<typeof useWorkoutProgress>;
  routine: Routine | null;
  onSelectDay: (dayId: string) => void;
}

export default function WorkoutSummary({ userId, ready, progress, routine, onSelectDay }: Props) {
  const { stats, loading, notice, retry } = useWorkoutSummary(userId, progress, true, ready);
  const metrics = [
    { label: 'Días entrenando', value: stats.days, icon: Activity },
    { label: 'Semanas activas', value: stats.weeks, icon: CalendarDays },
    { label: 'Sesiones completas', value: stats.sessions, icon: CheckCheck },
    { label: 'Minutos estimados', value: stats.minutes, icon: Clock3 },
    { label: 'Ejercicios completos', value: stats.exercises, icon: Dumbbell },
    { label: 'Series completas', value: stats.sets, icon: Layers },
  ];
  return (
    <div className="space-y-5">
      <section aria-label="Estadísticas de entrenamiento" aria-busy={loading}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-white">Tu actividad</h2>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted">{loading ? 'Actualizando…' : 'Desde el inicio'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map(({ label, value, icon: Icon }, index) => <div key={label} className="glass-card rounded-2xl p-4">
            <Icon className="w-4 h-4 text-plasma-ink mb-3" aria-hidden="true" />
            <p className="text-2xl font-semibold text-white tabular-nums"><AnimatedNumber value={value} loading={loading} index={index} /></p>
            <h3 className="text-[10px] text-zinc-400 mt-1">{label}</h3>
          </div>)}
        </div>
        <p className="text-[10px] text-muted leading-relaxed mt-3">Los minutos corresponden a la duración prevista de las sesiones completas, no a tiempo cronometrado.</p>
        {notice && <p role="status" className="text-xs text-amber-300/80 mt-3">{notice} <button type="button" onClick={retry} className="underline">Actualizar</button></p>}
      </section>
      {routine && <>
        <section key={`about-${routine.id}`} className="routine-content-transition" aria-label="Sobre tu rutina">
          <CollapsibleInfo context="Sobre tu rutina" className="glass-card">
            <h2 className="text-sm font-semibold text-white mb-2">Sobre tu rutina</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">{routine.description}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-zinc-300">
              {[routine.goal, routine.level, routine.frequency].map(value => <span key={value} className="rounded-lg bg-white/[0.04] border border-white/5 px-2 py-1">{value}</span>)}
            </div>
          </CollapsibleInfo>
        </section>
        <section key={`week-${routine.id}`} className="glass-card rounded-2xl p-4 routine-content-transition" aria-label="Avance de esta semana">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-white">Esta semana</h2>
            <span className="text-[9px] font-mono text-muted">Rutina actual</span>
          </div>
          <div className="space-y-2">
            {routine.days.map(day => {
              const sessions = progress.week?.sessions.filter(session => session.dayId === day.id) ?? [];
              const completed = sessions.filter(session => session.status === 'completed').length;
              const started = sessions.some(session => session.status === 'in_progress');
              const status = completed ? `${completed} ${completed === 1 ? 'sesión completa' : 'sesiones completas'}` : started ? 'En curso' : 'Pendiente';
              return <button type="button" key={day.id} onClick={() => onSelectDay(day.id)} className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/[0.025] border border-white/5 px-3 py-3 text-left hover:border-plasma/30 transition-colors">
                <span className="min-w-0"><span className="block text-xs text-white font-medium">{day.name}</span><span className="block text-[10px] text-muted mt-1">{day.subtitle}</span></span>
                <span className={`text-[9px] shrink-0 ${completed ? 'text-emerald-400' : started ? 'text-plasma-ink' : 'text-muted'}`}>{progress.loading ? '—' : status}</span>
              </button>;
            })}
          </div>
        </section>
      </>}
    </div>
  );
}
