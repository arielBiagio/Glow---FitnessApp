import type { useWorkoutProgress } from '../hooks/useWorkoutProgress';

interface Props { progress: ReturnType<typeof useWorkoutProgress> }
export default function ProgressPanel({ progress }: Props) {
  if (!progress.error) return null;
  return (
    <div className="mb-4 px-1" aria-label="Estado de guardado">
      {progress.error && <div className="mt-2 p-3 rounded-xl border border-rose-400/20 bg-rose-500/5 text-xs text-rose-300 space-y-2" role="alert">
        <p>{progress.error}</p>
        {progress.conflict ? <div className="flex flex-wrap gap-2">
          <p className="w-full text-zinc-400">La decisión afecta solo al entrenamiento en conflicto.</p>
          <button disabled={progress.busy} onClick={() => progress.resolveConflict(false)} className="rounded-lg border border-white/20 p-2">Conservar la nube</button>
          <button disabled={progress.busy} onClick={() => { if (window.confirm('¿Aplicar tus cambios pendientes sobre la versión de la nube?')) void progress.resolveConflict(true); }} className="rounded-lg border border-white/20 p-2">Aplicar mis cambios</button>
        </div> : <button onClick={progress.retry} className="underline">Reintentar</button>}
      </div>}
    </div>
  );
}
