# Selector de fecha/hora universal y unificación del bottom-sheet mobile

Date: 2026-08-25
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-25-mobile-datetime-picker-bottomsheet-unification-design.md
Plan file: docs/superpowers/plans/2026-08-25-mobile-datetime-picker-bottomsheet-unification.md (created after spec approval)

---

## 1. Feature title

Selector de fecha/hora universal y unificación del bottom-sheet mobile

## 2. Status

Draft

## 3. Context

Atlas ERP usa `@atlas/ui` como design system compartido (política UI-first, obligatoria por `CLAUDE.md`). Dos piezas de ese sistema se comportan de forma inconsistente en producción, reportado por el usuario con capturas de pantalla reales en distintos dispositivos:

1. El modal "Nuevo evento" de `atlas.calendar` (`EventFormModal.jsx`) usa `DateTimeField`, que renderiza `<input type="datetime-local">` nativo. El tamaño y layout de ese control lo decide el motor del navegador/SO (Safari iOS vs Chrome Android), y en varias combinaciones el input se desborda de su contenedor.
2. Existen dos implementaciones independientes del patrón "modal que se convierte en bottom-sheet en mobile": `Dialog.jsx` y `Sheet.jsx` (`packages/ui/src/components/`). Ambas ya comparten el hook `useDragToDismiss`, pero cada una define su propio `useIsMobile`, su propio padding y su propio margen para el "handle" (la barra de arrastre superior), calculados por separado. Hoy dan un resultado numéricamente parecido, pero al no compartir código pueden desalinearse en cualquier cambio futuro, y visualmente ya se perciben distintas entre pantallas que usan cada una.

`DatePickerField` (mismo paquete) ya resuelve el problema 1 correctamente para fecha-sin-hora: es un calendario propio renderizado en un `Popover`, no depende del input nativo del SO. Pero no cubre selección de hora, y `EventFormModal` no lo usa.

## 4. Problem

- Los campos `DateField` y `DateTimeField` de `@atlas/ui` (`packages/ui/src/components/FormFields.jsx`) dependen de `<input type="date">` / `<input type="datetime-local">` nativos, cuyo tamaño de render varía por navegador/SO y se desborda de su contenedor en mobile, rompiendo el layout de formularios como "Nuevo evento".
- `Dialog.jsx` y `Sheet.jsx` reimplementan por separado la geometría del bottom-sheet mobile (detección de mobile, padding, handle, safe-area), sin una fuente de verdad única, generando inconsistencia visual entre modales que deberían verse y comportarse igual.

## 5. Goals

1. Ningún componente de `@atlas/ui` usa `<input type="date">` ni `<input type="datetime-local">` nativo; `DateField`, `DateTimeField` y `DatePickerField` comparten un mismo motor de selector de fecha/hora propio, construido con el design system (glass, tokens de color, tema claro/oscuro).
2. El selector de hora no abre el teclado nativo del dispositivo en ningún punto de la interacción.
3. `Dialog.jsx` y `Sheet.jsx` comparten una única fuente de verdad para la geometría del bottom-sheet mobile (detección de mobile, handle, padding, safe-area, animación) — ambos se ven y se comportan idénticos en su variante mobile.
4. El selector de fecha/hora usa esa misma geometría de bottom-sheet unificada cuando se abre en mobile, y el `Popover` existente cuando se abre en desktop.
5. Ningún archivo consumidor de `DateField`/`DateTimeField` (5 archivos, 15 usos) requiere cambios — el contrato público (`value`, `onChange(e)` con `e.target.value`, `label`, `error`, `hint`, `required`, `validate`, `onBlur`, `icon`) se preserva exactamente.
6. `DatePickerField` mantiene su contrato público actual (`value`, `onChange(value)`, `compact`) y su comportamiento visual actual en desktop.

## 6. Non-goals

