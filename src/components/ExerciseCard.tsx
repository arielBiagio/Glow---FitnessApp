import React, { memo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Check, Activity } from 'lucide-react';
import type { Exercise } from '../types';

interface ExerciseCardProps {
  exercise: Exercise;
  isCompleted: boolean;
  completedSets: number[];
  onToggleSet: (exName: string, setIdx: number) => void;
  onToggleCompleted: (exName: string) => void;
}

function ExerciseCard({ exercise, isCompleted, completedSets = [], onToggleSet, onToggleCompleted }: ExerciseCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSetClick = (setIdx: number) => {
    onToggleSet(exercise.name, setIdx);
  };

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden border transition-all duration-300 ${
        isCompleted
          ? 'border-emerald-500/30 bg-emerald-950/5'
          : isOpen
            ? 'border-plasma/30 bg-zinc-900/40'
            : 'border-zinc-900/60'
      }`}
    >
      <div className="p-4 flex items-center justify-between gap-3 select-none">
        <button
          onClick={() => onToggleCompleted(exercise.name)}
          className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-950'
          }`}
          aria-label={isCompleted ? `Marcar ${exercise.name} como incompleto` : `Marcar ${exercise.name} como completado`}
        >
          {isCompleted && <Check className="w-3.5 h-3.5" />}
        </button>

        <div className="flex-1 min-w-0" onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }} aria-expanded={isOpen} aria-label={`${exercise.name}, ${isCompleted ? 'completado' : 'pendiente'}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-sans font-semibold text-sm tracking-wide truncate ${
              isCompleted ? 'text-zinc-400 line-through' : 'text-white'
            }`}>
              {exercise.name}
            </h4>
            {exercise.keyBadge && (
              <span className="font-mono text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-plasma/20 border border-plasma/30 text-plasma">
                {exercise.keyBadge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500 font-mono">
            {exercise.volume && (
              <span>Vol: <span className={isCompleted ? 'text-zinc-500' : 'text-zinc-300'}>{exercise.volume}</span></span>
            )}
            {exercise.rest && (
              <span>Descanso: <span className="text-[#7B61FF]/80">{exercise.rest}</span></span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={() => setIsOpen(!isOpen)}>
          {exercise.loggable && (
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-800/80 px-2 py-0.5 rounded-md">
              {completedSets.length}/{exercise.sets}
            </span>
          )}
          <button
            className="text-zinc-600 hover:text-white transition-colors"
            aria-label={isOpen ? 'Cerrar detalles' : 'Abrir detalles'}
            tabIndex={-1}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-zinc-950/20 text-zinc-300 font-sans text-xs space-y-3.5">
          {exercise.loggable && (
            <div className="p-3 rounded-xl bg-zinc-900/20 border border-zinc-800/50">
              <span className="block text-[9px] font-mono uppercase tracking-widest text-[#7B61FF] font-semibold mb-2">
                Registro de Series
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: exercise.sets || 3 }).map((_, idx) => {
                  const isChecked = completedSets.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSetClick(idx)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[10px] transition-all duration-300 ${
                        isChecked
                          ? 'bg-plasma/20 border-plasma text-white'
                          : 'bg-zinc-950 border-zinc-800/80 text-zinc-500 hover:border-zinc-700'
                      }`}
                      aria-label={`Serie ${idx + 1} ${isChecked ? 'completada' : 'pendiente'}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                        isChecked ? 'border-plasma bg-plasma' : 'border-zinc-700 bg-zinc-950'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      Serie {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {exercise.description && (
            <p className="text-zinc-400 leading-relaxed">{exercise.description}</p>
          )}

          {exercise.science && (
            <div className="p-3 rounded-xl bg-plasma/5 border border-plasma/10 flex gap-2">
              <Activity className="w-4 h-4 text-plasma mt-0.5 flex-shrink-0" />
              <div>
                <span className="block text-[9px] font-mono uppercase tracking-widest text-[#7B61FF] font-semibold">EMG / Sports Science</span>
                <p className="text-zinc-300 italic font-light mt-0.5 leading-relaxed font-sans text-xs">
                  "{exercise.science}"
                </p>
              </div>
            </div>
          )}

          {exercise.tip && (
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="block text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">Ejecución</span>
                <p className="text-zinc-400 leading-relaxed mt-0.5 text-xs">{exercise.tip}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ExerciseCard);
