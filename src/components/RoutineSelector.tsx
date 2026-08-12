import React from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { Routine, RoutineManifestEntry } from '../types';

interface RoutineSelectorProps {
  routines: RoutineManifestEntry[];
  selectedRoutine: Routine | null;
  selectedRoutineId: string;
  onSelectRoutine: (id: string) => void;
  loading: boolean;
  error: string | null;
}

export default function RoutineSelector({
  routines,
  selectedRoutine,
  selectedRoutineId,
  onSelectRoutine,
  loading,
  error,
}: RoutineSelectorProps) {
  return (
    <div
      className="glass-card rounded-[1.5rem] p-3 mb-5 border-glow bg-[#0A0A14]/80 backdrop-blur-md transition-all duration-500"
      style={{ borderColor: `${selectedRoutine?.accentColor ?? '#7B61FF'}33` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-500"
          style={{
            color: selectedRoutine?.accentColor ?? '#A78BFA',
            backgroundColor: `${selectedRoutine?.accentColor ?? '#7B61FF'}18`,
            borderColor: `${selectedRoutine?.accentColor ?? '#7B61FF'}40`,
          }}
        >
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="routine-select" className="block text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">
            Programa activo
          </label>
          <div className="relative">
            <select
              id="routine-select"
              className="w-full appearance-none outline-none rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] focus:border-plasma/50 focus:ring-2 focus:ring-plasma/10 text-white text-xs font-semibold tracking-wide px-3 py-2 pr-9 transition-all duration-300 disabled:opacity-60"
              value={selectedRoutineId}
              onChange={(event) => onSelectRoutine(event.target.value)}
              disabled={loading || routines.length === 0}
            >
              {routines.map((routine) => (
                <option key={routine.id} value={routine.id} className="bg-[#0A0A14] text-white">
                  {routine.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
          </div>
        </div>

        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500 ${loading ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: selectedRoutine?.accentColor ?? '#7B61FF' }}
          aria-hidden="true"
        />
      </div>

      {selectedRoutine && (
        <div className="flex items-center gap-2 mt-2 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
          <span>{selectedRoutine.goal}</span>
          <span className="text-zinc-700">·</span>
          <span>{selectedRoutine.frequency}</span>
          {loading && <span className="text-plasma animate-pulse">Cargando…</span>}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[10px] font-mono text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
