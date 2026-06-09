# Google Calendar Sync Design

Fecha: 2026-06-07
Estado: Fase 3A implementada; Fase 3B pendiente
Alcance: `atlas.calendar`

## 1. Objetivo

Integrar Google Calendar en `atlas.calendar` para que cada usuario de Atlas pueda conectar una sola cuenta de Google, seleccionar calendarios de Google y sincronizar sus eventos hacia Atlas sin duplicados.

La V1 sera de solo lectura desde Google hacia Atlas a nivel de origen, pero los eventos importados se copiaran a eventos normales de Atlas. Si un usuario edita o mueve un evento importado dentro de Atlas, ese evento quedara desacoplado de Google y dejara de recibir actualizaciones remotas.

## 1.1 Estado actual

Hoy Atlas ya soporta:

- configuracion OAuth por instancia
- una cuenta Google por usuario Atlas
- descubrimiento de calendarios Google
- seleccion persistente de calendarios Google
- creacion inmediata de un calendario interno Atlas por cada calendario Google seleccionado
- desconexion de Google deshabilitando los origenes sincronizados sin borrar los calendarios Atlas creados

Todavia no soporta:

- importacion de eventos
- sincronizacion incremental por `syncToken`
- `GoogleCalendarEventLink`
- resincronizacion completa o manual

## 2. Objetivos funcionales

- Permitir una cuenta Google por usuario Atlas.
- Permitir seleccionar uno o varios calendarios Google.
- Crear automaticamente un calendario interno Atlas por cada calendario Google seleccionado.
- Importar historial completo en la primera sincronizacion.
- Ejecutar sincronizacion incremental automatica y manual.
- Evitar duplicados aunque el mismo evento ya se haya importado antes.
- Preservar historial cuando un evento se elimine o cancele en Google.
- Desacoplar eventos al primer cambio local en Atlas.

## 3. Fuera de alcance V1

- Sincronizacion bidireccional Atlas -> Google.
- Multiples cuentas Google por usuario.
- Webhooks `watch` de Google Calendar.
- Edicion remota de calendarios Google desde Atlas.
- Resolucion manual de conflictos complejos.
- Compartir automaticamente en Google los permisos internos de Atlas.

## 4. Principios de diseno

- La integracion debe ser portable a cualquier instancia self-hosted de Atlas.
- La configuracion OAuth de Google sera por instancia, no global del producto.
- La conexion de usuarios a Google sera por UI, pero las credenciales de la aplicacion Google se definiran por variables de entorno.
- El calendario base `atlas.calendar` debe seguir funcionando aunque Google no este configurado.
- El modelo de sincronizacion debe ser incremental, idempotente y tolerante a reintentos.

## 5. Modelo de despliegue

### 5.1 Configuracion de instancia

