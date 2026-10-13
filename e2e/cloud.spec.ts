import { expect, test, type Page } from '@playwright/test';
import { createLocalWeek, applyOperation, type WorkoutWeek } from '../src/lib/workouts';
import { readFileSync } from 'node:fs';
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'qa@example.test', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-12T00:00:00Z' };
const testPassword = ' qa-password-test ';
const jwt = () => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'test-only-signature'].join('.');

export async function mockCloud(page: Page) {
  await page.clock.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  const weeks = new Map<string, WorkoutWeek>();
  let writes = 0;
  let conflict = false;
  let invalidPassword = false;
  let authRequests = 0;
  let historyRequests = 0;
  let name = ' Ana  Pérez ';
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = route.request().url();
    const body = route.request().postDataJSON();
    const fulfill = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'x-supabase-api-version': '2024-01-01' }, body: JSON.stringify(value) });
    if (url.includes('/auth/v1/token')) {
      authRequests++;
      expect(url).toContain('grant_type=password');
      expect(body.email).toBe('qa@example.test');
      expect(body.password).toBe(testPassword);
      if (invalidPassword) return fulfill({ code: 'invalid_credentials', error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      return fulfill({ access_token: jwt(), refresh_token: 'qa-refresh', token_type: 'bearer', expires_in: 3600, user });
    }
    if (url.includes('/auth/v1/logout')) return fulfill({});
    if (url.includes('/rpc/glow_get_profile')) return fulfill({ timezone: 'UTC', selectedRoutineId: null });
    if (url.includes('/rest/v1/profiles')) return fulfill([{ display_name: name }]);
    if (url.includes('/rest/v1/workout_weeks')) return fulfill([...weeks.values()].map(week => ({ id: week.id, week_start: week.weekStart, days: week.routineSnapshot.days })));
    if (url.includes('/rest/v1/workout_sessions')) {
      historyRequests++;
      return fulfill([...weeks.values()].flatMap(week => week.sessions.filter(session => session.revision > 0).map(session => ({
        id: session.id, revision: session.revision, week_id: week.id, day_id: session.dayId, session_date: session.sessionDate, status: session.status,
        exercises: session.exercises.map(exercise => ({ completed: exercise.completed, sets: exercise.completedSets.map(() => ({ completed: true })) })),
      }))));
    }
    if (url.includes('/rpc/glow_get_week')) return fulfill(weeks.get(`${body.p_routine_id}:${body.p_week_start}`) ?? null);
    if (url.includes('/rpc/glow_activate_week')) {
      const key = `${body.p_routine.id}:${body.p_week_start}`;
      if (!weeks.has(key)) weeks.set(key, createLocalWeek(body.p_routine, body.p_week_start, body.p_timezone, body.p_session_date));
      const week = weeks.get(key)!;
      if (!week.sessions.some(session => session.sessionDate === body.p_session_date)) {
        week.sessions.push(...createLocalWeek(week.routineSnapshot, body.p_week_start, body.p_timezone, body.p_session_date).sessions);
      }
      return fulfill(weeks.get(key));
    }
    if (url.includes('/rpc/glow_save_progress')) {
      writes++;
      const week = [...weeks.values()].find(value => value.sessions.some(session => session.id === body.p_session_id))!;
      const session = week.sessions.find(value => value.id === body.p_session_id)!;
      if (conflict) { conflict = false; session.revision++; return fulfill({ code: '40001', message: 'Changed', details: null, hint: null }, 409); }
      const day = week.routineSnapshot.days.find(value => value.id === session.dayId)!;
      const next = applyOperation(session, day, body.p_operation);
      week.sessions = week.sessions.map(value => value.id === next.id ? next : value);
      return fulfill(next);
    }
    return fulfill({ message: 'Unexpected mocked request', url }, 400);
  });
  return { weeks, historyRequests: () => historyRequests, displayName: (value: string) => { name = value; }, writes: () => writes, conflict: () => { conflict = true; }, invalidPassword: (value: boolean) => { invalidPassword = value; }, authRequests: () => authRequests };
}
async function login(page: Page) {
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill('qa@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByText('qa@example.test', { exact: true })).toBeVisible();
}

test('correo y contraseña, guardado remoto, sesión persistida y salida al login', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.goto('/');
  await expect(page.locator('#main-content')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continuar sin cuenta', exact: true })).toHaveCount(0);
  await login(page);
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await expect(page.getByRole('button', { name: /Progreso: Guardado en la nube/ })).toBeVisible();
  expect(cloud.writes()).toBe(1);
  await page.getByRole('button', { name: 'Marcar Hip Thrust con barra vacía como completado', exact: true }).dblclick();
  await expect(page.getByRole('button', { name: 'Marcar Hip Thrust con barra vacía como completado', exact: true })).toBeVisible();
  await expect.poll(cloud.writes).toBe(3);
  await expect(page.getByRole('button', { name: /Progreso: Guardado en la nube/ })).toBeVisible();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
  expect(cloud.authRequests()).toBe(1);
  const stored = await page.evaluate(() => Object.values(localStorage).join(''));
  expect(stored).not.toContain(testPassword);
  await page.getByRole('navigation').getByRole('button', { name: /Resumen —/ }).click();
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await expect(page.locator('#main-content')).toHaveCount(0);
});

test('offline conserva cambios y sincroniza al volver; conflicto requiere decisión', async ({ page, context }) => {
  const cloud = await mockCloud(page);
  await page.goto('/'); await login(page);
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  const checkbox = page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true });
  await expect(checkbox).toBeEnabled();
  await context.setOffline(true);
  await checkbox.click();
  await expect(page.getByRole('button', { name: /Progreso: Sin conexión/ })).toBeVisible();
  expect(cloud.writes()).toBe(0);
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: /Progreso: Guardado en la nube/ })).toBeVisible();
  cloud.conflict();
  await page.getByRole('button', { name: 'Marcar Hip Thrust con barra vacía como completado', exact: true }).click();
  await expect(page.getByText('Esta sesión cambió en otro dispositivo. Elegí qué versión conservar.')).toBeVisible();
  await page.getByRole('button', { name: 'Conservar la nube', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar Hip Thrust con barra vacía como completado', exact: true })).toBeEnabled();
});

