import { Calendar, CheckCircle2, Zap } from 'lucide-react';
import type { ScienceFactor, WeeklyScheduleItem } from '../types';
import type { WorkoutSession } from '../lib/workouts';
import CollapsibleInfo from './CollapsibleInfo';

interface WeeklyScheduleProps {
  weeklySchedule: WeeklyScheduleItem[];
  scienceFactors: ScienceFactor[];
  onSelectDay: (dayId: string) => void;
  sessions: WorkoutSession[];
}

export default function WeeklySchedule({ weeklySchedule, scienceFactors, onSelectDay, sessions }: WeeklyScheduleProps) {
  return (
    <div className="flex flex-col space-y-6 pb-24">

      <div className="glass-card rounded-[2rem] p-5 border-glow relative overflow-hidden">
        <div className="absolute -left-12 -bottom-12 w-24 h-24 rounded-full bg-plasma/10 blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-plasma" />
            <h3 className="font-sans font-semibold text-sm text-white tracking-wide">
              Distribución Semanal
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {weeklySchedule.map((sched) => {
            const isDescanso = sched.session === "Descanso";
            const daySessions = sessions.filter(item => item.dayId === sched.dayId);
            const status = daySessions.some(item => item.status === 'completed') ? 'Completado' : daySessions.some(item => item.status === 'in_progress') ? 'En curso' : `Día ${sched.session}`;

            return (
              <div
                key={`${sched.day}-${sched.session}`}
                onClick={() => {
                  if (!isDescanso) {
                    const mappedId = sched.dayId ?? `dia-${sched.session.toLowerCase()}`;
                    onSelectDay(mappedId);
                  }
                }}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${
                  isDescanso
                    ? 'bg-zinc-950/40 border-zinc-900/60 text-zinc-500'
                    : 'bg-zinc-900/10 border-zinc-800/80 text-zinc-300 hover:border-plasma/40 cursor-pointer active:scale-[0.99]'
                }`}
                role={isDescanso ? undefined : 'button'}
                tabIndex={isDescanso ? undefined : 0}
                aria-label={isDescanso ? `${sched.day} — ${sched.name}` : `${sched.day} — ${sched.name}. Ir al día.`}
                onKeyDown={(e) => {
                  if (!isDescanso && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    const mappedId = sched.dayId ?? `dia-${sched.session.toLowerCase()}`;
                    onSelectDay(mappedId);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: sched.color }}
                  ></div>
                  <span className="font-mono text-[10px] text-zinc-500 w-12">{sched.day}</span>
                  <span className={`font-sans text-xs font-medium ${isDescanso ? 'text-zinc-500' : 'text-white'}`}>
                    {sched.name}
                  </span>
                </div>

                {!isDescanso ? (
                  <span className="font-mono text-[8px] tracking-widest bg-plasma/15 text-plasma border border-plasma/20 px-2 py-0.5 rounded uppercase font-semibold">
                    {status}
                  </span>
                ) : (
                  <span className="font-mono text-[8px] tracking-widest bg-zinc-900/60 text-zinc-600 px-2 py-0.5 rounded uppercase font-semibold">
                    OFF
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CollapsibleInfo context="Principios del Protocolo" icon={Zap} className="glass-card border-glow">
        <div className="mb-4">
          <h3 className="font-sans font-semibold text-sm text-white tracking-wide">
            Principios del Protocolo
          </h3>
        </div>

        <div className="space-y-4">
          {scienceFactors.map((factor) => (
            <div key={factor.element} className="flex gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#7B61FF] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-sans font-semibold text-xs text-zinc-200">
                  {factor.element}
                </h4>
                <p className="font-sans text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                  {factor.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleInfo>

      <p className="text-xs text-zinc-400 text-center">El avance se guarda automáticamente al entrenar.</p>

    </div>
  );
}
