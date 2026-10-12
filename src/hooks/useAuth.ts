import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { deviceTimezone } from '../lib/dates';
import { getDisplayName, getProfile } from '../lib/workoutRepository';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<{ owner: string; timezone: string; selectedRoutineId: string | null } | null>(null);
  const [name, setName] = useState<{ owner: string; value: string | null } | null>(null);
  const userId = user?.id;
  const [profileAttempt, setProfileAttempt] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let receivedEvent = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      if (alive) { setUser(session?.user ?? null); setLoading(false); }
    });
    void supabase.auth.getSession().then(({ data: session, error }) => {
      if (!alive) return;
      if (!receivedEvent) setUser(session.session?.user ?? null);
      if (error) setError('No se pudo recuperar la sesión. Volvé a ingresar.');
      setLoading(false);
    }).catch(() => { if (alive) { setLoading(false); setError('No se pudo recuperar la sesión.'); } });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    setProfile(previous => previous?.owner === userId ? previous : null);
    if (!userId) return;
    let alive = true;
    try {
      const cached = JSON.parse(localStorage.getItem(`glow-profile:${userId}`) ?? 'null');
      if (cached?.timezone && typeof cached.timezone === 'string') {
        new Intl.DateTimeFormat('es', { timeZone: cached.timezone });
        setProfile({ owner: userId, timezone: cached.timezone, selectedRoutineId: cached.selectedRoutineId ?? null });
      }
    } catch { /* Profile can still be loaded from the server. */ }
    void getProfile(deviceTimezone()).then(value => {
      if (alive) {
        setProfile({ owner: userId, ...value }); setError('');
        try { localStorage.setItem(`glow-profile:${userId}`, JSON.stringify(value)); } catch { /* Optional offline preference cache. */ }
      }
    }).catch(() => { if (alive) setError('No se pudo cargar tu perfil. Revisá la conexión y la configuración de Supabase.'); });
    return () => { alive = false; };
  }, [userId, profileAttempt]);
  useEffect(() => {
    if (!userId) { setName(null); return; }
    let alive = true;
    const cacheKey = `glow-display-name:${userId}`;
    let cachedName: string | null = null;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null');
      cachedName = typeof cached === 'string' ? cached.trim().replace(/\s+/g, ' ') || null : null;
    } catch { /* Optional offline name cache. */ }
    setName({ owner: userId, value: cachedName });
    void getDisplayName(userId).then(value => {
      if (!alive) return;
      setName({ owner: userId, value });
      try { localStorage.setItem(cacheKey, JSON.stringify(value)); } catch { /* The in-memory name still works. */ }
    }).catch(() => { /* A missing name must not block login or workout progress. */ });
    return () => { alive = false; };
  }, [userId, profileAttempt]);
  useEffect(() => {
    const retry = () => setProfileAttempt(value => value + 1);
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry); };
  }, []);
  const ownProfile = profile?.owner === user?.id ? profile : null;
  return {
    user, loading, error, profileReady: !user || Boolean(ownProfile),
    displayName: name?.owner === user?.id ? name?.value ?? null : null,
    timezone: ownProfile?.timezone ?? deviceTimezone(),
    preferredRoutineId: ownProfile?.selectedRoutineId ?? null,
    retryProfile: () => setProfileAttempt(value => value + 1),
  };
}
