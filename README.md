# GLOW

Aplicación web para organizar rutinas de entrenamiento y registrar el progreso diario. Permite seguir ejercicios y series, guardar el avance en la nube y consultar un resumen de la actividad.

## Funcionalidades

- Inicio de sesión con correo y contraseña mediante Supabase Auth.
- Selección de rutinas organizadas por días, con ejercicios, series, repeticiones, descansos e indicaciones.
- Registro automático por fecha y semana, sin activar planes ni elegir semanas manualmente.
- Progreso por ejercicio y serie, independiente para cada rutina y usuario.
- Resumen de días y semanas con actividad, sesiones completas, ejercicios, series y minutos estimados.
- Guardado local y sincronización de cambios pendientes al recuperar la conexión, con la sesión y rutina ya cargadas.
- Interfaz adaptada a móviles, saludo personalizado y estado de guardado en la nube.

Los minutos del Resumen se calculan a partir de la duración prevista de las sesiones completas; no representan tiempo cronometrado.

## Tecnologías

React, TypeScript, Vite y Tailwind CSS. Supabase para autenticación y base de datos PostgreSQL con políticas RLS; IndexedDB para caché y cambios pendientes.

## Desarrollo local

Requiere Node.js y npm. El proyecto se verificó con Node.js 24.

1. Instalá las dependencias:

   ```sh
   npm ci
   ```

2. Copiá `.env.example` a `.env.local` y completá la configuración pública de Supabase:

   ```dotenv
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Seguí la [guía de Supabase](docs/supabase-setup.md) para crear las tablas y configurar una cuenta de acceso. No uses claves secretas ni subas `.env.local` al repositorio. Sin configuración de Supabase, la app permite una vista previa con guardado local.

3. Iniciá el servidor:

   ```sh
   npm run dev
   ```

## Build y despliegue

```sh
npm run build
npm run preview
```

El build se genera en `dist/` y puede desplegarse en Netlify u otro hosting estático. Las variables de Supabase deben estar configuradas antes de compilar.

## Pruebas

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium webkit
npm run test:e2e
```

Las pruebas utilizan datos de ejemplo, PostgreSQL embebido y una API de Supabase simulada; no modifican la base real.

## Documentación

- [Configuración de Supabase](docs/supabase-setup.md).
- [Arquitectura y almacenamiento](docs/backend-supabase.md).
- [Conectar GLOW con Sesame mediante MCP y OAuth](docs/mcp-sesame.md) — consultas de solo lectura de rutinas, calendario y estadísticas.
- [Informe de QA y rendimiento](qa-report.md).

Las rutinas se definen en `public/routines/`. Al personalizarlas, conservá los IDs existentes y aumentá la versión cuando cambies la prescripción para no alterar el historial.
