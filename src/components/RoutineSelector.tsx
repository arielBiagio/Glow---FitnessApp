import React from 'react';
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
    <div className="glass-card rounded-[1.5rem] p-3 mb-5 border-glow bg-[#0A0A14]/70 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="routine-select" className="block text-[9px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
            Programa activo
          </label>
          <select
            id="routine-select"
            className="w-full bg-transparent text-white text-sm font-semibold appearance-none outline-none rounded px-0 py-0.5 disabled:opacity-60"
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
        </div>

        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
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
