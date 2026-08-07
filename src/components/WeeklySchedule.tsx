import React from 'react';
import { weeklySchedule, scienceFactors } from '../data/workoutData';
import { Calendar, CheckCircle2, Zap, RefreshCw } from 'lucide-react';

interface WeeklyScheduleProps {
  onSelectDay: (dayId: string) => void;
  onClearProgress: () => void;
}

export default function WeeklySchedule({ onSelectDay, onClearProgress }: WeeklyScheduleProps) {
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
          {weeklySchedule.map((sched, idx) => {
            const isDescanso = sched.session === "Descanso";

            return (
              <div
                key={idx}
                onClick={() => {
                  if (!isDescanso) {
                    const mappedId = `dia-${sched.session.toLowerCase()}`;
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
                    const mappedId = `dia-${sched.session.toLowerCase()}`;
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
                    Día {sched.session}
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

      <div className="glass-card rounded-[2rem] p-5 border-glow relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-24 h-24 rounded-full bg-plasma/10 blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-plasma" />
          <h3 className="font-sans font-semibold text-sm text-white tracking-wide">
            Principios del Protocolo
          </h3>
        </div>

        <div className="space-y-4">
          {scienceFactors.map((factor, idx) => (
            <div key={idx} className="flex gap-2.5">
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
      </div>

      <div className="p-4 rounded-[1.5rem] bg-rose-500/5 border border-rose-500/10 flex flex-col items-center justify-center gap-2 text-center">
        <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider">
          Zona de Control
        </span>
        <p className="text-[11px] text-zinc-400 max-w-xs font-sans">
          Reiniciar todo el historial de ejercicios completados y series registradas.
        </p>
        <button
          onClick={onClearProgress}
          className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 text-[10px] font-mono rounded-xl text-rose-400 transition-all duration-300"
          aria-label="Reiniciar todo el progreso semanal"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reiniciar Progreso Semanal
        </button>
      </div>

    </div>
  );
}
