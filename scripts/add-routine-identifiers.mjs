// One-time mechanical migration. IDs are persisted, never recalculated at runtime.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
for (const file of readdirSync('public/routines').filter(name => name !== 'index.json' && name.endsWith('.json'))) {
  const path = `public/routines/${file}`;
  const routine = JSON.parse(readFileSync(path, 'utf8'));
  routine.version ??= 1;
  for (const day of routine.days) {
    day.sections.forEach((section, sectionIndex) => {
      section.id ??= `${day.id}-section-${sectionIndex + 1}`;
      section.exercises.forEach((exercise, exerciseIndex) => {
        exercise.id ??= `${section.id}-exercise-${exerciseIndex + 1}`;
      });
    });
  }
  routine.weeklySchedule.forEach((entry, index) => {
    entry.weekday ??= index + 1;
    if (entry.session !== 'Descanso') entry.dayId ??= `dia-${entry.session.toLowerCase()}`;
  });
  writeFileSync(path, `${JSON.stringify(routine, null, 2)}\n`);
}