test('una contraseña inválida no habilita entrenamientos y permite reintentar', async ({ page }) => {
  const cloud = await mockCloud(page);
  cloud.invalidPassword(true);
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('qa@example.test');
  const password = page.getByLabel('Contraseña', { exact: true });
  await password.fill(testPassword);
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);
  await page.screenshot({ animations: 'disabled', path: 'qa-artifacts/login-mobile.png' });
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
  await expect(page.locator('#main-content')).toHaveCount(0);
  await expect(password).toHaveValue(testPassword);
  expect(cloud.writes()).toBe(0);
  cloud.invalidPassword(false);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByText('qa@example.test', { exact: true })).toBeVisible();
});

test('las cuentas comienzan sin importar marcas anteriores del navegador', async ({ page }) => {
  await mockCloud(page);
  await page.goto('/');
  await page.addInitScript(() => localStorage.setItem('glow-split:glow-cele-split:completed-exercises', JSON.stringify({ 'dia-a': { 'Caminata lateral con banda': true } })));
  await page.reload();
  await login(page);
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Copiar el avance|Importar progreso/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Progreso: Guardado en la nube/ })).toBeVisible();
});

test('el nombre manual se normaliza, se actualiza y se renderiza como texto seguro', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.goto('/'); await login(page);
  await expect(page.getByText('¡Hola, Ana Pérez!', { exact: true })).toBeVisible();
  cloud.displayName('  ');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Tu entrenamiento', { exact: true })).toBeVisible();
  cloud.displayName('<img src=x onerror=window.injected=true>');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('¡Hola, <img src=x onerror=window.injected=true>!', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { injected?: boolean }).injected)).toBeUndefined();
});

