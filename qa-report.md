# QA Report: GLOW (2026-10-12)

## MCP 0.2.0: rutinas, calendario y estadísticas (2026-10-12)

**Veredicto: implementado y desplegado; preguntas reales en Sesame pendientes.**
El usuario confirmó la migración 004 aplicada en el mismo proyecto. Se actualizó
únicamente `glow-mcp`; no se modificaron datos, claves, hook ni otras funciones.
No se inició sesión como usuario desde el agente de desarrollo. Sin QA completo,
Lighthouse, suite E2E completa, commit ni push.

### Plan y cobertura focalizada

1. Confirmar criterios de calendario, sesiones y Resumen leyendo la app existente.
2. Verificar permisos SQL y agregación en PGlite, con dos usuarios aislados.
3. Comprobar las cuatro rutinas JSON y snapshots semanales con fetch simulado.
4. Probar zona horaria, descanso, cambio de año/DST, fechas inválidas y progreso
   independiente por fecha, sin crear sesiones.
5. Comprobar registro/llamada de las cinco herramientas con el SDK oficial y las
   validaciones anteriores de JWT, Origin y rutas internas.
6. Comprobar tipos/build antes del deploy y solo disponibilidad pública después;
   no comprobar perfiles o estadísticas reales con credenciales ajenas al agente.

### Resultados

- Base: typecheck, lint, build y **51/51** pruebas correctos.
- Final: typecheck, Deno check, lint, build y **64/64** pruebas correctos. Nuevas
  verificaciones de SQL, catálogo, snapshots, calendario, rangos y errores. La
  negociación del SDK llama las cinco herramientas con datos ficticios.
- Evidencia: [resultado local](qa-artifacts/mcp-workouts-vitest-results.json).
- Despliegue: MCP sin token `401` con challenge, metadata `200` con recurso/issuer
  correctos y catálogo público Netlify `200` con cuatro rutinas. Son comprobaciones
  públicas de disponibilidad, no QA de producción ni lectura privada real.
- El frontend solo cambia el texto de consentimiento para reflejar el acceso a
  progreso/estadísticas. Se recompiló `dist/`; publicar esa versión en Netlify.

### Garantías y límites

- Migración 004 concede solo SELECT de columnas necesarias y un RPC STABLE,
  SECURITY INVOKER, sin parámetro de usuario y protegido por RLS. A/B no mezclan
  datos. Continúan denegados DELETE/UPDATE, RPC de progreso y lectura del ledger.
- El calendario usa la zona del perfil y el helper de fechas existente. Descanso
  no se reemplaza por el día sugerido de la app. Los snapshots prevalecen sobre
  recetas nuevas; sin snapshot pasado, la respuesta advierte que es proyección.
- No se reenvían tokens al catálogo público. Se rechazan archivos externos,
  redirects, rutinas desconocidas/duplicadas, fechas inexistentes y tamaño >200 KB.
- Un error de lectura no se presenta como cero. El historial vacío sí devuelve
  cero; una caída del catálogo no borra estadísticas obtenidas de Supabase.
- Minutos estimados y progreso solo sincronizado se identifican explícitamente.
- No se cambiaron la selección de rutinas ni el formato/almacenamiento JSON.
- Queda verificar las nuevas consultas desde Sesame y publicar el consentimiento
  actualizado. La conexión anterior de perfil fue confirmada por el usuario.

No hay fallos reproducibles abiertos dentro de esta cobertura local. El límite de
revocación de JWT descrito en la guía sigue vigente. CI puede añadirse como paso
opcional; no se creó un workflow sin aprobación.

## Despliegue MCP en Supabase (2026-10-12)

**Veredicto: MCP desplegado; consentimiento real en Sesame pendiente.** Se identificó
el proyecto por la URL pública de GLOW y la sesión del CLI iniciada por el usuario.
Se creó únicamente `glow-mcp` y se configuraron sus tres variables (publishable key,
resource URL y origins). No se ejecutaron migraciones, no se modificaron claves de
firma ni otras funciones, no se consultaron perfiles reales y no se hizo commit/push.

### Arreglados

