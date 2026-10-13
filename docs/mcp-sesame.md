# GLOW MCP — rutinas, entrenamientos y estadísticas en Sesame

El MCP expone cinco herramientas de solo lectura:

| Herramienta | Información |
| --- | --- |
| `mi_perfil` | Nombre, zona horaria e ID de rutina seleccionada |
| `mis_rutinas` | Catálogo disponible, objetivos, nivel y frecuencia |
| `mi_rutina` | Rutina seleccionada (u otra por ID), calendario, ejercicios, volumen, descansos, indicaciones y avance semanal |
| `mi_entrenamiento` | Qué corresponde hoy/mañana/fecha, descanso, progreso de ese día y próxima sesión prevista |
| `mis_estadisticas` | Histórico, semana actual/anterior, mes o rango personalizado: días, semanas, sesiones, ejercicios, series y minutos estimados |

No permite modificar datos ni seleccionar rutinas desde el agente. El catálogo
sigue en JSON; no se migró a tablas ni se creó una segunda copia editable.

Frontend: `https://gemini-rutina-cele.netlify.app`.
Consentimiento: `https://gemini-rutina-cele.netlify.app/oauth/consent`.
MCP: `https://<PROJECT_REF>.supabase.co/functions/v1/glow-mcp`.

## Estado del despliegue (2026-10-12)

La función `glow-mcp` quedó desplegada en el proyecto existente `fitness app`
(`karfhpbfnuwkysmvtiad`), con sus tres variables configuradas. URL para Sesame:

```text
https://karfhpbfnuwkysmvtiad.supabase.co/functions/v1/glow-mcp
```

La comprobación pública devuelve `401` con challenge OAuth en el endpoint MCP y
`200` en su metadata. Esto es correcto: abrir el MCP en un navegador sin token no
debe mostrar perfiles. La página de consentimiento de Netlify responde `200`, y
Supabase publica discovery con registro de clientes y la clave pública ES256.

El usuario confirmó que la conexión inicial de perfil funciona en Sesame. Luego
confirmó la aplicación de la migración 004 y se desplegó la versión `0.2.0` con las
consultas de entrenamientos. Queda probar estas nuevas herramientas desde Sesame:
actualizar/reconectar el MCP si el asistente sigue viendo solo `mi_perfil`.

No se inició sesión como usuario ni se consultaron perfiles/historiales reales
desde el agente de desarrollo. No se ejecutaron migraciones ni se cambiaron claves
de firma durante los despliegues; las migraciones y el hook los aplicó el usuario.

El build del frontend se actualizó para que el consentimiento describa el acceso
a rutinas, progreso y estadísticas. Publicar ese nuevo `dist/` en Netlify; el cambio
del MCP ya está desplegado y no requiere otra URL, claves ni hook nuevos.

El gateway de Supabase elimina `/functions/v1` en la ruta interna. El handler admite
esa ruta y la pública, manteniendo issuer/audience y metadata con la URL pública
canónica. Una regresión local cubre ese detalle y el handshake del SDK con ruta interna.

## Cómo funciona y qué protege

1. Sesame descubre el servidor de autorización mediante la metadata anunciada en
   `WWW-Authenticate`, y comienza OAuth con Supabase.
2. Supabase abre la pantalla de consentimiento de GLOW. Si no hay sesión, el login
   existente conserva `authorization_id` en la misma URL.
3. La pantalla obtiene el cliente, la cuenta, el destino y los permisos de identidad
   desde la API autenticada de Supabase. No toma una URL de retorno de la query.
4. Al aprobar, Supabase devuelve al agente un código; el agente lo canjea por tokens.
5. El Custom Access Token Hook asigna a los clientes OAuth el rol
   `glow_mcp_reader`, que **no hereda `authenticated`**. También añade la URL del
   MCP a la audiencia del JWT. Las sesiones normales sin `client_id` no cambian.
6. La función valida firma ES256/RS256, issuer, audience, expiración, usuario,
   `client_id` y rol. Un token de login normal, un token antiguo sin el hook o un
   token de servicio no permiten usar el MCP.
7. El cliente de base de datos usa ese token, nunca una clave privada. Tiene SELECT
   sobre cuatro columnas de `profiles` y las columnas necesarias del historial,
   con RLS por usuario. Solo puede ejecutar el nuevo RPC de estadísticas (STABLE,
   SECURITY INVOKER), no los RPC que crean semanas o modifican progreso.

Los scopes OIDC (`openid`, `profile`, `email`, etc.) no equivalen a permisos de
escritura en PostgreSQL. La limitación está en el rol y sus grants, no en un texto
de la pantalla o en las anotaciones de las herramientas.

Todos los clientes OAuth del proyecto quedan limitados a estas lecturas. La
migración 004 amplía la lectura de los clientes ya autorizados; por eso el texto
del consentimiento se actualiza también. Si
en el futuro se agregan otros clientes con más permisos, habrá que diseñar un
registro de clientes y permisos explícitos antes de ampliar el hook.
Las futuras funciones de escritura deben revocar EXECUTE de PUBLIC y concederlo
solo a los roles de la app que lo necesiten; no dar permisos implícitos al agente.

