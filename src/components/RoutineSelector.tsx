import { useEffect, useRef, useState } from 'react';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const selectedEntry = routines.find((routine) => routine.id === selectedRoutineId);
  const accentColor = selectedRoutine?.accentColor ?? selectedEntry?.accentColor ?? '#7B61FF';

  useEffect(() => {
    if (!isOpen) return undefined;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setIsOpen(false); buttonRef.current?.focus(); }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!loading && !isOpen && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [loading, isOpen, selectedRoutineId]);

  const handleSelect = (id: string) => {
    returnFocus.current = true;
    setIsOpen(false);
    buttonRef.current?.focus();
    if (id !== selectedRoutineId) onSelectRoutine(id);
  };

  return (
    <div
      ref={selectorRef}
      className="relative z-40 mb-5"
    >
      <div
        className="glass-card rounded-[1.5rem] p-3 border-glow bg-[#0A0A14]/80 backdrop-blur-md transition-all duration-500"
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

        <div className="relative flex-1 min-w-0">
          <button
            ref={buttonRef}
            type="button"
            role="combobox"
            className={`w-full min-h-9 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-300 ${
              isOpen
                ? 'bg-white/[0.09] border-plasma/60 shadow-[0_0_22px_rgba(123,97,255,0.16)]'
                : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-plasma/40'
            } disabled:opacity-60`}
            aria-controls="routine-options"
            aria-label="Seleccionar rutina"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-busy={loading}
            disabled={loading || routines.length === 0}
            onClick={() => setIsOpen((open) => !open)}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setIsOpen(true); }
            }}
          >
            <span className="truncate text-xs font-semibold tracking-wide text-white">
              {selectedEntry?.name ?? selectedRoutine?.name ?? 'Seleccionar rutina'}
            </span>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-plasma' : ''}`} aria-hidden="true" />
          </button>

          {isOpen && (
            <div
              ref={menuRef}
              id="routine-options"
              role="listbox"
              aria-label="Rutinas disponibles"
              onKeyDown={event => {
                const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
                const index = options.indexOf(document.activeElement as HTMLButtonElement);
                const next = event.key === 'ArrowDown' ? (index + 1) % options.length : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
                if (next !== null) { event.preventDefault(); options[next]?.focus(); }
                if (event.key === 'Tab') setIsOpen(false);
              }}
              className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-plasma/30 bg-[#0C0C17]/95 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.65),0_0_25px_rgba(123,97,255,0.12)] backdrop-blur-2xl animate-[routine-menu-in_0.2s_ease-out]"
            >
              {routines.map((routine) => {
                const isSelected = routine.id === selectedRoutineId;
                return (
                  <button
                    key={routine.id}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-plasma/15 text-white outline-none focus-visible:ring-1 focus-visible:ring-plasma'
                        : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white outline-none focus-visible:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-plasma'
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
      </div>

      <span className="block mt-2 px-3 text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-400">
        Rutina seleccionada
      </span>

      {error && (
        <p className="mt-2 text-[10px] font-mono text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
