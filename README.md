# GLOW Split

App de rutinas de entrenamiento construida con React, TypeScript y Vite. Las rutinas se cargan desde JSON; la fecha y la semana se calculan automáticamente y el avance se guarda por entrenamiento, ejercicio y serie.

## Desarrollo

```sh
npm install
npm run dev
```

La pantalla inicial permite ingresar con el correo y la contraseña de una cuenta existente de Supabase Auth. Sin variables de Supabase se puede elegir una vista previa que guarda en este dispositivo. Para habilitar el guardado en la nube, seguir la [guía de configuración](docs/supabase-setup.md).

Después de ingresar, **Resumen** reúne el selector de rutinas, su descripción, el avance de la semana y las estadísticas del historial: días y semanas con actividad, sesiones, ejercicios, series y minutos estimados de sesiones completas. Los días de entrenamiento tienen sus propias pestañas; el ícono de nube del encabezado indica el estado de guardado y muestra el detalle al tocarlo. El nombre del saludo se administra mediante `profiles.display_name`. El reporte de QA detalla la cobertura local y las comprobaciones pendientes en Supabase real y dispositivos físicos.

## Base de datos

Ejecutar una vez el [SQL completo](supabase/migrations/202610120001_workout_backend.sql) en el editor de un proyecto Supabase nuevo. Incluye tablas, RLS y funciones de guardado transaccional. Aplicar después la [columna opcional del nombre](supabase/migrations/202610120002_profile_display_name.sql), salvo que ya exista. Copiar `.env.example` a `.env.local` y completar la URL y la clave pública publishable. Nunca usar una clave secreta en el frontend.

## Verificación

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Los tests de SQL utilizan PostgreSQL embebido y cuentas de prueba; el E2E de nube simula Supabase y no envía correos. El reporte y las limitaciones están en [qa-report.md](qa-report.md).

Para la cobertura WebKit de Playwright, instalar el navegador de prueba una vez con `npx playwright install webkit`. Ambos modos E2E sirven builds de producción aislados; no utilizan credenciales reales. Las fuentes Sora y Fira Code se sirven desde el propio build, y los confites se descargan solo al completar una sesión. Las auditorías de accesibilidad utilizan axe.

Para repetir Lighthouse después del E2E, servir el build de nube simulada con `npm run preview -- --outDir dist-qa-cloud --host 127.0.0.1 --port 5183 --strictPort`. En otra terminal, ejecutar `npm run audit:lighthouse -- after http://127.0.0.1:5183/ 3`. Genera tres informes HTML/JSON y un resumen con medianas en `qa-artifacts/`. El script solo acepta URLs locales; no ejecutar las auditorías con cuentas ni datos reales. Detener el preview al terminar.

## Netlify

`npm run build` genera `dist`. Para guardar en la nube, configurar las dos variables de entorno antes de compilar. Si se usa un despliegue manual, subir el `dist` generado con esa configuración.

## Rutinas

Los archivos de `public/routines/` tienen IDs permanentes para días, secciones y ejercicios, y una versión. Conservar esos IDs al renombrar o reordenar elementos y aumentar la versión al cambiar la prescripción. Cada plan guarda su propio snapshot: cambiar una plantilla no modifica el historial.
