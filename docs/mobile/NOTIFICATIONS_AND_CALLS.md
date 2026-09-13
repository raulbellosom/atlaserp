# Notificaciones y llamadas por plataforma

Atlas conserva su servidor, reglas de destinatarios, permisos por empresa, preferencias, historial y cola de entregas. El transporte hasta el sistema operativo es una pieza adicional, no un reemplazo de Atlas ni de Supabase/LiveKit.

| Modo | Avisos fuera de la interfaz | Llamada entrante con la app en segundo plano |
| --- | --- | --- |
| Web / PWA | Web Push existente, VAPID y service worker | Notificación que permite abrir Atlas; su presentación depende del navegador/SO |
| Desktop Tauri | Notificación nativa mientras el proceso sigue ejecutándose | Realtime + aviso nativo; no se garantiza recepción con el proceso cerrado |
| Android APK actual | Notificaciones locales recibidas desde Realtime mientras la app ejecuta código | Falta recepción FCM y presentación nativa de llamada |
| iOS nativo futuro | APNs; FCM podría usarse como intermediario para avisos ordinarios | PushKit sobre APNs + CallKit para VoIP; no implementado |

Una PWA instalada en iOS utiliza Web Push y tiene condiciones de instalación/permisos del navegador. No adquiere CallKit por estar instalada. No prometer que el navegador puede mostrar siempre una pantalla de llamada equivalente a una app nativa.

Para Android, el alcance restante es concreto: configurar un proyecto FCM para el identificador del APK; registrar/renovar y desvincular tokens por instalación y usuario; enviar desde la cola de Atlas; recibir en un FirebaseMessagingService; mostrar una notificación CallStyle con aceptar/rechazar; caducar/cancelar invitaciones terminadas o contestadas en otro dispositivo; integrar el ciclo de llamada y el servicio en primer plano para continuidad de audio. La pantalla completa depende de permisos y restricciones del sistema. Aceptar POST_NOTIFICATIONS no implementa ninguno de esos transportes. Las credenciales de servidor permanecen fuera de Git y del APK. El usuario ya creó el proyecto Firebase. La preparación de credenciales y variables está documentada en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md); la integración FCM sigue pendiente.

LiveKit sigue transportando audio/video una vez conectada la llamada. El push comunica la invitación; no lleva el audio/video. Deben probarse separadamente recibir una llamada en segundo plano y mantener una llamada iniciada al minimizar/bloquear.

## Correcciones verificadas — 2026-09-13

- Eliminada la desactivación y selección de endpoints por user-agent: distintos teléfonos/PWA pueden compartir ese texto. Cada endpoint habilitado recibe su entrega; la unicidad del endpoint evita duplicar registros idénticos. Las bajas explícitas y fallos permanentes siguen retirando endpoints.
- La web vuelve a sincronizar su suscripción al recuperar red/foco y periódicamente mientras está visible, sin llamadas concurrentes y con límite de una preparación por minuto. Esto también permite reactivar endpoints legítimos que la regla anterior deshabilitó; no se reactivaron filas masivamente en producción.
- Web y PWA mantienen Web Push. Tauri Desktop y móvil usan su ruta nativa, sin registrar el worker de notificaciones web.
- Pruebas con transportes falsos y worker ejecutado en VM: dos endpoints con igual user-agent, recuperación tras fallo, separación de runtimes, aviso normal sin ventanas abiertas y aviso de llamada con acción que abre Atlas.

El service worker servido en producción respondió 200/application/javascript y coincide con el archivo del repositorio. Una consulta de solo lectura encontró 12 suscripciones habilitadas, 8 deshabilitadas y entregas web_push recientes marcadas sent. Un estado sent significa que al menos un proveedor aceptó la entrega, no que todos los dispositivos mostraron el aviso. No se enviaron notificaciones reales, cambiaron claves/configuración ni desplegaron estos arreglos durante la auditoría.

Para probar las correcciones en producción hay que desplegar API/worker y web, después abrir la web/PWA autenticada para sincronizar la suscripción. Estos cambios no requieren regenerar el APK y no habilitan todavía su push en segundo plano.

Referencias: [FCM Android](https://firebase.google.com/docs/cloud-messaging/android/receive-messages), [Android CallStyle](https://developer.android.com/develop/ui/compose/notifications/call-style), [Apple PushKit/CallKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit), [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
