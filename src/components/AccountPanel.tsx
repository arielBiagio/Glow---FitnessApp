import { useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Props { user: User | null; error: string; pending: number; onLogin: () => void }
export default function AccountPanel({ user, error: profileError, pending, onLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const signOut = async () => {
    if (!supabase || submitting.current) return;
    if (pending && !window.confirm('Tenés cambios sin guardar en la nube. Quedarán pendientes para esta cuenta. ¿Cerrar sesión?')) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setError('No se pudo cerrar la sesión. Intentá nuevamente.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return (
    <section className="glass-card rounded-2xl p-4 mb-4" aria-label="Tu cuenta">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-white">Tu cuenta</h2>
          <p className="text-[11px] text-zinc-400 mt-1 truncate">{user?.email ?? 'Guardado en este dispositivo'}</p>
        </div>
        <button disabled={busy} onClick={user ? signOut : onLogin} className="text-xs text-zinc-300 rounded-lg border border-white/10 px-3 py-2 disabled:opacity-50">{user ? 'Salir' : 'Volver al inicio'}</button>
      </div>
      {!user && <p className="text-[11px] text-zinc-400 mt-2">El guardado en la nube todavía no está habilitado.</p>}
      {(error || profileError) && <p role="alert" className="text-xs text-rose-300 mt-3">{error || profileError}</p>}
    </section>
  );
}