- **[S2] Ruta interna distinta tras el gateway de Supabase.** El primer despliegue
  devolvía `404` en el endpoint y su metadata porque el gateway elimina
  `/functions/v1`. Una nueva prueba local reprodujo el `404` frente al `401` esperado.
  El handler ahora normaliza únicamente el prefijo exacto de esta función, manteniendo
  la URL pública para issuer/audience/metadata. El test y el handshake del SDK usando
  la ruta interna pasan después del cambio. No se redujo ninguna validación OAuth.

### Comprobación acotada

- Plan: reproducir localmente la ruta del gateway; validar autenticación/SDK con
  fixtures; comprobar tipos Deno; actualizar la función; verificar solo las rutas
  públicas del despliegue. Sin QA completo, Lighthouse ni accesos autenticados reales.
- Línea base: typecheck, lint, build y **50/50** pruebas unitarias/SQL correctos.
- Final: typecheck, lint, build (frontend sin cambios) y Deno check correctos;
  **51/51** pruebas unitarias/SQL correctos. No se repitió Playwright.
- Evidencia local: [resultado de pruebas](qa-artifacts/mcp-deploy-vitest-results.json).
- Disponibilidad del despliegue: endpoint MCP `401` con `WWW-Authenticate`;
  metadata `200` con recurso y servidor OAuth correctos; discovery de Supabase `200`
  anunciando registro; JWKS público ES256; pantalla Netlify `/oauth/consent` `200`.
  Son comprobaciones de disponibilidad/configuración pública, no aprobación del
  flujo OAuth real ni del acceso a datos.

### Pendientes

- Agregar el endpoint en Sesame, completar autorización y pedir `mi_perfil`.
- Verificar la emisión efectiva del rol/audience y la lectura del perfil en esa
  conexión real. No se crearon clientes/grants ni se usaron cuentas de prueba en
  producción para fingir una validación integral.

Endpoint desplegado: `https://karfhpbfnuwkysmvtiad.supabase.co/functions/v1/glow-mcp`.

## Comprobación focalizada: MCP de perfil y OAuth para Sesame

**Veredicto: base local preparada; conexión real pendiente.** No se hizo QA completo. No se activó OAuth, se aplicó SQL ni se desplegó código en Supabase/Netlify reales. No se hizo commit/push. El servidor del usuario en 5173 no se detuvo.

**Tipo:** SPA React con pantalla de consentimiento, Edge Function Deno/MCP y rol PostgreSQL específico.
**Plan acotado:** tipos y compilación; JWT y discovery con claves efímeras; handshake con cliente SDK oficial; aislamiento SQL/RLS y permisos; tres recorridos de consentimiento con API simulada. Se excluyeron Lighthouse, suite E2E completa, iPhone físico y proveedores reales.

### Resultados de esta etapa

- Línea base: typecheck, lint, build y 31 pruebas existentes correctos.
- Final: typecheck, `mcp:check` (Deno), lint y build correctos.
- **50/50 pruebas Vitest/SQL:** 31 anteriores, 17 de MCP/validación OAuth y 2 adicionales de permisos/hook SQL.
- **3/3 E2E focalizados en Chrome con Supabase simulado:** login conservando `authorization_id`, autorización/cancelación explícitas, retorno al callback preservando estado, texto externo no interpretado como HTML y solicitud vencida sin botón de aprobación. No se repitió WebKit.
- La instalación de las dependencias de desarrollo informó 0 vulnerabilidades. El SDK MCP, el cliente de prueba y Deno no se incluyen en el bundle del frontend. La pantalla OAuth se carga de forma diferida (5,24 KB sin comprimir).
- Evidencia: [Vitest/SQL](qa-artifacts/mcp-vitest-results.json), [OAuth Playwright](qa-artifacts/oauth-playwright-results.json), [pantalla de consentimiento](qa-artifacts/oauth-consent-approve.png). El archivo genérico `playwright-results.json` ahora corresponde a esta ejecución acotada, no a las suites históricas que se describen más abajo.

### Protecciones comprobadas

