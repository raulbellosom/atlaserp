# Propuesta: Archivos como espacio de documentos y colaboración

Estado: diseño de referencia. La primera entrega está implementada en el workspace local: creación Office, paginación de servidor, permisos e invitaciones internas. Consulta el alcance efectivo y el despliegue en [Archivos](../../deployment/files-workspace.md). Las secciones siguientes conservan el diagnóstico y la propuesta originales; las ampliaciones futuras no se consideran implementadas.

## Punto de partida y pendientes

- El usuario ya confirmó apertura y guardado desde Atlas. El HTTP 502 observado al comienzo del despliegue es un antecedente, no un diagnóstico vigente del VPS. En la revisión del DOCX original, el CODE local respondió a conversiones PDF/PNG; no se volvió a comprobar el VPS.
- Office permite abrir, editar y coeditar archivos existentes mediante CODE/WOPI. Hay pruebas con dos identidades y CODE real usando fixtures de API/Storage, y pruebas PostgreSQL por separado. Falta aceptación con dos cuentas reales de Atlas, permisos de lectura/edición y aislamiento entre empresas en la instalación desplegada. No hay una bandera adicional de colaboración: las sesiones autorizadas del mismo archivo usan el mismo WOPISrc y diferentes identidades.
- El problema visual de la cotización se reprodujo directamente en CODE con el DOCX original, sin Atlas. Es un pendiente de compatibilidad de ese documento, documentado en [la validación Office](../../deployment/office-validation.md); no bloquea el diseño del explorador ni se corrige rediseñando Archivos.
- Confirmar que VPS tiene las imágenes/instalador actualizados y la migración Office aplicada. Publicación y despliegue no se pueden dar por realizados desde los cambios locales.
- Falta aceptación en dispositivos reales, PWA y Tauri; el build y la emulación no cubren esa aceptación.
- Hoy Archivos tiene carga múltiple, búsqueda/filtros, vistas tabla/tarjetas/cuadrícula, vista previa, renombrado, origen y descarga individual/ZIP. La carga ocupa una tarjeta grande por encima del explorador.
- La lista carga hasta 300 registros y filtra en cliente. El rediseño necesita búsqueda, filtros y paginación de servidor con autorización antes de paginar.
- `copyLink` en FilesScreen copia una URL firmada de Storage. No equivale a compartir un documento con permisos revocables en Atlas.
- No se encontraron entidades de carpetas ni de permisos individuales para FileAsset. Los permisos Office actuales vienen de empresa, rol y entidad de origen. Crear DOCX/XLSX/PPTX vacíos y administrar acceso por archivo son funciones nuevas.

## Intención y navegación

Superficie para usuarios internos de una empresa que buscan, crean y trabajan juntos sobre documentos. La experiencia debe transmitir orden y certeza sobre dónde se guarda y quién puede acceder. Acción principal: **Nuevo**. Acciones de contexto: abrir, compartir, descargar y ver detalles.

Mantener una única entrada **Archivos** en la navegación global. Incorporar vistas internas, con rutas/filtros conservados en la URL:

| Vista | Contenido | Dependencia |
|---|---|---|
| Todos | Archivos que el usuario puede consultar, con su origen visible | Paginación/autorización unificadas |
| Documentos | Archivos creados o subidos directamente en Archivos | Creación Office y filtro de origen |
| Compartidos conmigo | Documentos concedidos explícitamente al usuario | ACL por documento |
| Adjuntos del ERP | Archivos asociados a tareas, contactos, inventario y otros módulos | Permisos de origen |

«Documentos» no significa «privado»: mostrar el alcance de acceso real. No mostrar «Compartidos conmigo» hasta disponer de su backend. Recientes, favoritos, carpetas y papelera son ampliaciones posteriores: necesitan persistencia y reglas propias; no simularlos con el primer lote de archivos ni con el indicador `enabled`.

## Estructura visual

- `PageHeader`: título Archivos, contexto de empresa y botón principal **Nuevo**. «Subir archivos» como acción secundaria; conservar arrastrar y soltar con overlay y cola de progreso, liberando el espacio que ocupa la tarjeta de carga actual.
- Debajo: navegación interna, búsqueda y filtros compactos; lista por defecto y cuadrícula opcional para vistas previas.
- Cada fila: icono/formato, nombre, origen, última modificación y alcance de acceso. Acciones secundarias en menú contextual; acciones masivas aparecen al seleccionar.
- Panel lateral `Sheet`: vista previa, detalles útiles y acceso. Los identificadores técnicos se reservan para información avanzada.
- Editor a pantalla completa: conservar la cabecera compacta de 46px con logo pequeño, regreso, nombre y estado de guardado. Sin duplicar Guardar ni añadir una segunda fila. Incorporar Compartir cuando exista su backend, conservando la densidad. Colaboradores/cursor/presencia dentro del editor se apoyan en CODE; no inventar avatares conectados desde la lista de personas con permiso.
- En móvil: lista vertical, selector compacto de vistas, filtros en Sheet, detalle/editor ocupando la pantalla disponible. La navegación del módulo sigue dentro de Archivos.

Estética: densidad moderada, tipografía y colores semánticos existentes de Atlas, acento primario para Nuevo, superficies limpias con bordes suaves. Transiciones breves de panel/selección respetando reducción de movimiento; evitar paneles de estadísticas que desplacen los documentos. Componentes `@atlas/ui`: PageHeader, Button, DropdownMenu, Tabs, SearchInput, AtlasTable/DataTable, Sheet, Dialog, FileUploader, EmptyState, ErrorState, ConfirmDialog y campos de formulario existentes. Reutilizar los tokens del sistema, sin introducir un segundo tema.