## Configuración del proyecto existente — orden importante

Los pasos de configuración siguientes también sirven para repetir la instalación
en otro proyecto. En este proyecto la función ya está desplegada, como se indica
arriba: no repetir migraciones ya aplicadas ni volver a ejecutar todo sin necesidad.

### 1. Aplicar solamente la nueva migración

En el SQL Editor, ejecutar completo:

`supabase/migrations/202610120003_mcp_profile_oauth.sql`

Después, para las consultas de entrenamientos y estadísticas:

`supabase/migrations/202610120004_mcp_workout_reads.sql`

En GLOW ambas ya fueron confirmadas como aplicadas por el usuario. No repetirlas.

Requiere las tablas de la migración 001 y la columna `display_name` de la 002.
No borra ni migra datos. Es una migración versionada para ejecutar una sola vez.
No repetir 001/002 ni usar `db push` a ciegas si las tablas anteriores se crearon
copiando SQL y el historial del CLI todavía no está registrado.

### 2. Activar el hook ANTES de habilitar OAuth

En **Authentication → Hooks → Custom Access Token**, elegir la función SQL
`public.glow_mcp_access_token_hook`.

Si ya existe un hook, **no reemplazarlo sin integrar su lógica**. La migración
por sí sola no activa el hook. El rol limitado debe estar funcionando antes de
autorizar al agente; ocultar herramientas de escritura no protege un token OAuth
que conserve los permisos normales de la app.

El hook deriva la audiencia a partir del issuer HTTPS del propio token. No hace
falta copiar una URL del proyecto en SQL. Funciona también en el refresco de tokens
cuando Supabase mantiene el `client_id` del cliente OAuth.

### 3. Claves de firma

En **Authentication → JWT Signing Keys**, verificar que el proyecto utiliza una
clave asimétrica ES256 o RS256. Este MCP rechaza HS256 y no necesita conocer el
JWT secret. Si se requiere una rotación, seguir el procedimiento oficial de
Supabase; no eliminar claves anteriores ni forzar una rotación improvisada.

### 4. Publicar el frontend actualizado en Netlify

```sh
npm run build
```

Publicar `dist/` en el sitio existente. El build contiene `/oauth/consent`,
`_redirects` para que Netlify sirva esa ruta directamente, y headers anti-iframe,
sin caché y sin referrer para esa pantalla. La ruta no debe devolver un 404.

En **Authentication → URL Configuration**, establecer Site URL:

```text
https://gemini-rutina-cele.netlify.app
```

El frontend conserva el login de correo/contraseña; no se cambia a login social.

### 5. Configurar OAuth Server

En **Authentication → OAuth Server**:

- Activar OAuth 2.1 Server (Supabase lo documenta actualmente como beta).
- Authorization Path: `/oauth/consent`.
- Si Sesame registra automáticamente su cliente, habilitar Dynamic Client
  Registration. Esto permite registrar clientes externos; revisar los clientes y
  aprobar solo solicitudes reconocidas.
- Si Sesame requiere registro manual, registrar su cliente y usar **exactamente**
  la redirect URI que indique Sesame. No se inventó una URI de retorno.

La documentación pública de Sesame confirma MCP con OAuth, pero no especifica
todos los detalles de registro de clientes o transporte. Esta conexión sigue
pendiente de probar en la app real.

### 6. Desplegar la Edge Function

Requiere Supabase CLI autenticado en tu cuenta. Reemplazar `<PROJECT_REF>` con el
identificador del proyecto que ya usa GLOW. No poner contraseñas ni claves privadas.

```sh
npx supabase login
npx supabase functions deploy glow-mcp --project-ref <PROJECT_REF> --no-verify-jwt
```

El gateway debe permitir discovery sin JWT. **Esto no vuelve público el perfil**:
`handler.ts` verifica el JWT en cada petición privada antes de leer datos.

En los Secrets de las Edge Functions, agregar:

| Nombre | Valor |
| --- | --- |
| `GLOW_SUPABASE_PUBLISHABLE_KEY` | La clave pública `sb_publishable_...` del mismo proyecto |
| `GLOW_MCP_RESOURCE_URL` | `https://<PROJECT_REF>.supabase.co/functions/v1/glow-mcp`, sin barra final |
| `GLOW_MCP_ALLOWED_ORIGINS` | `https://gemini-rutina-cele.netlify.app,https://app.sesame.com` |
| `GLOW_MCP_APP_URL` (opcional) | Origen HTTPS del catálogo; por defecto `https://gemini-rutina-cele.netlify.app` |

`SUPABASE_URL` viene del runtime. No configurar `SUPABASE_SERVICE_ROLE_KEY`, JWT
secret ni una `sb_secret_...` para este servidor. Si el proyecto usa dominio
personalizado, issuer, resource URL y proyecto deben coincidir exactamente.

El código y `deno.lock` fijan sus dependencias. El frontend no carga el SDK MCP.

### 7. Conectar en Sesame