- Discovery público y `401` con `WWW-Authenticate`; firma y expiración JWT, issuer y audience exactos, client_id, rol y UUID. Rechazo de tokens normales, de servicio, manipulados y de usuarios anónimos.
- SDK oficial contra el mismo handler HTTP, con única herramienta `mi_perfil`, sin parámetros de usuario, anotaciones de solo lectura y clientes separados por petición.
- Rol `glow_mcp_reader` sin herencia de `authenticated`: solo SELECT de cuatro columnas del perfil propio; niega escritura, lectura de entrenamientos, RPC de progreso y ejecución del hook. Login normal y refresco OAuth comprobados con eventos simulados.
- Origin allowlist, límite de cuerpo de 16 KiB, timeouts, mensajes de error sin datos internos y respuesta explícita si no existe perfil; la herramienta no crea registros.

### Pendientes y límites

- Aplicar la migración 003 y activar el Custom Access Token Hook **antes** de habilitar OAuth. Los grants y el hook se ejecutaron en PostgreSQL efímero, no contra Supabase alojado.
- Publicar el frontend con `/oauth/consent`, configurar Site URL/Authorization Path y desplegar `glow-mcp` con sus variables. Revisar claves ES256/RS256 y registro de clientes.
- Confirmar en Sesame la cadena real de discovery, registro, PKCE, consentimiento y refresco. La documentación pública confirma OAuth, pero no todos los detalles de compatibilidad de su cliente.
- Los JWT ya emitidos pueden conservar acceso hasta su expiración tras revocar un grant. No se implementó una consulta de revocación por petición.
- Rutinas/estadísticas y migración JSON → JSONB no forman parte de este hito. No hay fallos reproducibles abiertos en esta cobertura local; las dependencias de despliegue no se consideran aprobadas.
- Como paso opcional, se puede agregar CI para estas comprobaciones. No se creó un workflow sin aprobación.

Configuración detallada: [MCP y Sesame](docs/mcp-sesame.md). Para repetir las pruebas focalizadas: `npm run test:e2e -- --project=cloud-mocked --grep "OAuth:"`.

## Historial: optimización y navbar

**Veredicto: listo con reservas.** La optimización y las pruebas locales pasan. Antes de publicar hay que comprobar la integración desplegada con Supabase y el comportamiento en un iPhone físico; estos entornos no se probaron aquí.

**Tipo detectado:** SPA React/TypeScript/Vite con Supabase Auth, PostgreSQL/RLS e IndexedDB.
**Entorno:** Windows, Node 24.14.1, Lighthouse 13.5.0, Chrome headless y WebKit 27.2. Builds de producción separados para modo local y nube simulada. Base SQL efímera con PGlite. Viewports 393 × 852, 320 × 640 y 1440 × 900.
**Seguridad operativa:** no se inició sesión con credenciales reales, no se modificó Supabase real, no se cambió `.env.local`, no se hizo commit ni push. La aplicación del usuario en el puerto 5173 se conservó.

## Revalidación: navbar inferior (2026-10-12)

**Actualización posterior a esas pruebas:** tras una segunda captura del iPhone, el margen de la navbar en modo instalado (`standalone`/`fullscreen`) se cambió a 4 px y luego a 2 px a pedido del usuario, sin sumar `safe-area-inset-bottom`. Safari normal conserva el inset + 8 px. Por pedido del usuario no se ejecutó QA de estos últimos ajustes; solo se generó el build. Los resultados siguientes corresponden al ajuste anterior y no certifican esta última regla.

**Aprobación visual posterior:** el usuario confirmó que la posición final de 2 px está bien y autorizó el commit y push. Esta confirmación no equivale a una nueva ejecución de QA automatizado.

**Veredicto: listo para probar en el iPhone.** Ajuste local verificado; no se confirma aquí el comportamiento del Safari/PWA del dispositivo físico.

### Arreglados