## Crear documentos

El menú Nuevo ofrece **Documento (.docx)**, **Hoja de cálculo (.xlsx)**, **Presentación (.pptx)** y **Subir archivos**. «Carpeta» y «Desde plantilla» se agregan cuando existan sus funciones.

Flujo: elegir tipo → nombre inicial editable y acceso visible → crear → abrir en Office. Crear el FileAsset y sus bytes antes de abrir el editor; no generar una URL a un archivo inexistente. Usar plantillas OOXML mínimas válidas mantenidas por Atlas, probadas con CODE; no archivos de cero bytes ni cambiar solamente una extensión. Esto permite conservar el flujo WOPI existente sin depender de PutRelative, que aún no está implementado.

La operación del servidor verifica empresa/permisos, registra Storage/FileAsset/auditoría y devuelve el ID estable. Incorporar idempotencia para dobles clics/reintentos y reconciliación de objetos si falla la persistencia. Un documento recién creado pertenece a Archivos; los adjuntos creados desde otros módulos conservan su relación de origen.

Si el editor falla después de crear, el documento debe seguir disponible con acciones Reintentar abrir y Descargar. Si Office está desconectado, explicar la indisponibilidad de creación/edición y mantener la carga/descarga existentes.

## Compartir y permisos

Primera entrega: usuarios autenticados de la misma empresa. El diálogo **Compartir** muestra el acceso general, las personas con acceso y controles **Puede ver** / **Puede editar**. La gestión de acceso queda para el propietario o responsables autorizados, con una capacidad explícita distinta de editar contenido.

Para documentos propios de Archivos, proponer dos alcances: **Personas seleccionadas** y **Personas de la empresa con permiso**. Los nuevos documentos pueden ser restringidos por defecto solo cuando el backend implemente realmente ese alcance. Los archivos existentes conservan su acceso efectivo durante la migración; no convertirlos silenciosamente en privados o públicos.

Un rol de archivo debe respetar la pertenencia activa a la empresa y los límites de capacidades definidos por el administrador. No permitir que un usuario sin facultad de edición obtenga esa capacidad solo mediante un enlace. Definir explícitamente propietario, responsables, usuarios sin permiso del módulo y administradores antes de habilitar la función.

Para adjuntos del ERP, mostrar **Acceso heredado de [origen]** y un enlace a su administración. Una invitación al archivo no puede saltarse la pertenencia al proyecto ni los permisos del registro padre. El detalle de acceso heredado evita ofrecer controles que no tendrán efecto.

**Copiar enlace** copia una ruta estable de Atlas, exige autenticación y vuelve a comprobar autorización. No copia tokens WOPI ni una URL firmada de Storage. La misma política debe cubrir listado, detalle, previews, descargas/ZIP, URLs firmadas y cada solicitud WOPI; proteger solo el editor dejaría vías alternativas de acceso. La revocación bloquea nuevas solicitudes y guardados; no puede retirar copias ya descargadas ni bytes ya cargados en un cliente.

Compartición pública, invitados externos, caducidad de enlaces y rol exclusivo de comentarios se diseñan después. No ofrecer estas opciones hasta verificar su implementación y sus límites de revocación.

## Estados y aceptación

| Región | Carga / vacío | Error / parcial | Permisos / éxito |
|---|---|---|---|
| Explorador | Skeleton; vacío con Nuevo/Subir | Reintento conservando búsqueda; paginación real | Solo filas autorizadas; selección por ID |
| Creación | Estado Creando, sin doble envío | Mensaje recuperable; reabrir si el archivo ya se creó | Nombre y acceso confirmados; ID único |
| Compartir | Cargar acceso efectivo | Mostrar fallo sin afirmar que se concedió/revocó | Acceso heredado explicado; confirmación persistida |
| Editor | Apertura con contexto del documento | CODE caído, sesión vencida, conflicto o guardado pendiente | Lectura/edición real; guardado confirmado antes de salir |
| Detalle | Skeleton y vista previa | Vista previa no disponible con descarga permitida | Origen y acceso coherentes con el servidor |

## Orden de entrega

1. Completar la aceptación del Office actual en Atlas real: reabrir, lector/editor, segunda persona y otra empresa. El usuario confirmó el guardado; la coedición tiene evidencia con fixtures. Estas comprobaciones pueden avanzar junto con el rediseño y no requieren resolver primero la maquetación de la cotización.
2. Rediseñar la estructura de Archivos y añadir creación de documentos con el alcance actual claramente indicado. Cambiar Copiar enlace a una ruta autenticada de Atlas. Corregir la paginación y separar FilesScreen en componentes de responsabilidad acotada.
3. Implementar permisos por documento, política común de acceso, migración compatible y diálogo Compartir. Activar entonces la vista Compartidos conmigo y el alcance restringido para documentos nuevos.
4. Añadir carpetas, favoritos, actividad/historial visible y plantillas según uso. Las revisiones internas de recuperación existentes no equivalen todavía a una pantalla de historial/restauración.

La propuesta amplía el núcleo de archivos y la integración del frontend existente; no es únicamente un cambio cosmético ni un módulo AME3 custom independiente. Requiere imágenes nuevas de API/web y migraciones para los modelos de permisos que se definan.
