# Plantillas de documentos nuevos

`blank.docx`, `blank.xlsx` y `blank.pptx` son documentos vacíos válidos exportados por Collabora CODE desde paquetes ODF mínimos creados para Atlas. No contienen datos de usuarios ni proceden de la cotización usada para diagnosticar compatibilidad.

La API copia sus bytes a un objeto privado independiente por creación. No cambia únicamente la extensión de un archivo ni abre archivos de cero bytes. DOCX contiene un párrafo vacío; XLSX una hoja vacía; PPTX una diapositiva vacía.

Para sustituir una plantilla, crea un documento vacío del formato correspondiente con CODE, descárgalo, revisa que no tenga contenido, macros, enlaces externos ni metadatos personales y ejecuta `apps/api/src/services/__tests__/files-workspace.test.js`. El test valida la estructura OOXML y el tipo de contenido de los tres formatos. Comprueba además la apertura de cada formato en la versión CODE del despliegue antes de publicarlo.
