import { lazy, Suspense, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import { cloudConfigured } from './lib/supabase';

const WorkoutApp = lazy(() => import('./components/WorkoutApp'));
const OAuthConsentPage = lazy(() => import('./components/OAuthConsentPage'));

export default function App() {
  const auth = useAuth();
  const [localPreview, setLocalPreview] = useState(false);
  const oauthConsent = window.location.pathname.replace(/\/$/, '') === '/oauth/consent';
  if (oauthConsent && !cloudConfigured) {
    return <Suspense fallback={null}><OAuthConsentPage userId={null} /></Suspense>;
  }
  if (auth.loading || (!auth.user && (oauthConsent || !(localPreview && !cloudConfigured)))) {
    return <LoginPage loading={auth.loading} sessionError={auth.error} onLocalPreview={() => setLocalPreview(true)} />;
  }
  return (
    <Suspense fallback={<LoginPage loading sessionError="" onLocalPreview={() => {}} />}>
      {oauthConsent ? <OAuthConsentPage userId={auth.user?.id ?? null} /> : <WorkoutApp auth={auth} onLogin={() => setLocalPreview(false)} />}
    </Suspense>
  );
}