- **[S3] Navbar demasiado elevada cuando el contenedor es más corto que el viewport.** La captura aportada muestra una separación excesiva. Una fixture geométrica local reproduce el anclaje incorrecto, no el fallo interno específico de iOS: al reducir el contenedor 59 px, el margen medido pasa de los 46 px solicitados a 76 px. El test falla en Chrome y WebKit antes del cambio y pasa en ambos después.
- `BottomNav.tsx`: anclaje `fixed` al viewport, en lugar de `absolute` al contenedor; margen real `env(safe-area-inset-bottom) + 8px`. Se conservan el estilo glass y los botones de 56 px.
- `WorkoutApp.tsx`: eliminado `h-full`, que competía con las unidades de viewport; añadido `min-h-0` al panel desplazable.
- `index.css`: el fallback `-webkit-fill-available` ahora se aplica únicamente al Safari antiguo sin soporte de `dvh`, evitando sobrescribir el tamaño moderno del viewport.

### Comprobaciones ejecutadas

- Antes: typecheck, lint, build y 31 pruebas unitarias/SQL correctos; 16 E2E existentes de Chrome/WebKit correctos y las dos ejecuciones de la nueva regresión fallidas, como se esperaba.
- Después: typecheck, lint, build y **31/31 pruebas unitarias/SQL** correctos; **25/25 E2E** correctos (9 Chrome local, 9 WebKit local, 7 nube simulada), incluidos los controles axe existentes.
- Nueva regresión: contenedor reducido, margen inferior sintético de 46 px, cambios de altura 852 → 740 → 852, scroll y tamaño táctil mínimo. Es una simulación de geometría, no una emulación de los insets físicos de un iPhone.
- Evidencia: [antes](qa-artifacts/navbar-before-results.json), [después](qa-artifacts/playwright-results.json), [captura WebKit](qa-artifacts/navbar-safe-area-webkit-production.png).
- `dist/` recompilado con la configuración pública existente. ZIP nuevo: `glow-netlify-navbar-2026-10-12-184939.zip`. No se cambiaron credenciales, datos de Supabase, dependencias, ni se hizo commit/push.

### Pendientes / límites

