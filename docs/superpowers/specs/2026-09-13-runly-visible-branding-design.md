# Runly — marca visible

Date: 2026-09-13
Status: Complete
Autorización: el usuario pidió continuar con la siguiente etapa de marca visible después de la entrega de distribución.

## 1. Feature title

Runly ERP en textos del producto, comunicaciones, documentos y nombres de aplicaciones.

## 2. Status

Complete para la implementación local verificada. Publicación, sincronización de metadatos persistidos y builds nativos quedan pendientes.

## 3. Context

GitHub e imágenes ya apuntan a Runly. Las pantallas, metadatos y comunicaciones todavía muestran Atlas.

## 4. Problem

Los usuarios reciben nombres diferentes del mismo producto según la pantalla, plataforma o documento.

## 5. Goals

Mostrar Runly ERP/Runly en la marca propia de pantallas, notificaciones, correos, PDFs, Excel, manifiestos web y nombres visibles nativos. Preservar personalización y compatibilidad.

## 6. Non-goals

Assets, paleta, URLs de producción, paquetes, símbolos, cabeceras, claves de módulos, roles, almacenamiento o identificadores nativos. No reemplazar contenido de usuarios ni migrar bases de datos. No publicar ni desplegar.

## 7. User stories

Como usuario quiero reconocer Runly en toda la interfaz y sus comunicaciones sin perder mis preferencias o mi empresa.

## 8. UX requirements

Reusar componentes, layouts y estilos actuales. Cambiar solo textos de marca y atributos accesibles. Conservar nombres personalizados y el nombre MeridIAn/Meridian. Las imágenes actuales pueden seguir mostrando Atlas hasta la entrega de assets.

## 9. Routes/screens

Mismas rutas: login, setup, shell, ajustes, módulos y diagnóstico/recuperación nativos. Nombres de módulos técnicos siguen siendo `atlas.*`.

## 10. Data model

N/A: no cambia el esquema. Los defaults de código pasan a Runly. Los nombres de instancia/empresa ya guardados se respetan.

## 11. Prisma impact

Sin migraciones ni schema changes. El seed solo cambia la etiqueta del rol oficial `atlas.admin`; su clave y permisos siguen iguales. No ejecutar seed contra bases existentes en esta etapa.

## 12. API contract

Mismas rutas y respuestas. Textos y fallbacks propios pasan a Runly. El ETag del manifiesto PWA se calcula sobre el cuerpo emitido para invalidar el nombre anterior; id, scope, start_url e iconos mantienen su identidad.

## 13. SDK contract

Conservar exports y cabeceras `X-Atlas-*`. Cambiar únicamente el texto genérico de error de API.

## 14. Validator contract

N/A: mismas validaciones.

## 15. Module manifest impact

Solo nombre/shortName de Runly Core y descripciones/etiquetas oficiales. Claves, permisos, rutas, dependencias, iconos y colores iguales. Los metadatos persistidos se actualizarán al publicar y sincronizar; no realizar sincronización remota en esta entrega local.

## 16. Navigation impact

Mismas entradas y rutas; encabezados propios muestran Runly.

## 17. Blueprint impact

N/A: misma estructura y claves de blueprints.

## 18. RBAC/permissions

Solo etiquetas de presentación. Mantener `atlas.admin`, `system.admin`, guardas, cabeceras y comparaciones por clave.

## 19. Multi-company behavior

Los nombres de empresas/instancias mantienen prioridad. No reemplazar coincidencias dentro de datos proporcionados por usuarios.

## 20. Files/storage impact

Mismos paths, buckets y binarios de logos. El generador del manifiesto se actualiza en fuente sin regenerar imágenes. La salida de PDF/Excel cambia únicamente en la marca predeterminada.

## 21. Export/import requirements

Marca Runly en pies de PDF y metadatos Excel predeterminados. Conservar el nombre de la empresa como autor cuando esté disponible.

## 22. Audit log requirements

N/A: sin acciones nuevas ni cambios en registros existentes.

## 23. Edge cases

PWA con ETag antiguo debe recibir el cuerpo Runly, luego revalidar normalmente. Mantener globals `window.AtlasERP`, paths de assets, themes nativos y enlaces `atlas://`. Las pruebas con empresas/bancos llamados Atlas son datos de usuario y se conservan.

## 24. Risks

Reemplazo indiscriminado rompería contratos: limitar cambios a textos humanos y revisar cada diff. Valores guardados y logos antiguos pueden seguir mostrando Atlas hasta las etapas correspondientes. El nombre nativo nuevo requiere reconstrucción del binario; applicationId no cambia.

## 25. Acceptance criteria

Marca textual propia Runly en las superficies inventariadas; fallbacks nuevos sin sobreescribir personalización; assets e identidades intactos; manifiesto actualizado para clientes con caché anterior; pruebas y build web pasan.

## 26. Verification plan

Pruebas PWA/ETag, correos, branding PDF/Excel, notificaciones, invitaciones y manifiestos; build Vite; lint de archivos afectados y React Doctor; revisión de cambios de texto y contratos técnicos. Sin pruebas contra usuarios o bases reales.

## 27. Rollback plan

Revertir solo el diff de esta etapa conservando la entrega anterior. No requiere rollback de datos. Publicar de nuevo los builds anteriores si la etapa ya se hubiera desplegado.

## 28. Future enhancements

Paquetes/variables y SDK, metadatos persistidos, identidad/offline nativos, dominio, publicación y assets/paleta según el roadmap general.
