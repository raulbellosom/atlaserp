# Calendar Grid Overflow Design

**Goal:** Mantener estables las cuadrículas de `agenda`, `semana` y `día` en `atlas.calendar`, recortando texto dentro de los eventos y resolviendo overflow con `+N más` hacia el panel derecho.

**Context**
- `WeekView` y `DayView` renderizan eventos en flujo normal dentro de celdas horarias con altura mínima, no fija.
- Cuando el ancho visible baja por la combinación de sidebars y el texto del evento, las celdas se perciben desacomodadas y pierden legibilidad.
- `CalendarRightSidebar` hoy muestra únicamente el resumen del día seleccionado; no tiene contexto de bloque horario.

**User-Approved Constraints**
- Priorizar cuadrícula estable sobre mostrar texto completo.
- Recortar texto del evento en una sola línea.
- Cuando no quepan todos los eventos visibles en una celda, mostrar `+N más`.
- `+N más` debe usar el panel derecho, no un modal flotante.

**Design**

## 1. WeekView
- Fijar altura de cada fila horaria para impedir crecimiento por contenido.
- Limitar cada intersección `día/hora` a dos chips compactos visibles.
- Renderizar un botón `+N más` cuando existan eventos ocultos.
- El botón debe seleccionar fecha y hora, y abrir/actualizar el panel derecho con el bloque correspondiente.

## 2. DayView
- Fijar altura de cada bloque horario.
- Limitar cada hora a dos eventos visibles.
- Mantener el patrón `+N más` idéntico al de `WeekView`.
- Como la hora ya está visible en el eje izquierdo, el chip del evento no necesita repetirla en modo compacto.

## 3. AgendaView
- Mantener el layout tipo lista.
- Hacer consistente el truncado de título y metadatos para evitar bloques visualmente pesados.
- No usar `+N más` aquí; la vista agenda ya es un contenedor vertical natural.

## 4. EventChip
- Introducir un modo compacto de una sola línea real.
- En modo compacto, ocultar iconografía secundaria y hora redundante para maximizar ancho útil del título.
- Mantener `title` HTML para inspección rápida del nombre completo.

## 5. Panel derecho
- Extender el estado del calendario para soportar foco opcional por bloque horario.
- Cuando exista foco horario, el panel derecho debe:
  - Mostrar la fecha seleccionada.
  - Mostrar una etiqueta secundaria del rango horario, por ejemplo `12:00 - 12:59`.
  - Listar los eventos de ese bloque, incluyendo los que quedaron resumidos con `+N más`.
- Cuando no exista foco horario, conservar el comportamiento actual del resumen diario.

## 6. Estado compartido
- El store del calendario debe permitir:
  - Seleccionar fecha normal.
  - Seleccionar fecha + hora para foco de overflow.
  - Abrir el panel derecho al elegir `+N más`.
- Navegación entre días/semanas debe limpiar el foco horario para no arrastrar contexto inválido.

**Implementation Scope**
- `apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx`
- `apps/desktop/src/modules/atlas.calendar/components/DayView.jsx`
- `apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx`
- `apps/desktop/src/modules/atlas.calendar/components/EventChip.jsx`
- `apps/desktop/src/modules/atlas.calendar/components/CalendarRightSidebar.jsx`
- `apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js`
- Nuevos helpers puros en `apps/desktop/src/modules/atlas.calendar/lib/`
- Pruebas unitarias de la lógica de overflow y selección

**Risks**
- Si el número de eventos por hora es alto, `+N más` será frecuente; eso es aceptable porque preserva legibilidad.
- Cambios al store persistido deben ser compatibles con usuarios que ya tengan preferencias guardadas.

**Verification**
- Pruebas unitarias para helper de overflow.
- Revisión manual de:
  - `semana` con títulos largos
  - `día` con múltiples eventos en la misma hora
  - `agenda` con títulos largos
  - `+N más` sincronizando el panel derecho

**Notes**
- No se incluye reposicionamiento temporal tipo Google Calendar; eso sería un rediseño mayor fuera de alcance.
- No se hace commit automático del spec porque esta sesión no recibió instrucción explícita para crear commits.