En la sección de Apps del asistente elegido, agregar el MCP externo con la URL:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/glow-mcp
```

Completar el login de GLOW y revisar la pantalla antes de autorizar. Después pedir:

> Consultá mi perfil de GLOW y decime mi nombre y la rutina seleccionada.

`mi_perfil` conserva su formato: si no existe perfil, devuelve `profileExists:
false` y no lo crea. Las otras herramientas personales piden configurar primero
el perfil/rutina en GLOW, sin elegir una rutina por su cuenta.

Ejemplos adicionales:

> ¿Qué ejercicios y series me faltan hoy?
>
> ¿Mañana entreno o descanso?
>
> ¿Cuántos días y series hice esta semana?
>
> Contame de qué trata mi rutina y sus descansos.

Sesame configura permisos por asistente: conectar uno no conecta automáticamente
a los demás.

## Fechas, versiones y límites de las respuestas

- Hoy y mañana usan la zona horaria del perfil, no la del servidor ni la voz del
  agente. Las semanas empiezan el lunes; las fechas se desplazan como calendario,
  sin sumar 24 horas que pueden fallar al cambiar el horario de verano.
- Un día de descanso sigue siendo descanso, aunque la app sugiera abrir el próximo
  entrenamiento. La próxima sesión se etiqueta como proyección del calendario.
- Cada fecha usa su propia sesión. Una marca de ayer no completa un ejercicio de
  hoy. Se informan también sesiones realizadas fuera del día previsto.
- Si existe snapshot para esa rutina/semana, se usa esa versión, no el JSON nuevo.
  En otras semanas se lee el catálogo publicado en Netlify por fetch, con origen
  fijo, archivos permitidos, sin redirects, límite de tamaño y sin reenviar tokens.
- Sin snapshot de una fecha pasada, se advierte que el calendario actual es una
  proyección, no un plan histórico confirmado. No se crean semanas/sesiones para
  responder preguntas futuras.
- Las estadísticas abarcan todas las rutinas y usan los mismos criterios del
  Resumen: fechas con actividad, semanas únicas, sesiones completas y marcas de
  ejercicios/series. Se agregan en PostgreSQL sin descargar todo el historial.
- Los minutos son los previstos de las sesiones completas, no tiempo cronometrado.
- El avance semanal adicional corresponde siempre a la rutina actual y la semana
  actual, independientemente del período solicitado para las estadísticas.
- Solo se ve progreso sincronizado. Un error de permisos/red no se transforma en
  estadísticas de cero. El texto de las rutinas se trata como datos, no instrucciones.

## Verificación y límites

```sh
npm run typecheck
npm run mcp:check
npm run lint
npm test
npm run test:e2e -- --project=cloud-mocked --grep "OAuth:"
```

Las pruebas usan claves JWT efímeras, API simulada y PostgreSQL efímero. No conectan
con Sesame ni con Supabase real. Incluyen discovery, tokens inválidos, handshake
con el SDK oficial, usuarios concurrentes, campos extra rechazados y ausencia de
permisos de escritura. Deno check comprueba también el punto de entrada de la función.

No se hizo QA completo, Lighthouse ni commit/push. Durante la preparación inicial
no hubo cambios remotos; posteriormente se desplegó únicamente `glow-mcp` y se
configuraron sus tres variables. El usuario confirmó el perfil en Sesame; las
preguntas de calendario/estadísticas de la versión 0.2.0 siguen pendientes de esa
comprobación real. Las validaciones locales finales registran 64 pruebas correctas.

La validación local de JWT no comprueba revocación en cada llamada. Al revocar un
grant, los tokens ya emitidos pueden seguir funcionando hasta expirar; documentar
esa ventana o añadir comprobación de revocación antes de prometer corte inmediato.

## Si algo falla

- **No abre el login:** comprobar el `401` con `WWW-Authenticate` y la metadata en
  `<MCP_URL>/.well-known/oauth-protected-resource`. Revisar OAuth Server y el modo
  de registro que realmente utiliza Sesame.
- **El consentimiento da 404:** subir el build nuevo con `_redirects` y revisar el
  Site URL + Authorization Path.
- **401 después de autorizar:** comprobar firma asimétrica, hook activo, audiencia
  y rol `glow_mcp_reader`. Reconectar para obtener tokens nuevos después de activar
  el hook. No pegar tokens en tickets, logs o conversaciones.
- **Error de permiso al consultar:** comprobar que se aplicaron 003 y 004 y que el
  perfil existe. No intentar resolverlo usando una clave de servicio.
- **Origin rechazado:** comprobar el Origin real del cliente y añadir solo ese
  origen de confianza a `GLOW_MCP_ALLOWED_ORIGINS`, no un wildcard.

## Fuentes oficiales

- [Sesame: conexión de apps y MCP con OAuth](https://www.sesame.com/journal/getting-started).
- [Supabase: OAuth Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started).
- [Supabase: Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks).
- [Supabase: Token Security y RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).
- [Supabase: desplegar tu propio MCP](https://supabase.com/docs/guides/ai-tools/byo-mcp).
