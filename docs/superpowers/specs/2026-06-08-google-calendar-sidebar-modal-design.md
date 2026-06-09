# Google Calendar Sidebar Modal Design

Fecha: 2026-06-08
Estado: Propuesto
Alcance: `apps/desktop/src/modules/atlas.calendar`

## Objetivo

Rediseñar la entrada de Google Calendar en el sidebar de `atlas.calendar` para que deje de verse como una card pesada dentro del panel lateral y pase a ser un acceso compacto que abre un modal único para toda la integración.

## Problema actual

- La card actual compite visualmente con el mini calendario y con la lista de calendarios.
- El sidebar es angosto y no favorece bloques con demasiado texto.
- El flujo está partido entre el bloque del sidebar y el diálogo de selección de calendarios.
- La integración se percibe más como promoción visual que como herramienta operativa.

## Decisión principal

Se adopta un patrón de:

- **trigger compacto en el sidebar**
- **modal único para toda la integración Google**

El trigger del sidebar solo comunica:

- que existe la integración
- si está conectada o no
- una acción primaria corta: `Conectar` o `Administrar`

Todo lo demás vive dentro del modal:

- explicación de qué hace la integración
- conexión OAuth
- estado de cuenta conectada
- selección de calendarios Google
- estado de importación por source
- acción de desconectar

## Diseño del sidebar

### Contenido

Debajo de la sección `Integraciones` se mostrará una pieza compacta con:

- logo/ícono de Google
- título `Google Calendar`
- estado breve:
  - `Sin conectar`
  - `Conectada`
  - `Importando`
  - `Error`
- botón principal:
  - `Conectar` cuando no existe conexión
  - `Administrar` cuando ya existe conexión

### Reglas visuales

- Debe ocupar una sola unidad visual compacta.
- Debe verse como item operativo del sidebar, no como tarjeta promocional.
- Debe evitar párrafos largos.
- El botón debe ser corto y claro.
- El estado debe leerse de un vistazo.

## Diseño del modal

### Estructura

El modal unificado de Google Calendar contendrá cuatro zonas:

1. **Resumen de conexión**
   - cuenta conectada o mensaje de cuenta no conectada
   - badge de estado general

2. **Qué hace esta integración**
   - explica de forma breve:
     - conecta una cuenta Google
     - permite elegir calendarios Google
     - crea calendarios internos Atlas por cada calendario seleccionado
     - importa eventos en segundo plano
     - permite desacoplar eventos al editarlos localmente

3. **Calendarios Google**
   - lista de calendarios disponibles
   - selección persistente
   - indicador de si ya está vinculado
   - estado por source:
     - `Pendiente`
     - `Sincronizando`
     - `Sincronizado`
     - `Error`

4. **Acciones**
   - `Conectar con Google` cuando no hay conexión
   - `Guardar selección` cuando ya hay conexión
   - `Desconectar cuenta` como acción secundaria

## Flujo

### Sin conexión

1. El usuario ve el trigger compacto.
2. Hace clic en `Conectar`.
3. Se abre el modal.
4. El modal explica la integración.
5. El usuario dispara OAuth con `Conectar con Google`.

### Con conexión activa

1. El usuario ve el trigger con estado `Conectada`, `Importando` o `Error`.
2. Hace clic en `Administrar`.
3. Se abre el modal.
4. Puede:
   - revisar la cuenta conectada
   - ajustar selección de calendarios
   - revisar estados de importación
   - desconectar la cuenta

## Reutilización de componentes

- `GoogleCalendarConnectionCard.jsx` deja de comportarse como card informativa grande y pasa a ser trigger compacto.
- `GoogleCalendarCalendarPickerDialog.jsx` deja de ser solo picker y pasa a ser el modal maestro de Google Calendar, o se simplifica hacia ese rol.
- Los hooks actuales se conservan:
  - `useGoogleCalendarStatus`
  - `useGoogleCalendarList`
  - `useGoogleCalendarSources`
  - `useSaveGoogleCalendarSources`
  - `useDisconnectGoogleCalendar`
  - `useStartGoogleCalendarConnect`

## Restricciones

- No se cambia el flujo backend.
- No se agregan endpoints.
- No se altera el modelo de importación existente.
- El cambio es de composición y experiencia UI.

## Criterios de éxito

- El sidebar se ve más limpio y menos cargado.
- Google Calendar se percibe como integración secundaria pero accesible.
- El usuario entiende mejor qué hace la conexión antes de usarla.
- Todo el flujo de Google puede hacerse desde un solo modal.
- Desconectar la cuenta y administrar calendarios deja de depender de dos superficies separadas.

## Riesgos

- Si el modal acumula demasiado contenido, puede crecer demasiado.
- Si el trigger del sidebar queda demasiado minimalista, puede perder descubribilidad.

## Mitigación

- Mantener el copy del modal corto.
- Priorizar acciones y estados sobre texto descriptivo.
- Usar badges compactos y bloques visuales pequeños.

