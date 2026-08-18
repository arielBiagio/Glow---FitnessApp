import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const selectedEntry = routines.find((routine) => routine.id === selectedRoutineId);
  const accentColor = selectedRoutine?.accentColor ?? selectedEntry?.accentColor ?? '#7B61FF';

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    setIsOpen(false);
    if (id !== selectedRoutineId) onSelectRoutine(id);
  };

  return (
    <div
      ref={selectorRef}
      className="relative z-40 glass-card rounded-[1.5rem] p-3 mb-5 border-glow bg-[#0A0A14]/80 backdrop-blur-md transition-all duration-500"
      style={{ borderColor: `${accentColor}33` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-500"
          style={{
            color: accentColor,
            backgroundColor: `${accentColor}18`,
            borderColor: `${accentColor}40`,
          }}
        >
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="block text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-1">
            Programa activo
          </span>

          <button
            type="button"
            role="combobox"
            className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-300 ${
              isOpen
                ? 'bg-white/[0.09] border-plasma/60 shadow-[0_0_22px_rgba(123,97,255,0.16)]'
                : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-plasma/40'
            } disabled:opacity-60`}
            aria-controls="routine-options"
            aria-label="Programa activo"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            disabled={loading || routines.length === 0}
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className="truncate text-xs font-semibold tracking-wide text-white">
              {selectedEntry?.name ?? selectedRoutine?.name ?? 'Seleccionar rutina'}
            </span>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-plasma' : ''}`} aria-hidden="true" />
          </button>

          {isOpen && (
            <div
              id="routine-options"
              role="listbox"
              aria-label="Rutinas disponibles"
              className="absolute left-[3.25rem] right-3 top-[4.65rem] overflow-hidden rounded-2xl border border-plasma/30 bg-[#0C0C17]/95 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.65),0_0_25px_rgba(123,97,255,0.12)] backdrop-blur-2xl animate-[routine-menu-in_0.2s_ease-out]"
            >
              {routines.map((routine) => {
                const isSelected = routine.id === selectedRoutineId;
                return (
                  <button
                    key={routine.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-plasma/15 text-white'
                        : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                    }`}
                    onClick={() => handleSelect(routine.id)}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: routine.accentColor }}
                      aria-hidden="true"
                    />
                    <span className="truncate flex-1">{routine.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-plasma flex-shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500 ${loading ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}99` }}
          aria-hidden="true"
        />
      </div>

      {selectedRoutine && (
        <div className="flex items-center gap-2 mt-2 text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
          <span>{selectedRoutine.goal}</span>
          <span className="text-zinc-600">·</span>
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