test('el resumen reúne historial remoto y cambios actuales sin repetir snapshots ni lecturas durante el guardado', async ({ page }) => {
  const cloud = await mockCloud(page);
  const routine = JSON.parse(readFileSync('public/routines/glow-cele-split.json', 'utf8'));
  const historical = createLocalWeek(routine, '2026-10-05', 'UTC', '2026-10-06');
  for (const exercise of historical.sessions[0].exercises) historical.sessions[0] = applyOperation(historical.sessions[0], routine.days[0], { kind: 'exercise', exerciseId: exercise.exerciseId, completed: true });
  cloud.weeks.set(`${routine.id}:2026-10-05`, historical);
  const metric = (name: string) => page.getByRole('heading', { name, exact: true }).locator('..').locator('p > span[aria-hidden="true"]');
  await page.goto('/'); await login(page);
  await expect(metric('Días entrenando')).toHaveText('1');
  await expect(metric('Semanas activas')).toHaveText('1');
  await expect(metric('Sesiones completas')).toHaveText('1');
  await expect(metric('Minutos estimados')).toHaveText('61');
  expect(cloud.historyRequests()).toBe(1);
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await page.getByRole('button', { name: 'Hip Thrust, pendiente', exact: true }).click();
  await page.getByRole('button', { name: 'Serie 1 pendiente', exact: true }).click();
  await expect(page.getByRole('button', { name: /Progreso: Guardado en la nube/ })).toBeVisible();
  expect(cloud.historyRequests()).toBe(1); // The summary is not loaded while training.
  await page.getByRole('navigation').getByRole('button', { name: /Resumen —/ }).click();
  await expect(metric('Días entrenando')).toHaveText('2');
  await expect(metric('Semanas activas')).toHaveText('2');
  await expect(metric('Minutos estimados')).toHaveText('61');
  await expect(metric('Ejercicios completos')).toHaveText('8');
  await expect(metric('Series completas')).toHaveText('11');
  expect(cloud.historyRequests()).toBe(2);
  await page.screenshot({ animations: 'disabled', path: 'qa-artifacts/resumen-cloud-historial.png' });
});

test('fallo del historial conserva la app y permite actualizar', async ({ page }) => {
  await mockCloud(page);
  await page.route('**/rest/v1/workout_sessions**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test unavailable' }) }));
  await page.goto('/'); await login(page);
  await expect(page.getByText('No se pudo actualizar el historial de la nube.', { exact: false })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true })).toBeEnabled();
});

for (const approve of [true, false]) {
  test(`OAuth: login conserva la solicitud y permite ${approve ? 'autorizar' : 'cancelar'} sin guardar entrenamientos`, async ({ page }) => {
    const cloud = await mockCloud(page);
    let decisions = 0;
    const callback = `https://sesame.example.test/callback?${approve ? 'code=fixture' : 'error=access_denied'}&state=fixture-state`;
    await page.route('**/auth/v1/oauth/authorizations/**', async route => {
      if (route.request().method() === 'POST') {
        decisions++;
        expect(route.request().postDataJSON()).toEqual({ action: approve ? 'approve' : 'deny' });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ redirect_url: callback }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        authorization_id: 'test-authorization', client: { id: 'fixture-client', name: 'Sesame <b>fixture</b>' },
        user: { id: user.id, email: user.email }, scope: 'openid profile', redirect_uri: 'https://sesame.example.test/callback',
      }) });
    });
    await page.route('https://sesame.example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Callback local de prueba</p>' }));
    await page.goto('/oauth/consent?authorization_id=test-authorization');
    await login(page);
    await expect(page.getByRole('heading', { name: 'Conectar tu agente' })).toBeVisible();
    await expect(page.getByText('Sesame <b>fixture</b>', { exact: true })).toBeVisible();
    await expect(page.locator('section b')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    expect(decisions).toBe(0);
    await page.screenshot({ animations: 'disabled', path: `qa-artifacts/oauth-consent-${approve ? 'approve' : 'deny'}.png` });
    await page.getByRole('button', { name: approve ? 'Autorizar' : 'Cancelar', exact: true }).click();
    await expect(page).toHaveURL(callback);
    expect(decisions).toBe(1);
    expect(cloud.writes()).toBe(0);
  });
}

test('OAuth: una solicitud vencida no puede aprobarse y permite reintentar', async ({ page }) => {
  await mockCloud(page);
  await page.route('**/auth/v1/oauth/authorizations/**', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Expired fixture' }) }));
  await page.goto('/oauth/consent?authorization_id=test-authorization');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar la solicitud');
  await expect(page.getByRole('button', { name: 'Autorizar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
});
