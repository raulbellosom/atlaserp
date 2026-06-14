# Consistencia de iconos e identidad PWA por módulo

**Fecha:** 2026-06-14  
**Alcance:** iconos PWA por módulo, cambio de identidad durante instalación y comportamiento de sesión en iOS

## Objetivo

Las PWAs instaladas por módulo deben usar el mismo recurso visual que Atlas ERP muestra para ese módulo. Al cambiar de módulo, el navegador debe recibir desde la carga inicial el manifest correspondiente, evitando reutilizar el nombre o icono de una instalación anterior.

## Causa identificada

El frontend de Atlas resuelve la imagen del módulo con esta prioridad:

1. `manifest.logoUrl`
2. Icono Lucide indicado en `manifest.icon`
3. Iniciales generadas

El generador PWA actual solo usa `manifest.icon`. Por ello, `atlas.calendar`, que dentro de Atlas usa `/module-logos/atlas-calendar-128.svg`, se instala con un icono Lucide distinto. `atlas.projects` coincide porque no depende de un logo personalizado.

El cambio dinámico del enlace `rel="manifest"` dentro de React tampoco garantiza que iOS o Chrome vuelvan a calcular inmediatamente la identidad instalable. El navegador puede conservar temporalmente el nombre e icono del manifest anterior.

## Diseño

### Fuente visual compartida

Los logos oficiales de módulos se almacenarán en una ubicación compartida que pueda ser incluida tanto en la imagen del API como en la compilación del frontend.

El frontend seguirá exponiendo los logos bajo `/module-logos/` para no modificar las URLs públicas existentes. El API resolverá el mismo recurso mediante `manifest.logoUrl`.

### Resolución del icono PWA

El generador de iconos aplicará la misma prioridad visual que Atlas:

1. Si existe un `logoUrl` local permitido, leer y convertir ese recurso.
2. En ausencia de logo, renderizar el icono Lucide de `manifest.icon` sobre el color del módulo.
3. Si ninguna opción es válida, responder `404`, conservando la validación estricta de instalaciones nuevas.

Solo se aceptarán rutas internas bajo el catálogo compartido de logos. No se descargarán URLs remotas ni se permitirán rutas arbitrarias del sistema.

Los recursos SVG, PNG y WebP se convertirán con `sharp` a PNG de 192 y 512 píxeles. El contenido del logo formará parte del hash de identidad para que cambios visuales generen URLs versionadas y nuevos `ETag`.

### Cambio de módulo instalable

Antes de iniciar la instalación de un módulo diferente al manifest cargado inicialmente, la aplicación hará una navegación documental completa hacia la URL profunda del módulo con una marca temporal de intención de instalación.

El script temprano de `index.html` seleccionará el manifest correcto antes de iniciar React. Una vez cargado, el controlador solicitará la instalación únicamente si la identidad capturada coincide con el módulo actual. La marca temporal se retirará de la URL después de consumirse.

Esto evita depender exclusivamente de cambiar el manifest durante navegación SPA, comportamiento que los navegadores no procesan de forma consistente.

### Sesiones en iOS

Las PWAs instaladas por separado en la pantalla de inicio de iOS mantienen contenedores de almacenamiento independientes. Por tanto, cada módulo instalado puede requerir autenticación propia aunque comparta origen.

Este cambio no intentará sincronizar credenciales entre instalaciones. Resolverlo requeriría un flujo SSO explícito mediante códigos de un solo uso o cambiar el producto a una única PWA Atlas con accesos internos a módulos.

Windows y navegadores que compartan almacenamiento por origen continuarán reutilizando la sesión existente.

## Compatibilidad

- Los módulos con `logoUrl` usarán el mismo logo que Atlas.
- Los módulos que solo declaren `icon` conservarán la generación Lucide actual.
- Las URLs públicas `/module-logos/*` no cambiarán.
- Los manifests e iconos conservarán sus rutas y contratos HTTP actuales.
- No se modificarán tablas ni el esquema de base de datos.

## Pruebas

- Calendario genera PNG desde `atlas-calendar-128.svg`.
- Proyectos continúa generando su icono Lucide actual.
- Un cambio en el contenido del logo modifica el hash del icono.
- Rutas de logo externas o fuera del catálogo son rechazadas.
- La instalación desde un módulo distinto provoca una carga documental con su identidad.
- Un prompt capturado para otro módulo no puede reutilizarse.
- La URL temporal de instalación se limpia después de procesarse.
- Las pruebas existentes de manifest, dimensiones, MIME y `ETag` permanecen verdes.

## Criterios de aceptación

1. Calendario muestra en la PWA el mismo icono utilizado dentro de Atlas ERP.
2. Proyectos mantiene su icono actual.
3. Al pasar de Calendario a Proyectos, o viceversa, la instalación presenta el nombre e icono del módulo actual.
4. El comportamiento de sesión separada en iOS queda documentado como limitación de plataforma.
5. Los módulos futuros reutilizan automáticamente `logoUrl` sin configuración PWA duplicada.
