# Activar el guardado en Supabase

La app incluye una pantalla inicial de login con correo y contraseña, registro automático por fecha real de entrenamiento, marcas por ejercicio/serie, cola de cambios y resolución explícita de conflictos entre dispositivos. La semana se calcula internamente; no hay un selector ni una activación manual. Sin configuración de Supabase se puede elegir una vista previa local desde el inicio.

## 1. Crear la base

Crear un proyecto nuevo en tu cuenta de Supabase. Abrir **SQL Editor**, pegar el contenido completo de `supabase/migrations/202610120001_workout_backend.sql` y ejecutarlo una vez. El archivo contiene una transacción: si algo falla, no debe quedar una instalación parcial. No ejecutarlo nuevamente sobre una instalación ya aplicada ni sobre tablas ajenas con los mismos nombres.

El SQL crea cinco tablas de dominio (`profiles`, `workout_weeks`, `workout_sessions`, `workout_exercises`, `workout_sets`) y `progress_operations`, que registra los cambios confirmados para evitar duplicados. Cada sesión tiene `session_date`, la fecha de entrenamiento; un mismo Día A puede repetirse otro día sin sobrescribir el anterior. Habilita RLS y concede lectura únicamente de los datos propios. Los cambios se hacen por funciones autorizadas; el navegador no tiene permiso de escribir directamente en las tablas.

RPC expuestos: `glow_get_profile`, `glow_get_week`, `glow_activate_week`, `glow_save_progress`. Los helpers de serialización son privados. Cada RPC de escritura comprueba la identidad y el dueño y se ejecuta en una transacción.

Para el saludo personalizado, aplicar también `supabase/migrations/202610120002_profile_display_name.sql`, salvo que ya se haya agregado `display_name` manualmente. En **Table Editor → profiles**, completar ese campo en la fila de la persona; su `id` coincide con el de **Authentication → Users**. El login continúa solo con correo y contraseña. El Resumen muestra «Hola, [nombre]»; si no hay nombre, muestra «Tu entrenamiento». La app lee el campo directamente con RLS, sin modificar `glow_get_profile`, y lo actualiza al recargar o volver al foco de la ventana. Conserva una caché por cuenta para uso sin conexión; un error al leer el nombre no bloquea el progreso.

## 2. Configurar ingreso por correo y contraseña

En **Authentication**, habilitar Email y utilizar una cuenta existente de **Authentication → Users** con correo y contraseña. Si se creó manualmente, comprobar que el correo figure confirmado. Un registro en una tabla de la base o una cuenta del dashboard de Supabase no equivale a un usuario de la app en Supabase Auth.

La app llama a `signInWithPassword({ email, password })`. No utiliza OTP, no envía un código y no crea cuentas automáticamente. El usuario ya configurado puede ingresar con sus credenciales habituales. No hace falta cambiar las tablas del progreso para reemplazar el método de login.

La pantalla inicial protege el acceso a entrenamientos cuando Supabase está configurado. Una sesión válida permite entrar automáticamente al recargar; cerrar sesión vuelve al login. Sin configuración, la opción **Continuar sin cuenta** habilita solo el modo local de demostración; esa opción no aparece en la app conectada.

La contraseña se mantiene únicamente en memoria mientras se envía a Supabase; no se guarda en archivos de entorno ni en el almacenamiento del navegador. No añadir el correo ni la contraseña de un usuario a `.env.local`.