- Comprobar el nuevo despliegue en Safari y en la app instalada del iPhone. No se conoce la versión exacta de iOS de la captura ni se inspeccionó el Netlify desplegado.
- WebKit documenta [problemas de standalone con `viewport-fit=cover` y `-webkit-fill-available`](https://bugs.webkit.org/show_bug.cgi?id=237961). Es contexto de compatibilidad; no prueba que ese bug sea la causa exacta en este teléfono.
- No se repitió Lighthouse por este ajuste localizado de posición. Los resultados de rendimiento que siguen corresponden a la auditoría de optimización anterior.

Para repetir la regresión: `npm run test:e2e -- --grep "navbar pegada"`.

## Resumen de la auditoría de optimización anterior

- Typecheck, lint, build y revisión de espacios de Git: correctos. Git únicamente advierte sobre conversión de LF a CRLF en Windows.
- **31 pruebas de lógica, IndexedDB y SQL: 31 pasaron.**
- **23 E2E de producción: 23 pasaron**, 0 fallidas, 0 omitidas y 0 flaky en la corrida final: 8 Chrome local, 8 WebKit local y 7 Chrome con Supabase simulado.
- **10 auditorías axe:** login, Resumen, selector, ejercicios y modal, en Chrome y WebKit. Ninguna infracción automática WCAG 2 A/AA y 2.1 AA en esos estados.
- **Lighthouse móvil final:** rendimiento 99, accesibilidad 100, buenas prácticas 100, SEO 100. Las tres mediciones finales dieron las mismas puntuaciones.
- **npm audit: 0 vulnerabilidades** conocidas en el análisis ejecutado.
- El build final con la configuración local del proyecto quedó actualizado en `dist/`. No confundirlo con `dist-qa-local/` o `dist-qa-cloud/`, que son exclusivamente de prueba.

Evidencia principal: [resultados Playwright](qa-artifacts/playwright-results.json), [medianas Lighthouse](qa-artifacts/lighthouse-final-summary.json), [Lighthouse final HTML](qa-artifacts/lighthouse-final-1.report.html), [Lighthouse inicial HTML](qa-artifacts/lighthouse-before.report.html).

Los archivos de `qa-artifacts/` son evidencia local y están excluidos de Git; sus enlaces funcionan en este workspace, no en el repositorio remoto. Este informe conserva los resultados y la descripción de las pruebas sin incluir credenciales, builds ni capturas temporales.

## Rendimiento: antes y después

Lighthouse se ejecutó sobre el **login sin sesión** del build de nube simulada, servido en localhost, con configuración móvil y throttling simulado predeterminados. La línea base es una medición; el resultado final usa la mediana de tres mediciones con caché fría. No representa el rendimiento de Supabase real ni una puntuación Lighthouse de todas las pantallas privadas.

| Métrica | Inicial | Final |
| --- | ---: | ---: |
| Rendimiento Lighthouse | 74/100 | 99/100 |
| Primer contenido visible (FCP) | 2,94 s | 1,52 s |
| Contenido principal visible (LCP) | 5,03 s | 1,97 s |
| Bloqueo del hilo principal (TBT) | 67 ms | 0 ms |
| Saltos de diseño (CLS) | 0 | 0 |
| Speed Index | 4,44 s | 1,52 s |
| Transferencia observada en esa carga, incluido favicon | 692,8 KB | 168,7 KB |
| Chunk de entrenamiento, sin comprimir | 125,16 KB | 46,09 KB |
| Favicon | 522.737 bytes | 358 bytes |

El chunk de entrenamiento bajó aproximadamente **63 %**. El módulo de confites ahora pesa 10,57 KB adicionales y se descarga solo al celebrar. El JavaScript inicial de React/Supabase sigue en aproximadamente **430 KB sin comprimir / 124 KB gzip**: no se cambió la arquitectura de autenticación para reducirlo.

En una **fixture sintética local de 250 sesiones de la misma semana**, serializar la plantilla en cada sesión requería 2.007.001 bytes; separar la plantilla por semana y las sesiones requirió 51.188 bytes. Este resultado ilustra la reducción de duplicación, no una medición de tráfico de tu base real.

## Optimizaciones aplicadas

- Sora y Fira Code variables autoalojadas, con solo archivos Latin, `font-display: swap` y precarga de Sora. Se eliminó la dependencia bloqueante de Google Fonts y la fuente decorativa que ya no se utilizaba.
- Se retiró GSAP: transiciones CSS y contador con `requestAnimationFrame`, con cancelación y respeto por movimiento reducido. El aro de progreso conserva transición CSS.
- Confites mediante importación diferida; un fallo de ese efecto no interrumpe el progreso guardado.
- Favicon SVG ligero con el símbolo de la app. Se conservaron los archivos originales de iconos PWA.
- Se eliminó el filtro SVG de ruido de pantalla completa y se liberan las propiedades de las animaciones al terminar, para no mantener capas de composición innecesarias.
- El login reserva la altura del formulario mientras recupera la sesión, evitando el salto entre el cargador y el formulario.
- El historial lee las plantillas una vez por semana y pagina tanto semanas como sesiones. No repite el JSON de la rutina en cada sesión.
- El Resumen espera a que termine la carga/guardado antes de consultar el historial. No lo consulta durante los ejercicios. Un test comprueba las cantidades de solicitudes.
- El perfil existente no se descarta al volver al foco de la ventana; el progreso no queda bloqueado innecesariamente mientras se actualiza.
- Al cambiar rutina se conserva el Resumen y el selector; se animan las secciones de información, sin recrear toda la pantalla.
- Entrada de Vite explícita a `src/main.tsx`.

## Hallazgos confirmados y corregidos

### [S3] Contraste insuficiente en textos pequeños

- **Dónde:** enlaces del modo local, textos secundarios del Resumen, etiquetas de fases y detalles de ejercicios.
- **Reproducción:** ejecutar axe sobre Resumen o abrir Hip Thrust y ejecutar axe sobre los detalles.
- **Esperado / anterior:** contraste mínimo 4,5:1 para texto pequeño; se detectaron valores entre 3,25:1 y 4,44:1.
- **Corrección:** tonos de texto violeta y gris más legibles, sin cambiar los colores de fondo ni la identidad general.
- **Evidencia:** auditorías axe adjuntas en los resultados E2E; cero infracciones finales en ambas plataformas. Hallazgos previos guardados en [playwright-findings.json](qa-artifacts/playwright-findings.json).

### [S3] Selector sin navegación por flechas y pérdida de foco al seleccionar

- **Dónde:** selector de rutina del Resumen.
- **Reproducción:** enfocar el selector, presionar Flecha abajo, recorrer opciones y seleccionar con Enter.
- **Esperado / anterior:** abrir y recorrer la lista, y recuperar el foco en el selector; inicialmente las flechas no abrían la lista y recrear el Resumen eliminaba el elemento enfocado.
- **Corrección:** navegación por flechas, Home/End y Escape, restauración de foco y conservación del componente al cambiar de rutina.
- **Evidencia:** caso E2E «selector de rutina permite navegación con flechas y devuelve el foco», aprobado en Chrome y WebKit.

### [S3] El recorrido de teclado del modal no cerraba el ciclo de botones

- **Dónde:** confirmación de reinicio de la sesión.
- **Reproducción:** abrir el modal y usar Tab desde Cancelar hasta Reiniciar y nuevamente Tab.
- **Esperado / anterior:** mantener el foco dentro del modal; el ciclo podía salir al foco del navegador.
- **Corrección:** recorrido explícito entre los botones habilitados, también con Shift+Tab. Escape y cancelar conservan el progreso.
- **Evidencia:** caso del modal aprobado en Chrome y WebKit; [captura final](qa-artifacts/reset-local-production.png).

### [S4] Recursos y efectos innecesarios en la carga

- **Dónde:** fuentes externas, favicon JPG y animaciones con GSAP.
- **Esperado / anterior:** carga ligera; Lighthouse inicial dio 74 y señaló recursos bloqueantes, mientras el favicon descargaba más de 500 KB.
- **Corrección:** recursos autoalojados, favicon SVG, animación nativa y carga diferida de confites.
- **Evidencia:** comparación Lighthouse y tamaños del build.

## Línea base y estabilidad de las pruebas

La línea base pasó typecheck, lint, build y las 26 pruebas existentes de lógica/SQL. Fallaron 5 de los 6 E2E antiguos: esperaban ingresar directamente a los ejercicios, la pestaña Semana y una confirmación nativa del navegador. Esos contratos quedaron desactualizados por los cambios de interfaz anteriores; se adaptaron, sin retirar la cobertura de persistencia, calendario, login o reconexión.

Se agregaron regresiones de las funciones nuevas. La primera comprobación de teclado/contraste reprodujo los problemas antes de corregirlos.

Un E2E de contraseña incorrecta alcanzó el timeout total de 30 s en una corrida intermedia. **Pasó tres repeticiones aisladas** de aproximadamente 1,6 s y también la suite final. Las capturas ahora desactivan las animaciones mientras se toman, y el límite total por caso es 60 s para ambos motores; las aserciones funcionales conservan su espera normal de 5 s. El test de fallo transitorio del historial tiene 20 s porque la lectura incluye reintentos y un límite de red de 15 s.

La prueba de completar los ejercicios se hizo determinista esperando el cambio de estado entre clics. No se modificó la lógica de login por el timeout aislado.

## Qué se probó

- Login con contraseña correcta e incorrecta; mostrar/ocultar contraseña; protección de la pantalla de entrenamiento; cierre de sesión; recuperación de sesión tras recargar.
- Contraseña con espacios intactos y ausencia de esa contraseña en el almacenamiento persistente.
- Progreso por fecha, rutina y semana; cambio automático de fecha/semana; conservación de sesiones anteriores; separación de rutinas; ignorar marcas del prototipo previo.
- Ejercicios y series, cola de cambios offline, reconexión, clics rápidos y resolución explícita de conflictos.
- Resumen con historial de otra semana y marcas de hoy; duración estimada solo de sesiones completas; conteos por fechas distintas y actualización posterior al guardado.
- Nombre manual: normalización de espacios, actualización, fallback y texto malicioso renderizado como texto, sin ejecución.
- Modal: tamaño compacto, foco, Cancelar, Escape y reinicio limitado a la sesión actual.
- Celebración única al completar, sin repetición al reiniciar/recompletar o recargar; reclamación atómica de su marca entre accesos concurrentes.
- Historial paginado y sin duplicación de snapshots; error del historial visible, reintento y entrenamiento todavía utilizable.
- RLS y RPC en PostgreSQL embebido: lectura de datos propios, aislamiento entre cuentas, validación, consistencia de sesiones/series, revisiones y operaciones idempotentes. La columna de nombre también se probó con RLS.
- Accesibilidad automática, selector y modal con teclado, movimiento reducido y límites del viewport en móvil/desktop.
- Inspección visual de capturas de Resumen y modal. Ausencia de errores de página en el recorrido principal.
- Escaneo básico del build: solo variables públicas esperadas, clave publishable y ausencia del patrón de clave administrativa `sb_secret_`. `.env.local` sigue excluido de Git. Esto no sustituye una auditoría de seguridad completa.

Capturas: [Resumen Chrome](qa-artifacts/resumen-local-production.png), [Resumen WebKit](qa-artifacts/resumen-webkit-production.png), [historial simulado](qa-artifacts/resumen-cloud-historial.png), [320 px](qa-artifacts/responsive-320-local-production.png), [desktop](qa-artifacts/responsive-1440-local-production.png).

## Qué NO se probó y por qué

- **Supabase real y Netlify:** excluidos para evitar usar cuentas, datos y servicios reales en QA. Los E2E simulan el REST de Supabase; el SQL se verifica por separado. Falta comprobar la combinación con PostgREST/RLS desplegados y la recuperación entre dos dispositivos reales.
- **iPhone físico, Safari y PWA instalada:** WebKit en Windows no reproduce el hardware, la barra de Safari, el teclado ni los safe-area reales de iOS.
- **Rendimiento de pantallas autenticadas en Lighthouse:** la puntuación corresponde al login; Resumen y ejercicios sí están cubiertos funcionalmente y con axe.
- **Auditoría de seguridad exhaustiva, carga masiva, token expirado y validación real de JWT/SMTP:** fuera de esta ejecución. La autenticación se simula en E2E.
- **Acceso offline desde cero:** no se implementó un service worker; la prueba offline parte de una sesión y una rutina ya cargadas.
- **Lectores de pantalla físicos y evaluación humana completa de accesibilidad:** axe y teclado no cubren toda la experiencia.

## Tests agregados y cómo correrlos

- `tests/summary.test.ts`: fechas, semanas, minutos, paginación del historial y celebración persistente/concurrente.
- `tests/database.test.ts`: columna de nombre, administración e aislamiento RLS.
- `e2e/local.spec.ts`: Resumen/selector, separación de rutinas, modal, celebración, axe, tamaños de pantalla y teclado.
- `e2e/cloud.spec.ts`: nombre, XSS como texto, historial completo, conteo de solicitudes y fallo transitorio.
- `playwright.config.ts`: dos builds de producción aislados, Chrome/WebKit y resultados JSON.
- `scripts/lighthouse.mjs`: auditorías reproducibles, restringidas a localhost, informes y medianas.

```sh
npm run typecheck
npm run lint
npm run build
npm test
npx playwright install webkit
npm run test:e2e
```

Para Lighthouse, después del E2E, servir el build de prueba en una terminal:

```sh
npm run preview -- --outDir dist-qa-cloud --host 127.0.0.1 --port 5183 --strictPort
```

En otra terminal:

```sh
npm run audit:lighthouse -- after http://127.0.0.1:5183/ 3
```

## Pendientes y próximos pasos

1. Validar con tu cuenta real el saludo, las estadísticas, una marca por serie y la recuperación en otro dispositivo.
2. Revisar la versión publicada en un iPhone, con Safari y como app instalada, especialmente navbar, teclado y márgenes inferiores.
3. Como mejora futura, agregar CI para correr estas pruebas. No se creó un workflow sin tu aprobación.
4. El bundle inicial de React/Supabase y los iconos raster de instalación todavía ofrecen margen de optimización; no son bloqueantes según estas mediciones.

**No quedan fallos reproducibles abiertos dentro de la cobertura local ejecutada.** Las reservas anteriores son límites de validación, no resultados aprobados implícitamente.