1. No se toca el contrato de datos ni la validación de ningún formulario que use estos campos (ej. `EventFormModal`, `HrEmployeeForm`, `PosOrdersScreen`) más allá del componente interno.
2. No se migra `react-hook-form`/`Controller` a estos campos — ninguno de los 5 consumidores actuales lo usa hoy (todos son `value`/`onChange` controlados), así que no aplica.
3. No se añade modo `compact` a `DateField`/`DateTimeField` — hoy nada lo requiere (solo `DatePickerField` lo usa, y se conserva tal cual).
4. No se implementa selección de rango de fechas (date range picker) — cada campo sigue seleccionando una sola fecha/hora.
5. No se construye avoidance de teclado nativo basada en `visualViewport` para los demás campos de texto dentro de un bottom-sheet (ej. "Título" en "Nuevo evento") — el `max-h-[85dvh]` existente ya se apoya en unidades `dvh`, que en navegadores mobile modernos ya contemplan el teclado. Se deja como verificación manual (Sección 26); si en la verificación se detecta un problema real, se documenta como hallazgo para un spec de seguimiento, no se resuelve especulativamente aquí.
6. No se cambian los breakpoints de responsive (`768px`) usados hoy por `Sheet.jsx`.
7. No se toca ningún módulo AME3 ni tabla de negocio — este spec es 100% interno a `packages/ui`.

## 7. User stories

- Como usuario de `atlas.calendar` en un teléfono, quiero que los campos "Inicio" y "Fin" del modal "Nuevo evento" se vean completos dentro de su contenedor, sin que el control nativo del navegador desborde el layout.
- Como usuario en mobile, quiero seleccionar hora tocando y deslizando ruedas, sin que se abra el teclado del sistema y me tape el formulario.
- Como usuario, quiero que todos los modales que se abren como hoja inferior (bottom sheet) en mobile se vean y se sientan exactamente igual (misma barra de arrastre, mismo padding, mismo gesto de cerrar deslizando).

## 8. UX requirements

- Todo texto de UI en español (etiquetas, placeholders, botones), sin emojis.
- **Desktop (≥768px):** `DateField`, `DateTimeField` y `DatePickerField` abren un `Popover` anclado al trigger, igual que `DatePickerField` hoy. `DateTimeField` muestra el calendario y, debajo o al costado (según ancho disponible), el `TimeWheel`.
- **Mobile (<768px):** los tres abren el `Sheet` (`side="bottom"`) unificado, con el mismo handle/drag-to-dismiss que el resto de la app. Dentro, el calendario ocupa el ancho completo.
  - `DateField`/`DatePickerField` (solo fecha, un único control): tocar un día aplica el valor y cierra el sheet inmediatamente — mismo comportamiento que `DatePickerField` tiene hoy en su `Popover` de desktop (`selectDay` llama `onChange` + `onClose`). No hay botón "Aceptar".
  - `DateTimeField` (fecha + hora, dos controles): tocar un día actualiza la fecha pero **no cierra** el sheet, porque falta confirmar la hora; se agrega un botón "Aceptar" (`Button` de `@atlas/ui`) al final del sheet que aplica el valor combinado y cierra. Cerrar por gesto/backdrop sin tocar "Aceptar" descarta los cambios de esa sesión de apertura y conserva el valor previo del formulario (igual que cancelar).
