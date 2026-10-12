import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';

interface Props {
  open: boolean;
  dayName: string;
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ResetProgressDialog({ open, dayName, disabled, onClose, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      confirmed.current = false;
      element.showModal();
      cancel.current?.focus();
    } else if (!open && element.open) element.close();
  }, [open]);

  return createPortal(
    <dialog ref={dialog} className="reset-progress-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="reset-progress-panel relative overflow-hidden p-5">
        <div aria-hidden="true" className="absolute -top-16 -left-12 w-48 h-48 rounded-full bg-plasma/15 blur-[60px] pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border border-plasma/30 bg-plasma/10"><RotateCcw className="w-4 h-4 text-plasma" aria-hidden="true" /></div>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-wider text-plasma-ink mb-1">{dayName} · Hoy</p>
              <h2 id="reset-title" className="text-base font-semibold text-white tracking-tight">¿Reiniciar sesión?</h2>
            </div>
          </div>
          <p id="reset-description" className="mt-3 text-xs leading-relaxed text-zinc-400">Se borrarán solo las marcas de hoy, sin afectar tu historial. No se puede deshacer.</p>
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <button ref={cancel} type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08] transition-colors focus-visible:outline-2 focus-visible:outline-plasma">Cancelar</button>
            <button type="button" disabled={disabled} onClick={() => { if (confirmed.current || disabled) return; confirmed.current = true; onConfirm(); }} className="rounded-xl border border-rose-400/30 bg-rose-500/15 py-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-rose-400">Reiniciar</button>
          </div>
        </div>
      </div>
    </dialog>, document.body,
  );
}
