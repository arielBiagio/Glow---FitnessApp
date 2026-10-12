import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import type { useWorkoutProgress } from '../hooks/useWorkoutProgress';

interface Props { progress: ReturnType<typeof useWorkoutProgress>; accountError: string }

export default function CloudStatus({ progress, accountError }: Props) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const ref = useRef<HTMLDivElement>(null);
  const disconnected = !online && progress.saveStatus !== 'local';
  const unavailable = disconnected || progress.saveStatus === 'local' || progress.saveStatus === 'offline';
  const hasError = Boolean(accountError) || ['error', 'conflict'].includes(progress.saveStatus);
  const waiting = !hasError && !unavailable && (progress.loading || progress.saveStatus === 'saving' || progress.pendingCount > 0);
  const status = accountError ? 'No se pudo cargar la cuenta' : disconnected ? 'Sin conexión' : progress.loading ? 'Cargando progreso…' : {
    local: 'Guardado en este dispositivo', saved: 'Guardado en la nube', saving: 'Guardando en la nube…',
    offline: 'Sin conexión', error: 'Guardado pendiente', conflict: 'Hay cambios en otro dispositivo',
  }[progress.saveStatus];
  const color = hasError ? 'text-rose-400' : waiting ? 'text-amber-400' : unavailable ? 'text-zinc-400' : 'text-emerald-400';
  const Icon = unavailable ? CloudOff : Cloud;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(value => !value)} aria-label={`Progreso: ${status}${progress.pendingCount ? ` · ${progress.pendingCount} cambios pendientes` : ''}`} aria-expanded={open} aria-controls={open ? 'cloud-status' : undefined} className={`relative flex items-center justify-center w-10 h-9 rounded-xl border border-white/10 bg-white/[0.03] ${color} focus-visible:outline-2 focus-visible:outline-plasma`}>
        <Icon className={`w-5 h-5 ${waiting ? 'animate-pulse' : ''}`} aria-hidden="true" />
        <span aria-hidden="true" className="absolute right-1.5 bottom-1.5 w-1.5 h-1.5 rounded-full bg-current ring-2 ring-[#0A0A14]" />
      </button>
      <span role="status" aria-live="polite" className="sr-only">{status}{progress.pendingCount > 0 && ` · ${progress.pendingCount} cambios pendientes`}</span>
      {open && <div id="cloud-status" className="absolute top-full right-0 mt-2 w-60 rounded-2xl border border-white/10 bg-[#101020] shadow-xl p-4">
        <p className={`text-xs font-medium ${color}`}>{status}</p>
        {progress.pendingCount > 0 && <p className="text-xs text-zinc-400 mt-2">{progress.pendingCount} cambios pendientes de sincronizar.</p>}
        {unavailable && <p className="text-[11px] text-zinc-400 mt-2">Los cambios quedan guardados en este dispositivo.</p>}
      </div>}
    </div>
  );
}