- **Formato de valor de `DateField`:** string `YYYY-MM-DD`, igual que el `<input type="date">` que reemplaza.
- **Formato de valor de `DateTimeField`:** string `YYYY-MM-DDTHH:mm`, igual que el `<input type="datetime-local">` que reemplaza (así `toLocalDatetime`/`buildDefaultForm` en `EventFormModal.jsx` no requieren cambios).
- **Formato de visualización (trigger cerrado):** `DateField` reutiliza `formatDisplay` de `DatePickerField.jsx` ("13 de agosto, 2026" vía `date-fns` + locale `es`, o el formato corto "13 ago 2026" ya usado). `DateTimeField` usa el mismo formato de fecha + hora en formato `h:mm a` en español (ej. "13 ago 2026, 9:00 a.m."), igual a lo que el input nativo mostraba en las capturas del usuario.
- **`TimeWheel`:** tres columnas con scroll-snap (hora 1–12, minutos en pasos de 5, a.m./p.m.), con la fila central resaltada (fondo `primary`/opacidad, igual tratamiento visual que el día seleccionado en `Calendar`). Soporta scroll por touch/rueda de mouse y flechas de teclado (accesibilidad) — nunca dispara un `<input>` de texto ni el teclado del sistema.
- **Bottom-sheet unificado:** una sola definición de handle (barra gris, `bg-foreground/25`, `h-1.5 w-16`), un solo cálculo de padding/safe-area, una sola curva de animación (`cubic-bezier(0.32, 0.72, 0, 1)`, 280ms), reutilizada por `Dialog.jsx` (variante mobile) y `Sheet.jsx` (`side="bottom"` / lados forzados a bottom en mobile). Se adopta la geometría que hoy usa `Sheet.jsx` (padding `p-6`, handle con `-mt-1 mb-3`) como canónica, por preferencia explícita del usuario.
- **Estados:** vacío → placeholder ("Seleccionar fecha" / "Seleccionar fecha y hora"); error → borde rojo + mensaje bajo el campo (igual que hoy, vía `FieldWrapper`); disabled → trigger no clickeable, opacidad reducida (ya existente en `fieldCls`/botón compact).
- Tema claro y oscuro: los tres selectores deben verse correctos en ambos (usar solo tokens `hsl(var(--...))`/clases `glass-*` existentes, nunca colores hardcodeados).

## 9. Routes/screens

N/A — no se agregan ni modifican rutas ni pantallas. Cambio interno a componentes compartidos de `@atlas/ui`, consumidos sin cambios por pantallas existentes:

| Pantalla (existente, sin cambios de código) | Módulo | Componente afectado |
|---|---|---|
| Perfil (`ProfileScreen.jsx`) | app core | `DateField` |
| Nuevo evento (`EventFormModal.jsx`) | atlas.calendar | `DateTimeField`, `DatePickerField` |
| Formulario de artículo (`InventoryItemForm.jsx`) | atlas.inventory | `DateField`, `DateTimeField` |
| Campos personalizados (`InventoryCustomFieldsForm.jsx`) | atlas.inventory | `DateField` |
| Pedidos POS (`PosOrdersScreen.jsx`) | atlas.pos | `DateField` |
| Ficha de empleado (`HrEmployeeForm.jsx`) y otros 6 archivos | atlas.hr, atlas.projects, atlas.identity, atlas.ledger, atlas.growth | `DatePickerField` |

## 10. Data model

N/A — no hay entidades de negocio ni persistencia involucradas. Este spec cambia componentes de presentación en `packages/ui/src`.

### New models

N/A

### Modified models

N/A

## 11. Prisma impact

New models: N/A
Modified models: N/A
New migration required: No
Migration safety notes: N/A

## 12. API contract

N/A — no hay endpoints HTTP nuevos ni modificados.

## 13. SDK contract

N/A — no hay cambios en `@atlas/sdk`.

## 14. Validator contract

N/A — no hay cambios en `@atlas/validators`. Las validaciones de campo (`validate`, `required`) siguen siendo responsabilidad del formulario consumidor, igual que hoy.

## 15. Module manifest impact

N/A — no es un módulo AME3, es un cambio en `packages/ui` (paquete compartido, no un manifest de módulo).

## 16. Navigation impact

N/A — no se agrega navegación.

## 17. Blueprint impact

N/A

## 18. RBAC/permissions

N/A — no se declaran permisos nuevos; el cambio es puramente de presentación y no introduce ninguna superficie de datos nueva.

## 19. Multi-company behavior

N/A — los componentes no acceden a datos de red ni conocen la empresa activa; solo formatean/emiten valores de fecha-hora que el formulario consumidor ya maneja.

## 20. Files/storage impact

N/A

## 21. Export/import requirements

N/A

## 22. Audit log requirements

N/A — no hay acciones de negocio nuevas que auditar.

## 23. Edge cases

