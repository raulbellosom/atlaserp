# Revisión de notificaciones — 6 de septiembre de 2026

## Hallazgos comprobados en la base configurada

Diagnóstico de solo lectura, sin enviar mensajes ni modificar preferencias.

- Hay una invitación a proyecto del 3 de septiembre todavía sin leer. Tiene 10 notificaciones posteriores: quedaba fuera de los 10 elementos visibles de la campana. Su empresa coincide con la que usa la bandeja.
- Esa invitación tiene push marcado como enviado y correo fallido. El estado enviado del proveedor no demuestra que el dispositivo lo haya mostrado.
- Los 6 fallos históricos de correo corresponden a descifrado de credenciales. La configuración SMTP existe, pero el proceso con el `.env` actual no puede descifrarla.
- Hay 15 suscripciones push activas y 112 entregas push registradas como enviadas. De 6 fallos históricos de push, 3 no tenían suscripción activa, 1 corresponde a suscripción/VAPID y 2 requieren diagnóstico adicional.
- Hay 226 entregas in-app históricas con estado `queued`. El worker solo procesa correo y push; la bandeja lee directamente `notification`. Ese estado no significaba que la notificación no estuviese disponible.

## Cobertura corregida

| Módulo | Eventos revisados | Resultado |
| --- | --- | --- |
| Proyectos | Alta de miembros | Se espera la publicación antes de responder. Tres canales por defecto sin preferencias guardadas. |
| Proyectos | Asignación de tareas | Aviso también al crear la tarea, cambiar su responsable y actualizar en bloque. |
| Proyectos | Comentarios y menciones | Menciones con prioridad sobre comentarios para evitar dos avisos al mismo usuario. Dedupe por comentario para no perder comentarios distintos. Se incluye al responsable principal. |
| Proyectos | Cambio de estado | Aviso también al mover entre columnas y actualizar en bloque. |
| Proyectos | Reacciones | Consulta `entityComment`, reemplazando el modelo antiguo. |
| Proyectos | Próximo vencimiento | Incluye al responsable principal aunque no tenga fila en `project_task_assignee`. Un aviso por destinatario, tarea y día. |
| Chat | Alta en canales/grupos | Se publica al crear la conversación con miembros iniciales y al agregar miembros después. No avisa al creador ni repite altas de miembros activos. Permite reincorporar miembros que habían salido. |
| Chat | Mensajes, menciones y respuestas en hilos | Soporte de los tres canales y enlaces a la conversación. Errores de publicación quedan registrados. |
| Notas | Compartir una nota | Además del broadcast de datos, crea la notificación persistente y sus entregas. Usa una empresa compartida por los participantes y el enlace `?note=`. |
| Inventario | Menciones y reacciones | Dedupe por comentario, publicación esperada y reacciones desde comentarios genéricos. |
| Calendario | Invitaciones, reprogramaciones, cancelaciones, recordatorios | Los productores ya existían con los tres canales. Se completan los controles de preferencias que faltaban. |
| Growth / captación web | Lead nuevo/asignado | Se añade push a los canales admitidos y controles en ajustes. |
| Ledger | Cuenta/grupo compartido y acceso retirado | Se añaden correo/push opcionales, controles y enlaces a los recursos o membresías. |
| Finanzas personales | Presupuesto cerca del límite/excedido | Se añaden correo/push opcionales y controles en ajustes. |

Las menciones añadidas al **editar** un comentario/mensaje no se incorporan en esta revisión; los avisos de menciones cubiertos corresponden a su creación. Tampoco se han añadido eventos nuevos de negocio para todos los cambios CRUD de otros módulos.

## Preferencias y bandeja

Los valores iniciales se comparten entre API y frontend mediante `getDefaultNotificationPreference` de `@atlas/core`.

Por decisión del usuario, in-app, correo y push están activos por defecto para altas a proyectos/chats, notas compartidas, asignaciones de tareas y menciones en proyectos/chat/inventario. Las preferencias guardadas siempre prevalecen. Las llamadas conservan push por defecto. El resto conserva correo y push opcionales.

La publicación respeta `muteUntil`, evita broadcasts cuando in-app está desactivado y no crea filas si todos los canales quedan deshabilitados. La bandeja excluye notificaciones destinadas exclusivamente a canales externos, conservando los registros antiguos sin entregas. Las nuevas entregas in-app se registran como `sent` al persistir.

La campana prioriza pendientes y utiliza el total de no leídos de la API, no un recuento limitado a la primera página. La paginación usa el último elemento entregado como cursor, evitando saltarse el primer aviso de la página siguiente.

## Validación y operación pendiente

- 564 pruebas Node aprobadas: proyectos, chat, notas, calendario, Growth, Ledger, presupuestos, publicación, entrega push y captación web.
- Prueba integrada con transportes simulados: evento → persistencia in-app → cola → worker de correo/push.
- Build web aprobado. No se han realizado envíos SMTP/push reales como parte de las pruebas.
- Diagnóstico reproducible: `node --env-file=.env scripts/diagnose-notifications.mjs`. No imprime contraseñas, destinatarios ni cuerpos de mensajes.
- Para habilitar el correo real es necesario volver a guardar la contraseña SMTP desde configuración con las claves del servidor en uso, o restaurar la clave original correcta. No se ha sobrescrito la configuración ni reencolado correo histórico.
- Los cambios son de core: requieren desplegar API, worker y web actualizados. `POST /modules/sync` no despliega estas modificaciones. No se ha realizado despliegue en esta sesión.
- La recepción final en una PWA necesita permiso del navegador, una suscripción válida y una comprobación en el dispositivo. Una prueba con transporte simulado no verifica eso.
