import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { cloudConfigured, supabase } from '../lib/supabase';

interface Props { loading: boolean; sessionError: string; onLocalPreview: () => void }

export default function LoginPage({ loading, sessionError, onLocalPreview }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      // Passwords are not trimmed or persisted. Supabase owns credential validation.
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const message = error.code === 'invalid_credentials' || error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' :
          error.code === 'email_not_confirmed' ? 'Confirmá tu correo antes de ingresar.' :
          error.status === 429 ? 'Hubo demasiados intentos. Esperá un momento y volvé a probar.' :
          'No se pudo iniciar sesión. Revisá tu conexión e intentá nuevamente.';
        if (alive.current) setError(message);
        return;
      }
      if (!data.session || !data.user) throw new Error('Missing session');
      if (alive.current) setPassword('');
    } catch {
      if (alive.current) setError('No se pudo iniciar sesión. Revisá tu conexión e intentá nuevamente.');
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div className="app-viewport w-full bg-[#030307] flex justify-center">
      <main className="app-shell-height relative w-full max-w-md overflow-y-auto bg-[#07070E] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] pb-[calc(env(safe-area-inset-bottom,0px)+28px)] md:border-x md:border-white/5">
        <div aria-hidden="true" className="absolute top-28 -left-20 w-80 h-80 bg-plasma/15 blur-[90px] rounded-full pointer-events-none" />
        <div aria-hidden="true" className="absolute bottom-0 right-0 w-56 h-56 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative flex min-h-full flex-col justify-center gap-8">
          <header>
            <div className="flex items-center justify-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-plasma/10 border border-plasma/30 flex items-center justify-center"><Activity className="w-5 h-5 text-plasma" aria-hidden="true" /></span>
              <h1 className="text-xl tracking-wider font-bold text-white">GLOW</h1>
            </div>
          </header>

          <section className="glass-card border-glow rounded-[1.75rem] p-5 min-h-[314px] flex flex-col justify-center" aria-label="Acceso a tu cuenta">
            {loading ? <div className="py-8 flex items-center justify-center gap-3 text-sm text-zinc-300" role="status"><LoaderCircle className="w-5 h-5 text-plasma animate-spin" aria-hidden="true" /> Recuperando tu sesión…</div> : <>
              <h2 className="text-lg text-white font-semibold mb-5">Iniciar sesión</h2>
              <form onSubmit={submit} className="space-y-4" aria-label="Iniciar sesión">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-zinc-300 mb-2">Correo electrónico</label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="absolute top-3.5 left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input id="login-email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} disabled={busy || !cloudConfigured} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl bg-zinc-950/70 border border-zinc-700/70 pl-10 pr-3 py-3 text-base text-white outline-none focus:border-plasma focus:ring-2 focus:ring-plasma/15 disabled:opacity-50" placeholder="tu@correo.com" />
                  </div>
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium text-zinc-300 mb-2">Contraseña</label>
                  <div className="relative">
                    <LockKeyhole aria-hidden="true" className="absolute top-3.5 left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input id="login-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} disabled={busy || !cloudConfigured} onChange={event => setPassword(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined} className="w-full rounded-xl bg-zinc-950/70 border border-zinc-700/70 pl-10 pr-12 py-3 text-base text-white outline-none focus:border-plasma focus:ring-2 focus:ring-plasma/15 disabled:opacity-50" placeholder="Tu contraseña" />
                    <button type="button" disabled={busy || !cloudConfigured} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1 p-3 rounded-lg text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-plasma disabled:opacity-50">{showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}</button>
                  </div>
                </div>
                {(error || sessionError) && <p id="login-error" role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-3 text-xs text-rose-300 leading-relaxed">{error || sessionError}</p>}
                <button type="submit" disabled={busy || !cloudConfigured} className="w-full flex justify-center items-center gap-2 rounded-xl bg-[#6F4DEB] py-3 text-sm font-semibold text-white hover:bg-[#7755F2] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma disabled:opacity-50">{busy ? <><LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />Ingresando…</> : <>Ingresar<ArrowRight className="w-4 h-4" aria-hidden="true" /></>}</button>
              </form>
              {!cloudConfigured && <div className="mt-4 text-center space-y-3">
                <p className="text-xs text-zinc-400">El inicio de sesión todavía no está disponible.</p>
                <button type="button" onClick={onLocalPreview} className="text-xs text-plasma-ink underline underline-offset-4">Continuar sin cuenta</button>
              </div>}
            </>}
          </section>
        </div>
      </main>
    </div>
  );
}