1. **Valor vacío/`undefined`/`null`:** el trigger muestra el placeholder; el calendario abre en el mes actual (no en enero de 1970).
2. **Valor con fecha inválida** (string no parseable): se trata igual que vacío — no debe lanzar excepción (reutilizar el guard `isNaN(d.getTime())` ya existente en `parseDate`).
3. **`DateTimeField` con solo fecha y sin hora en el valor inicial** (compatibilidad con datos legacy): asumir `00:00` si falta la parte de hora, igual que el comportamiento del input nativo.
4. **Cambio de mes al límite del año** (diciembre→enero, enero→diciembre): ya cubierto por la lógica existente de `prevMonth`/`nextMonth` en `Calendar`, reutilizada sin cambios.
5. **Resize de mobile a desktop con el selector abierto** (ej. rotar el dispositivo o redimensionar la ventana de desarrollo): el selector debe cerrarse o re-renderizarse en el modo correcto sin quedar en un estado visual roto — igual comportamiento que `Sheet.jsx` ya maneja hoy vía `useIsMobile` con `matchMedia` reactivo.
6. **`icon` prop en `DateField`** (usado en `ProfileScreen.jsx` y `HrEmployeeForm.jsx` vía `DatePickerField`'s `label` con `IL`): debe seguir renderizando el ícono como prefijo del trigger, igual que hoy.
7. **`disabled` prop:** el trigger no debe abrir el `Popover`/`Sheet` ni responder a click/touch.
8. **Confirmar sin tocar el `TimeWheel`** (usuario solo cambia el día): debe conservar la hora previamente seleccionada, no resetearla a 00:00.
9. **Backdrop/click afuera en `DatePickerField` sin seleccionar nada:** cierra sin cambiar el valor (comportamiento ya existente, se preserva).

## 24. Risks

1. Riesgo: cambiar el motor interno de `DateField`/`DateTimeField` podría romper silenciosamente algún consumidor si asume comportamiento específico del `<input>` nativo (ej. `min`/`max`, `step`, eventos de teclado nativos, autofill del navegador). Mitigación: se listaron y revisaron los 5 archivos consumidores antes de este spec (Sección 9); ninguno usa `min`/`max`/`step`/eventos de teclado. Si el plan de implementación encuentra un uso no detectado, se detiene y se actualiza este spec antes de continuar (regla de SDD).
2. Riesgo: unificar `Dialog.jsx`/`Sheet.jsx` es un cambio en un componente compartido de muy alto uso (decenas de pantallas) — un error de CSS podría romper visualmente muchos modales a la vez. Mitigación: el refactor extrae la geometría existente de `Sheet.jsx` (que el usuario ya prefiere) sin inventar valores nuevos, y se hace verificación visual manual en 390px/1440px, tema claro/oscuro, sobre al menos un modal de cada tipo (`Dialog` centrado desktop, `Dialog` bottom-sheet mobile, `Sheet` lateral desktop, `Sheet` bottom-sheet mobile) antes de darlo por terminado.
3. Riesgo: el `TimeWheel` con scroll-snap puede comportarse de forma distinta entre motores de navegador (Safari/WebKit vs Chromium) en cuanto a inercia/snap. Mitigación: usar únicamente CSS estándar (`scroll-snap-type`, `scroll-snap-align`) sin dependencias de gestos custom más allá de lo que ya usa `useDragToDismiss`; verificar manualmente en al menos un dispositivo/emulación iOS y uno Android durante la Sección 26.
4. Riesgo: archivos que ya están cerca del límite de 1000 líneas (`FormFields.jsx` no está en la lista de infractores conocidos, pero `DatePickerField.jsx` crecerá con `TimeWheel` y el motor compartido). Mitigación: extraer `TimeWheel` y el motor compartido (shell popover/sheet) a archivos propios (`TimeWheel.jsx`, `date-picker-shared.jsx`) en vez de inflar `DatePickerField.jsx`.

## 25. Acceptance criteria

1. Given el modal "Nuevo evento" abierto en un viewport de 390px de ancho, when se enfoca el campo "Inicio", then el selector de fecha/hora se abre como bottom-sheet unificado y ningún elemento se desborda horizontalmente del viewport.
2. Given cualquier campo `DateField`, `DateTimeField` o `DatePickerField` en cualquier tema (claro/oscuro), when se renderiza, then no existe ningún `<input type="date">` ni `<input type="datetime-local">` en el DOM.
3. Given el `TimeWheel` abierto en mobile, when el usuario interactúa con las tres columnas, then el teclado virtual del dispositivo nunca se activa.
4. Given un modal `Dialog` y un modal `Sheet` abiertos por separado en el mismo viewport mobile, when se comparan visualmente, then el handle, el padding superior/inferior, el radio de esquina y la animación de apertura son idénticos.
5. Given uno de los 5 archivos consumidores de `DateField`/`DateTimeField` (`ProfileScreen.jsx`, `EventFormModal.jsx`, `InventoryItemForm.jsx`, `InventoryCustomFieldsForm.jsx`, `PosOrdersScreen.jsx`), when se revisa su diff tras la implementación, then el archivo no tiene cambios (0 líneas modificadas) salvo que la Sección 24-Riesgo-1 haya forzado una actualización documentada.
6. Given `EventFormModal.jsx` con un evento existente (`isEdit=true`), when se abre para editar, then `startAt`/`endAt` se muestran preseleccionados correctamente en el nuevo `DateTimeField` (mismo formato `YYYY-MM-DDTHH:mm` que produce `toLocalDatetime`).
7. Given `pnpm build`, when se ejecuta tras la implementación, then compila sin errores en `packages/ui` ni en `apps/desktop`.

## 26. Verification plan

- `pnpm build` — sin errores de build en `packages/ui` y `apps/desktop`.
- `pnpm lint` — sin nuevos errores de lint en los archivos tocados.
- `node --check` sobre cualquier archivo `.js` nuevo bajo `packages/ui/src` (los `.jsx` se verifican vía build, no `node --check`).
- `pnpm dev:frontend` levantado; verificación manual con DevTools responsive:
  - 390px de ancho, tema oscuro y claro: abrir "Nuevo evento" (`atlas.calendar`), tocar "Inicio" y "Fin", confirmar que el bottom-sheet no desborda y el `TimeWheel` no abre el teclado.
  - 1440px de ancho: mismos campos, confirmar que el `Popover` se ve correctamente anclado y sin overflow.
  - Comparar visualmente (390px) un `Dialog` bottom-sheet (ej. "Nuevo evento") contra un `Sheet` bottom-sheet (ej. `MobileFiltersSheet` en cualquier listado) — deben verse idénticos en handle/padding/animación.
  - `DatePickerField` en `HrEmployeeForm.jsx` (fecha de ingreso/baja): confirmar que sigue funcionando igual que antes (regresión).
  - `DateField` con `icon` en `ProfileScreen.jsx`: confirmar que el ícono se sigue mostrando.
- Checklist de 14 aspectos UI (`docs/ai-context/ui-screen-audit-checklist.md`) sobre el modal "Nuevo evento" en mobile, dado que es la pantalla que originó el reporte.

## 27. Rollback plan

No hay migraciones de base de datos ni cambios de infraestructura — el rollback es un `git revert` del commit(s) de este cambio en `packages/ui`. No requiere pasos adicionales porque no hay estado persistente ni flags de feature involucrados. Si se detecta una regresión visual aislada a un componente, también es válido revertir solo ese archivo (`Dialog.jsx`, `Sheet.jsx`, `FormFields.jsx`, o el nuevo `date-picker-shared.jsx`) de forma independiente, dado que el diseño mantiene contratos públicos estables entre ellos.

## 28. Future enhancements

1. Selección de rango de fechas (date range picker) reutilizando el mismo `Calendar`.
2. Modo `compact` para `DateField`/`DateTimeField` (igual al que ya tiene `DatePickerField`) si algún futuro caso de uso lo requiere (ej. edición inline en tabla).
3. `visualViewport`-based keyboard avoidance genérico para cualquier bottom-sheet con campos de texto, si la verificación manual (Sección 26) revela un problema real con el teclado nativo sobre otros campos (no de fecha/hora) dentro del sheet.
4. Extraer `TimeWheel` como export público de `@atlas/ui` si algún módulo necesita un selector de hora sin fecha asociada.