Para ingresar con una cuenta existente no hace falta configurar OTP ni SMTP. El envío de correos y los redirects son necesarios si después se incorporan registro con confirmación o recuperación de contraseña, que no forman parte de esta pantalla. Ver [autenticación con contraseña](https://supabase.com/docs/guides/auth/passwords).

## 3. Conectar el frontend

Copiar `.env.example` como `.env.local` y completar con la **URL del proyecto** y su **clave publishable**, disponibles en el diálogo Connect o Settings → API Keys:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Estos dos valores son públicos. No colocar claves `sb_secret_...`, `service_role`, tokens de administrador ni contraseña de PostgreSQL en el frontend. Los archivos de entorno reales están excluidos de Git.

Después de completar el archivo, reiniciar el servidor de desarrollo:

```sh
npm install
npm run dev
```

Ingresar desde la pantalla inicial con el correo y la contraseña y marcar un ejercicio en una pestaña de entrenamiento. La app prepara automáticamente el contexto de hoy y calcula la semana en la zona horaria del perfil. El ícono de nube del encabezado debe quedar verde; al tocarlo muestra **Guardado en la nube**. Reabrir la app o ingresar desde otro navegador con la misma cuenta debe recuperar el avance de hoy.

## 4. Publicar en Netlify

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Subir el `dist` generado después de configurar `.env.local`. Vite incorpora esas variables durante el build: un `dist` compilado sin ellas funciona en modo local y no se conecta a la nube por agregar variables después en Netlify. Si Netlify compila desde Git, configurar allí las dos variables antes del build.

El build normal utiliza la configuración pública de `.env.local` cuando está presente. Las pruebas generan un build local aislado en `dist-qa-local` con esas variables vacías; ese directorio es solo para QA y no reemplaza el `dist` de despliegue.

## 5. Uso y conservación de datos

- La rutina elegida se prepara automáticamente. La app calcula la fecha local y el lunes de esa semana, sin botones de activación ni selector de semanas.
- La pantalla inicial es **Resumen**. Se puede entrar a cualquier Día A/B/C/D desde la barra o el avance semanal. Si cambia la fecha mientras se está en una pestaña de ejercicios, se sugiere el entrenamiento correspondiente al calendario (o el siguiente en un día de descanso). La sesión registra la fecha en que se entrena, no la fecha sugerida en el programa.
- Al cambiar de fecha se prepara una sesión nueva; las anteriores permanecen en la base. Reabrir el mismo día recupera sus marcas. Una nueva semana también empieza con progreso vacío y conserva el historial anterior.
- El progreso se guarda por IDs permanentes y por sesión, usando el snapshot del plan original. Editar el JSON no reescribe los entrenamientos previos.
- Cada marca se escribe primero en IndexedDB junto con su operación pendiente. Con una sesión ya cargada, se puede continuar durante un corte de Internet. Al volver la conexión se envía la cola de esa cuenta y se actualiza el estado visible.
- Un conflicto de revisión se detiene para decidir **Conservar la nube** o **Aplicar mis cambios**. La primera opción descarta el borrador pendiente de la sesión en conflicto; la segunda lo aplica explícitamente sobre la versión remota. Las demás sesiones conservan sus cambios. Los imports no pueden sobrescribir sesiones ya modificadas.
- **Reiniciar esta sesión** afecta solo a ese entrenamiento de hoy. No existe un borrado global del historial.
- La implementación comienza con datos nuevos, según la decisión del propietario. No se leen ni importan las marcas antiguas de `localStorage` ni la caché del prototipo anterior. El modo local usa ahora `glow-workouts-v2`; no hace falta borrar manualmente los datos anteriores.
- Ingresar a una cuenta no copia las marcas de invitado. Los datos de la cuenta se guardan a partir de su uso con el nuevo backend.
- `session_date` conserva la fecha de origen incluso si una operación pendiente se envía al día siguiente. `started_at`/`completed_at` son timestamps del servidor, que pueden reflejar el momento de sincronización durante un corte; no se usan para inventar duración real ni reemplazan la fecha de la sesión.

## 6. Pruebas y límites de esta entrega

`npm test` verifica calendario local, IDs, snapshots, IndexedDB y el SQL real en PostgreSQL embebido con PGlite. Se simulan `auth.users`, `auth.uid()` y los roles de Supabase para probar RLS y los RPC con cuentas de prueba. No se conecta a una base remota.

`npm run test:e2e` genera builds de producción aislados para modo local y nube simulada en `127.0.0.1`. Verifica login con contraseña, guardado, reconexión, Resumen, selector, modal, celebración y accesibilidad. No utiliza el proyecto de `.env.local`. Si no hay Chrome instalado en Windows, instalar el navegador de prueba con `npx playwright install chromium` o definir `PLAYWRIGHT_CHROMIUM_EXECUTABLE` con su ruta. Para la cobertura WebKit, ejecutar `npx playwright install webkit`. Ningún test envía correos reales.

La pestaña inicial **Resumen** incluye selección e información de la rutina, estadísticas acumuladas y avance de los días de la rutina actual durante la semana. Las estadísticas leen las tablas existentes, protegidas por RLS; no requieren otra migración. Se pagina tanto el historial como las semanas, sin repetir la plantilla en cada sesión. Los minutos son estimaciones de sesiones completas, no tiempo cronometrado. Sin conexión se muestra el historial disponible en este dispositivo y se informa que puede estar incompleto. La cobertura automática y sus límites están documentados en `qa-report.md`.

El historial detallado por fecha, notas, cargas/repeticiones reales, entrenamientos omitidos explícitamente y acceso desde cero sin Internet quedan para próximas entregas. Ya se permite repetir un mismo Día A en fechas diferentes; dos entrenamientos separados del mismo Día A en una sola fecha requerirían un identificador adicional de sesión.

La validación del ingreso con la cuenta real, las políticas desplegadas y la recuperación entre dispositivos físicos debe completarse desde la app configurada. El reporte local está en `qa-report.md`.
