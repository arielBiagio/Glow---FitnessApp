import { lazy, Suspense, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import { cloudConfigured } from './lib/supabase';

const WorkoutApp = lazy(() => import('./components/WorkoutApp'));

export default function App() {
  const auth = useAuth();
  const [localPreview, setLocalPreview] = useState(false);
  if (auth.loading || (!auth.user && !(localPreview && !cloudConfigured))) {
    return <LoginPage loading={auth.loading} sessionError={auth.error} onLocalPreview={() => setLocalPreview(true)} />;
  }
  return (
    <Suspense fallback={<LoginPage loading sessionError="" onLocalPreview={() => {}} />}>
      <WorkoutApp auth={auth} onLogin={() => setLocalPreview(false)} />
    </Suspense>
  );
}