Cada instalacion de Atlas necesitara su propia aplicacion OAuth de Google o una aplicacion gestionada por el operador de esa instancia. La configuracion se hara por variables de entorno:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_ENCRYPTION_KEY`
- `GOOGLE_CALENDAR_SYNC_INTERVAL_MINUTES` (opcional)

`GOOGLE_OAUTH_REDIRECT_URI` debe ser una URL de navegador que reciba `code` y `state` de Google y luego los entregue al callback autenticado de Atlas. No debe asumirse que Google llamara directamente a un endpoint API con sesion Atlas activa.

### 5.2 Comportamiento sin configuracion

Si las variables no existen:

- `atlas.calendar` sigue operativo para calendarios nativos.
- La integracion Google se muestra como no configurada.
- No se ofrecen acciones de conexion Google para usuarios finales.

### 5.3 Entornos

El mismo patron aplica en:

- desarrollo local con `.env`
- despliegue con `docker compose`
- despliegue con secretos del host o plataforma

## 6. Modelo funcional

### 6.1 Cuenta Google por usuario

Cada usuario Atlas podra conectar una sola cuenta Google. Esa cuenta sera la unica fuente de calendarios Google para ese usuario.

### 6.2 Calendarios Google seleccionados

Cuando el usuario seleccione calendarios Google:

- Atlas crea un calendario interno por cada calendario Google seleccionado.
- cada calendario interno queda vinculado a un calendario Google de origen
- el calendario interno se marca como sincronizado con Google
- si el mismo calendario Google se vuelve a seleccionar, Atlas reutiliza el mismo calendario interno
- si un calendario antes seleccionado se omite del payload mas reciente, el origen se deshabilita

### 6.3 Eventos importados

Los eventos importados:

- se almacenan como eventos normales en `calendar_event`
- conservan una vinculacion tecnica con Google
- pueden verse en el calendario Atlas como cualquier otro evento
- muestran una marca visual de origen Google

### 6.4 Desacople local

Si el usuario edita un evento importado o lo mueve a otro calendario Atlas:

- el evento queda desacoplado
- la sincronizacion remota deja de actualizarlo
- el evento sigue existiendo como evento Atlas normal

## 7. Reglas de sincronizacion

### 7.1 Primera sincronizacion

Al conectar la cuenta y seleccionar calendarios:

- Fase 3A: se crea el origen `GoogleCalendarSource` y el calendario Atlas interno
- Fase 3B: se importara el historial completo de cada calendario seleccionado
- Fase 3B: se paginara hasta consumir todos los eventos del calendario
- Fase 3B: se almacenara un `syncToken` por calendario Google

### 7.2 Sincronizacion incremental

Posteriormente:

- cada calendario Google sincronizado usa su propio `syncToken`
- la sincronizacion se ejecuta por job automatico
- la sincronizacion puede ejecutarse manualmente con `Sincronizar ahora`
- solo se procesan cambios desde la ultima sincronizacion valida

### 7.3 Errores de token incremental

Si Google responde `410 Gone`:

- el origen se marca como `needs_resync`
- se invalida el `syncToken`
- se agenda una resincronizacion completa de ese calendario
- la resincronizacion afecta solo al calendario origen involucrado

### 7.4 Reintentos

Si Google responde `429` o `5xx`:

- se aplican reintentos con backoff exponencial
- no se pierde el estado del origen
- si el problema persiste, el origen queda en `error`

### 7.5 Revocacion o reconexion

Si falla el refresh token o Google revoca acceso:

- la conexion del usuario pasa a `requires_reconnect`
- la sync automatica se detiene para ese usuario
- la UI debe pedir reconectar la cuenta

## 8. Reglas de identidad y deduplicacion

### 8.1 Eventos simples

Un evento simple se identifica por:

- calendario Google de origen
- `googleEventId`

### 8.2 Eventos recurrentes e instancias

Para eventos recurrentes y sus instancias se almacenan tambien:

- `googleICalUID`
- `googleRecurringEventId`
- `googleOriginalStartAt`

La identidad tecnica recomendada para una ocurrencia es:

- `googleRecurringEventId + googleOriginalStartAt`

### 8.3 Regla de importacion idempotente

Durante sync:

- si no existe link, se crea evento Atlas y su link
- si existe link y sigue acoplado, se actualiza el mismo evento Atlas
- si existe link y esta desacoplado, se ignoran cambios remotos para ese evento

Esto evita duplicados aunque Google reenvie cambios o una sync se repita.

## 9. Reglas de desacople

Un evento pasa a desacoplado cuando ocurre cualquiera de estos casos:

- cambio local del titulo, descripcion, fecha, ubicacion u otros campos editables
- cambio de calendario Atlas
- cualquier accion local que deba preservar la version Atlas sobre la remota

Al desacoplar:

- `isDetached = true`
- `detachedAt = now()`
- el vinculo historico con Google se conserva
- el sync deja de modificar ese evento

No existira reatachado automatico en V1.

## 10. Regla para eventos eliminados o cancelados en Google

Si Google indica que un evento acoplado fue eliminado o cancelado:

- Atlas no borra el evento local
- Atlas lo marca como `eliminado_en_google`
- el evento deja de mostrarse como evento activo normal
- el evento sigue disponible en detalle e historial

Para instancias canceladas de recurrentes, se conserva la referencia tecnica necesaria para mantener consistencia del historial.

## 11. Modelo de datos propuesto

### 11.1 Nueva entidad: conexion Google por usuario

`GoogleCalendarConnection`

- `id`
- `userId` unico
- `googleSubject`
- `googleEmail`
- `accessTokenEncrypted`
- `refreshTokenEncrypted`
- `tokenExpiresAt`
- `scopes`
- `connectedAt`
- `lastSyncAt`
- `revokedAt`
- `status`

### 11.2 Nueva entidad: origen de calendario Google

`GoogleCalendarSource`

- `id`
- `connectionId`
- `googleCalendarId`
- `googleCalendarName`
- `googleCalendarTimeZone`
- `atlasCalendarId`
- `syncToken`
- `lastFullSyncAt`
- `lastIncrementalSyncAt`
- `syncStatus`
- `lastErrorAt`
- `lastErrorMessage`
- `enabled`

### 11.3 Nueva entidad: link evento Google -> evento Atlas

`GoogleCalendarEventLink`

- `id`
- `sourceId`
- `atlasEventId`
- `googleEventId`
- `googleICalUID`
- `googleRecurringEventId`
- `googleOriginalStartAt`
- `googleUpdatedAt`
- `googleStatus`
- `isDetached`
- `detachedAt`
- `cancelledInGoogleAt`
- `lastSeenAt`
- `rawSnapshot`

### 11.4 Justificacion

En la Fase 3A, `GoogleCalendarSource` ya es la pieza canonica para representar la seleccion del usuario. Cada source:

- identifica el calendario Google origen por `connectionId + googleCalendarId`
- apunta al calendario interno Atlas ya creado
- queda listo para que Fase 3B agregue `syncToken`, importacion inicial e incremental

Se propone un modelo separado del `CalendarEvent` base porque:

- evita contaminar el modelo central con detalles especificos de Google
- permite mantener eventos Atlas existentes sin romper compatibilidad
- soporta desacople sin perder trazabilidad
- soporta recurrentes, cancelaciones y resincronizaciones de forma limpia

## 12. Mapeo funcional hacia el calendario actual

### 12.1 Impacto sobre calendarios

El servicio actual crea y lista calendarios propios en `apps/api/src/routes/calendar/calendar-service.js`. La integracion debe extender esa capa para:

- exponer calendarios sincronizados junto con calendarios nativos
- marcar visualmente origen y estado de sync
- impedir borrar accidentalmente metadatos de origen sin antes desconectar

### 12.2 Impacto sobre eventos

El servicio actual de eventos en `apps/api/src/routes/calendar/calendar-event-service.js` debe extenderse para:

- identificar si un evento tiene link Google
- desacoplar al primer cambio local
- filtrar o etiquetar eventos `eliminado_en_google`
- mantener comportamiento actual para eventos nativos

## 13. API propuesta

### 13.1 Estado y configuracion

- `GET /calendar/google/status`
  - estado de configuracion de instancia
  - estado de conexion del usuario

### 13.2 OAuth

- `POST /calendar/google/connect/start`
  - genera URL OAuth
- `GET /calendar/google/connect/callback`
  - endpoint API autenticado por bearer token
  - recibe `code` desde una ruta/browser callback intermedia
  - intercambia tokens
  - guarda credenciales cifradas

### 13.3 Seleccion de calendarios origen

- `GET /calendar/google/calendars`
  - lista calendarios Google disponibles para la cuenta conectada
- `POST /calendar/google/sources`
  - recibe calendarios seleccionados
  - crea un `CalendarCalendar` interno por cada uno
  - ejecuta primera sync o agenda primera sync

### 13.4 Sincronizacion

- `POST /calendar/google/sync`
  - sincronizacion manual del usuario actual
- `POST /calendar/google/disconnect`
  - desconecta cuenta Google del usuario
- `PATCH /calendar/google/sources/:id`
  - habilita o deshabilita un calendario sincronizado

## 14. UX propuesta

### 14.1 Estado administrativo de instancia

La aplicacion mostrara un bloque administrativo de estado:

- Google Calendar no configurado
- Google Calendar configurado
- redirect URI esperada
- validacion de credenciales

No se propondran formularios de captura de `client_secret` para usuarios finales.

### 14.2 Flujo del usuario

1. Abrir `atlas.calendar`
2. Ver CTA `Conectar Google`
3. Autorizar cuenta Google
4. La ruta de navegador configurada recibe `code` y `state` y llama al callback API autenticado
5. Ver lista de calendarios Google disponibles
6. Seleccionar calendarios a importar
7. Confirmar creacion de calendarios internos
8. Ejecutar primera sync

Ruta recomendada de navegador para V1:

- local: `/app/google/calendar/callback`
- produccion: `/app/google/calendar/callback`

### 14.3 Estados visibles

Por conexion u origen:

- `Sincronizado`
- `Sincronizando`
- `Error`
- `Reconexion requerida`
- `Requiere resincronizacion`

### 14.4 Eventos importados

Los eventos importados mostraran:

- badge `Google`
- origen del calendario
- aviso previo al editar o mover: `Este cambio desacoplara el evento de Google`

## 15. Seguridad

- Los secretos OAuth viven solo en env de instancia.
- Los tokens de usuario se guardan cifrados en base de datos.
- No se exponen secretos en frontend.
- Los scopes V1 seran de solo lectura.
- Se aplicara el principio de minimo privilegio.

## 16. Scopes OAuth propuestos

Para V1:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

`openid` y `email` se incluyen para identificar de forma estable la cuenta Google conectada y persistir `googleSubject` y `googleEmail` sin depender de inferencias fragiles.

La solicitud OAuth usara:

- `access_type=offline`
- `include_granted_scopes=true`
- `prompt=consent`

## 17. Comportamiento del job automatico

- Corre cada `GOOGLE_CALENDAR_SYNC_INTERVAL_MINUTES` o default del sistema.
- Procesa conexiones activas.
- Recorre cada `GoogleCalendarSource` activo.
- Renueva access token si hace falta.
- Ejecuta sync incremental con paginacion.
- Actualiza estados de sync y marcas de error.

## 18. Observabilidad y soporte

Se requiere registrar:

- inicio y fin de sync por usuario y calendario
- cantidad de eventos creados, actualizados, cancelados, ignorados y desacoplados
- errores OAuth
- errores `410`
- latencia y reintentos

Esto ayudara a soporte en instalaciones self-hosted.

## 19. Testing requerido

### 19.1 Backend

- OAuth callback y persistencia cifrada
- creacion automatica de calendarios internos
- primera sync con historial completo
- sync incremental sin duplicados
- desacople al primer cambio local
- cancelaciones Google -> `eliminado_en_google`
- manejo de `410 Gone`
- manejo de paginacion y reintentos
- recurrentes e instancias canceladas

### 19.2 Frontend

- estados de conexion
- seleccion de calendarios Google
- badges y advertencia de desacople
- accion `Sincronizar ahora`

### 19.3 Smoke test de despliegue

- instancia limpia con solo `.env`
- configuracion OAuth valida
- conexion de un usuario
- importacion de un calendario
- re-sync incremental posterior

## 20. Riesgos y mitigaciones

### 20.1 Recurrentes

Riesgo:

- Google maneja recurrencias con mayor riqueza que el modelo Atlas actual.

Mitigacion:

- guardar metadata externa suficiente
- cubrir instancias canceladas en el link
- limitar transformaciones agresivas en V1

### 20.2 Tokens invalidos

Riesgo:

- revocacion o expiracion de refresh token

Mitigacion:

- estado `requires_reconnect`
- reconexion explicita por usuario

### 20.3 Full sync costosa

Riesgo:

- historial completo puede ser pesado en cuentas grandes

Mitigacion:

- procesamiento paginado
- ejecucion asincrona
- estado visible de progreso

## 21. Decisiones tomadas

- V1 solo Google -> Atlas
- una cuenta Google por usuario
- un calendario Atlas por calendario Google seleccionado
- historial completo en primera sync
- sync automatica + manual
- eventos editados localmente se desacoplan
- eventos eliminados en Google se preservan como historial local
- credenciales OAuth por env de instancia

## 22. Criterios de aceptacion

- Una instancia nueva puede habilitar Google Calendar solo con variables de entorno validas.
- Un usuario puede conectar su cuenta Google y seleccionar calendarios.
- Atlas crea calendarios internos automaticamente.
- La primera sync importa historial completo sin duplicados.
- La sync incremental actualiza solo cambios posteriores.
- Un cambio local desacopla el evento y evita sobreescritura futura.
- Un evento eliminado en Google se preserva con estado local de eliminado en Google.
- Si la integracion no esta configurada, `atlas.calendar` sigue funcionando normalmente.

## 23. Referencias

- Google OAuth web server apps  
  https://developers.google.com/identity/protocols/oauth2/web-server
- Google Calendar incremental sync  
  https://developers.google.com/workspace/calendar/api/guides/sync
- Google Calendar errors  
  https://developers.google.com/workspace/calendar/api/guides/errors
- Google Calendar events reference  
  https://developers.google.com/calendar/api/v3/reference/events
- Google Calendar recurring events  
  https://developers.google.com/workspace/calendar/api/guides/recurringevents
- Google Calendar auth scopes  
  https://developers.google.com/workspace/calendar/api/auth
