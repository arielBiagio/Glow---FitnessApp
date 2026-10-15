import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const metric = (page: import('@playwright/test').Page, name: string) => page.getByRole('heading', { name, exact: true }).locator('..').locator('p > span[aria-hidden="true"]');
const dayA = (page: import('@playwright/test').Page) => page.getByRole('navigation').getByRole('button', { name: /Día A —/ });
const summary = (page: import('@playwright/test').Page) => page.getByRole('navigation').getByRole('button', { name: /Resumen —/ });

async function enterLocal(page: import('@playwright/test').Page) {
  await page.clock.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
  await expect(metric(page, 'Días entrenando')).toHaveText('0');
}

test('información plegable: notas independientes, teclado y progreso intacto', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('glow-selected-routine', 'ariel-masa-fuerza'));
  await enterLocal(page);
  const about = page.getByRole('button', { name: 'Información: Sobre tu rutina', exact: true });
  await expect(about).toHaveAttribute('aria-expanded', 'true');
  await about.focus();
  await page.keyboard.press('Enter');
  await expect(about).toHaveAttribute('aria-expanded', 'false');
  await dayA(page).click();
  const note = page.getByRole('button', { name: 'Información: Calentamiento', exact: true });
  const main = page.getByRole('button', { name: 'Información: Trabajo Principal', exact: true });
  const panel = note.locator('..');
  const contentId = await note.getAttribute('aria-controls');
  const content = page.locator(`[id="${contentId}"]`);
  const expandedHeight = (await panel.boundingBox())!.height;
  await expect(content).toContainText('6 min en total');
  await page.getByRole('button', { name: 'Marcar Remo de aire suave como completado', exact: true }).click();
  await note.click();
  await expect(note).toHaveAttribute('aria-expanded', 'false');
  await expect(content).toHaveAttribute('aria-hidden', 'true');
  await expect(content).toHaveAttribute('inert', '');
  await expect(content).toHaveCSS('visibility', 'hidden');
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeLessThan(52);
  expect(expandedHeight).toBeGreaterThan(75);
  await expect(main).toHaveAttribute('aria-expanded', 'true');
  await note.focus();
  await page.keyboard.press('Space');
  await expect(note).toHaveAttribute('aria-expanded', 'true');
  await expect(content).toHaveCSS('visibility', 'visible');
  await expect(page.getByRole('button', { name: 'Marcar Remo de aire suave como incompleto', exact: true })).toBeVisible();
  await expect(page.locator('#console-board')).toContainText('1 de 11 ejercicios');
  await page.getByRole('button', { name: /A1 · Press de pecho en máquina, pendiente/ }).click();
  const science = page.getByRole('button', { name: 'Información: Fundamento de A1 · Press de pecho en máquina', exact: true });
  const tip = page.getByRole('button', { name: 'Información: Ejecución de A1 · Press de pecho en máquina', exact: true });
  await science.click();
  await expect(science).toHaveAttribute('aria-expanded', 'false');
  await expect(tip).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation').getByRole('button', { name: /Día B —/ }).click();
  await expect(page.getByRole('button', { name: 'Información: Calentamiento', exact: true })).toHaveAttribute('aria-expanded', 'true');
});

test('información plegable: respeta movimiento reducido y conserva el botón compacto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('glow-selected-routine', 'ariel-masa-fuerza'));
  await enterLocal(page);
  await dayA(page).click();
  const note = page.getByRole('button', { name: 'Información: Calentamiento', exact: true });
  const content = page.locator(`[id="${await note.getAttribute('aria-controls')}"]`);
  await expect(content).toHaveCSS('transition-duration', '0s');
  await note.click();
  await expect(content).toHaveCSS('visibility', 'hidden');
  await expect(note).toBeVisible();
  await expect(note).toHaveText('Información');
  await page.screenshot({ animations: 'disabled', path: 'qa-artifacts/info-collapsed-mobile.png' });
  await note.click();
  await expect(content).toHaveCSS('visibility', 'visible');
  await page.screenshot({ animations: 'disabled', path: 'qa-artifacts/info-expanded-mobile.png' });
});

test('calendario automático sin selector ni activación, con persistencia por fecha', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).click();
  await expect(page.getByText('El guardado en la nube todavía no está habilitado.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Semana anterior|Semana siguiente|Usar esta rutina/ })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  const first = page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true });
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-10-13T12:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Día B — Pierna + Core' })).toBeVisible();
  await page.getByRole('button', { name: /Día A —/ }).click();
  await expect(first).toBeEnabled(); // Tuesday's Día A is independent of Monday's.
  await page.clock.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation').getByRole('button', { name: /Resumen —/ });
  const box = await nav.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(852);
  expect(box!.y + box!.height).toBeGreaterThan(800);
  expect(errors).toEqual([]);
  await expect(page.locator('#console-board')).toHaveCSS('filter', 'none');
  await expect(page.locator('.app-shell')).toHaveCSS('opacity', '1');
  await page.screenshot({ animations: 'disabled', path: 'qa-artifacts/progreso-automatico-mobile.png' });
});

test('selector solo en resumen, nombres nuevos y progreso independiente por rutina', async ({ page }) => {
  await enterLocal(page);
  await expect(page.getByText('Cele', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('button').first()).toHaveAccessibleName(/Resumen/);
  await dayA(page).click();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await summary(page).click();
  await expect(metric(page, 'Ejercicios completos')).toHaveText('1');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Rutina N°4/ }).click();
  await dayA(page).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toHaveCount(0);
  await summary(page).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Rutina N°1/ }).click();
  await dayA(page).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
});

