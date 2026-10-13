import { z } from 'zod';

const identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,119}$/);
const text = z.string().max(4000);
const exercise = z.object({
  id: identifier, name: text, volume: text,
  rest: text.optional(), description: text.optional(), tip: text.optional(), science: text.optional(),
  loggable: z.boolean().optional(), sets: z.number().int().min(1).max(50).optional(),
}).refine(value => !value.loggable || value.sets !== undefined, 'Series inválidas');
const day = z.object({
  id: identifier, name: text, subtitle: text, summary: z.object({ total: z.number().min(0).max(1440) }),
  sections: z.array(z.object({ id: identifier, title: text, note: text.optional(), exercises: z.array(exercise).min(1).max(50) })).min(1).max(10),
});
export const routineSchema = z.object({
  id: identifier, version: z.number().int().min(1), name: text, description: text, level: text, frequency: text, goal: text,
  days: z.array(day).min(1).max(7),
  weeklySchedule: z.array(z.object({ weekday: z.number().int().min(1).max(7), dayId: identifier.optional(), day: text, name: text, session: text })).min(1).max(14),
}).superRefine((routine, context) => {
  const ids = new Set<string>();
  for (const value of routine.days) {
    if (ids.has(value.id) || routine.weeklySchedule.filter(entry => entry.dayId === value.id).length !== 1) context.addIssue({ code: 'custom', message: 'Calendario inválido' });
    ids.add(value.id);
    const exercises = value.sections.flatMap(section => section.exercises.map(item => item.id));
    if (new Set(exercises).size !== exercises.length) context.addIssue({ code: 'custom', message: 'Ejercicios duplicados' });
  }
  if (routine.weeklySchedule.some(entry => entry.dayId && !ids.has(entry.dayId))) context.addIssue({ code: 'custom', message: 'Día desconocido' });
});
export type RoutineDocument = z.infer<typeof routineSchema>;
export type RoutineDay = RoutineDocument['days'][number];
const manifestSchema = z.object({ routines: z.array(z.object({
  id: identifier, name: text, description: text, goal: text, level: text, frequency: text,
  file: z.string().regex(/^\/routines\/[a-z0-9_-]+\.json$/),
})).min(1).max(32) });

export class WorkoutReadError extends Error {}

export function createRoutineCatalog(appUrl: string, fetcher: typeof fetch) {
  const origin = new URL(appUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('A canonical HTTPS app origin is required');
  // No tokens, supplied URLs or redirects are sent to the public catalog.
  const load = async (path: string) => {
    const response = await fetcher(new URL(path, origin), { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new WorkoutReadError('No se pudo cargar el catálogo público de rutinas de GLOW.');
    const reader = response.body?.getReader();
    if (!reader) throw new WorkoutReadError('La rutina no tiene contenido.');
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 200000) throw new WorkoutReadError('La rutina supera el tamaño permitido.');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  let manifest: Promise<z.infer<typeof manifestSchema>> | undefined;
  const getManifest = () => manifest ??= load('/routines/index.json').then(value => {
    const parsed = manifestSchema.parse(value);
    if (new Set(parsed.routines.map(item => item.id)).size !== parsed.routines.length) throw new WorkoutReadError('El catálogo tiene rutinas duplicadas.');
    return parsed;
  });
  return {
    list: async () => (await getManifest()).routines.map(({ file: _file, ...entry }) => entry),
    get: async (id: string): Promise<RoutineDocument> => {
      const entry = (await getManifest()).routines.find(item => item.id === id);
      if (!entry) throw new WorkoutReadError('Esa rutina no está en el catálogo de GLOW.');
      const routine = routineSchema.parse(await load(entry.file));
      if (routine.id !== id) throw new WorkoutReadError('El identificador de la rutina no coincide.');
      return routine;
    },
  };
}
