import { useEffect, useRef, useState } from 'react';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { Activity, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAuthorizationId, safeOAuthRedirect } from '../lib/oauth';

export default function OAuthConsentPage({ userId }: { userId: string | null }) {
  const authorizationId = getAuthorizationId(window.location.search);
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setDetails(null); setError(''); setLoading(true);
    if (!supabase || !authorizationId || !userId) {
      setError(!supabase ? 'Configurá Supabase para conectar el agente.' : 'La solicitud no es válida. Volvé a iniciar la conexión desde Sesame.');
      setLoading(false);
      return;
    }
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) throw new Error('Invalid request');
      if ('redirect_url' in data) { window.location.assign(safeOAuthRedirect(data.redirect_url)); return; }
      if (data.user.id !== userId || data.authorization_id !== authorizationId) throw new Error('Wrong identity');
      setDetails(data);
    }).catch(() => {
      if (active) setError('No se pudo cargar la solicitud. Puede haber vencido; reintentá o conectá de nuevo desde Sesame.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authorizationId, userId, attempt]);

  const decide = async (approve: boolean) => {
    if (!supabase || !details || !authorizationId || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error || !result.data?.redirect_url) throw new Error('Consent failed');
      if (alive.current) window.location.assign(safeOAuthRedirect(result.data.redirect_url));
    } catch {
      if (alive.current) setError('No se pudo completar la autorización. Intentá nuevamente.');
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div className="app-viewport w-full bg-[#030307] flex justify-center">
      <main className="app-shell-height w-full max-w-md overflow-y-auto bg-[#07070E] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] pb-[calc(env(safe-area-inset-bottom,0px)+28px)] flex flex-col justify-center gap-6">
        <header className="flex items-center justify-center gap-3">
          <Activity className="w-7 h-7 text-plasma" aria-hidden="true" />
          <h1 className="text-xl font-bold tracking-wider">GLOW</h1>
        </header>
        <section className="glass-card border-glow rounded-3xl p-5 space-y-4" aria-label="Autorizar conexión">
          <ShieldCheck className="w-7 h-7 text-plasma-ink" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Conectar tu agente</h2>
          {loading && <p role="status" className="flex items-center gap-2 text-sm text-zinc-300"><LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />Cargando solicitud…</p>}
          {details && <>
            <p className="text-sm text-zinc-300 break-words"><span className="font-semibold text-white">{details.client.name || details.client.id}</span> solicita acceso a tu cuenta.</p>
            <p className="text-sm text-zinc-300">Podrá consultar tu perfil, rutinas, ejercicios, progreso y estadísticas de entrenamiento. No podrá modificar ni borrar tus datos.</p>
            <dl className="text-xs text-zinc-400 space-y-2 break-words">
              <div><dt className="text-zinc-300">Cuenta</dt><dd>{details.user.email}</dd></div>
              <div><dt className="text-zinc-300">Volverás a</dt><dd>{details.redirect_uri}</dd></div>
              <div><dt className="text-zinc-300">Permisos de identidad solicitados</dt><dd>{details.scope || 'Sin permisos de identidad adicionales'}</dd></div>
            </dl>
            <p className="text-xs text-zinc-400">Autorizá únicamente agentes que reconozcas. Podés revocar la conexión desde Sesame.</p>
            <div className="flex gap-3">
              <button type="button" disabled={busy} onClick={() => void decide(false)} className="flex-1 rounded-xl border border-white/15 py-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-plasma">Cancelar</button>
              <button type="button" disabled={busy} onClick={() => void decide(true)} className="flex-1 rounded-xl bg-[#6F4DEB] py-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-plasma">{busy ? 'Procesando…' : 'Autorizar'}</button>
            </div>
          </>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {!loading && !details && authorizationId && userId && supabase && <button type="button" onClick={() => setAttempt(value => value + 1)} className="text-sm text-plasma-ink underline">Reintentar</button>}
          <a href="/" className="block text-center text-xs text-zinc-400 underline">Volver a GLOW</a>
        </section>
      </main>
    </div>
  );
}