test('el modal permite cancelar, Escape y confirmar sin borrar otras fechas', async ({ page }) => {
  await enterLocal(page);
  await dayA(page).click();
  const checked = page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true });
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await page.getByRole('button', { name: 'Reiniciar progreso de esta sesión' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Reiniciar', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(checked).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar progreso de esta sesión' }).click();
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(checked).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar progreso de esta sesión' }).click();
  await page.screenshot({ animations: 'disabled', path: `qa-artifacts/reset-${test.info().project.name}.png` });
  await modal.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await expect(checked).toHaveCount(0);
  await summary(page).click();
  await expect(metric(page, 'Ejercicios completos')).toHaveText('0');
});

test('los confites no se repiten al reiniciar, recargar ni completar de nuevo el mismo día', async ({ page }) => {
  await enterLocal(page);
  await page.evaluate(() => {
    const seen = new WeakSet<Element>();
    (window as unknown as { celebrations: number }).celebrations = 0;
    new MutationObserver(() => {
      document.querySelectorAll('[role="alert"]').forEach(element => {
        if (element.textContent?.includes('100%') && !seen.has(element)) {
          seen.add(element);
          (window as unknown as { celebrations: number }).celebrations++;
        }
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
  await dayA(page).click();
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: /como completado$/ }).first().click();
    await expect(page.getByRole('button', { name: /como incompleto$/ })).toHaveCount(i + 1);
  }
  const toast = page.getByRole('alert').filter({ hasText: '100%' });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0);
  await page.getByRole('button', { name: 'Reiniciar progreso de esta sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await expect(page.getByRole('button', { name: /como completado$/ })).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: /como completado$/ }).first().click();
    await expect(page.getByRole('button', { name: /como incompleto$/ })).toHaveCount(i + 1);
  }
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(await page.evaluate(() => (window as unknown as { celebrations: number }).celebrations)).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).click();
  await dayA(page).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(toast).toHaveCount(0);
});

test('accesibilidad de login, resumen, menú, ejercicios y modal', async ({ page }, testInfo) => {
  const check = async (screen: string) => {
    for (const element of await page.locator('.routine-content-transition').all()) await expect(element).toHaveCSS('opacity', '1');
    if (await page.getByRole('listbox').count()) await expect(page.getByRole('listbox')).toHaveCSS('opacity', '1');
    if (await page.getByRole('dialog').count()) await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await testInfo.attach(`axe-${screen}`, { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
    expect.soft(result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), screen).toEqual([]);
  };
  await page.goto('/'); await check('login');
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).click();
  await expect(metric(page, 'Días entrenando')).toHaveText('0');
  await check('resumen');
  await page.screenshot({ animations: 'disabled', path: `qa-artifacts/resumen-${testInfo.project.name}.png` });
  await page.getByRole('combobox').click(); await check('selector');
  await page.keyboard.press('Escape');
  await dayA(page).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Hip Thrust, pendiente', exact: true }).click();
  await check('ejercicios');
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await page.getByRole('button', { name: 'Reiniciar progreso de esta sesión' }).click();
  await check('modal');
});

test('320px, desktop y movimiento reducido sin desbordamiento ni animación obligatoria', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterLocal(page);
  for (const size of [{ width: 320, height: 640 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await page.getByRole('navigation').boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ animations: 'disabled', path: `qa-artifacts/responsive-${size.width}-${test.info().project.name}.png` });
  }
  await expect(page.locator('.app-shell')).toHaveCSS('animation-name', 'none');
});

test('selector de rutina permite navegación con flechas y devuelve el foco', async ({ page }) => {
  await enterLocal(page);
  const selector = page.getByRole('combobox');
  await selector.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(selector).toBeFocused();
  await expect(selector).toHaveText(/Rutina N°2/);
});

test('navbar pegada al viewport aunque el contenedor mida menos, respetando el área segura', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterLocal(page);
  // Synthetic iOS geometry, not emulation of the physical Safari/PWA chrome.
  await page.addStyleTag({ content: '#root { height: calc(100% - 59px); min-height: 0; }' });
  expect(await page.locator('.app-viewport').evaluate(element => element.getBoundingClientRect().height)).toBe(852);
  await page.addStyleTag({ content: '.app-shell-height { height: calc(100dvh - 59px); min-height: 0; }' });
  const nav = page.getByRole('navigation');
  // Synthetic total bottom inset: desktop engines report zero native safe area.
  await nav.locator('..').evaluate(element => (element as HTMLElement).style.bottom = '46px');
  for (const height of [852, 740, 852]) {
    await page.setViewportSize({ width: 393, height });
    const box = await nav.boundingBox();
    expect(Math.round(height - box!.y - box!.height)).toBe(46);
    expect(box!.height).toBeLessThanOrEqual(68);
    expect(await nav.getByRole('button').first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.locator('#main-content').evaluate(element => element.scrollTop = element.scrollHeight);
    const scrolled = await nav.boundingBox();
    expect(Math.round(height - scrolled!.y - scrolled!.height)).toBe(46);
  }
  await page.screenshot({ path: `qa-artifacts/navbar-safe-area-${testInfo.project.name}.png`, animations: 'disabled' });
});

test('el flujo nuevo ignora las marcas anteriores y cambia de semana automáticamente', async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('glow-split:glow-cele-split:completed-exercises', JSON.stringify({ 'dia-a': { 'Caminata lateral con banda': true } })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Día A —/ }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Importar|Copiar el avance/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-10-19T12:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar progreso de esta sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como completado', exact: true })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Marcar Caminata lateral con banda como incompleto', exact: true })).toBeVisible();
});
