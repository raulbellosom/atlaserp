# Atlas Native Host — Android milestone

Date: 2026-09-11
Author: Codex

## 1. Feature title
Atlas Native Host: frontend remoto con Tauri 2 Mobile.
## 2. Status
In Progress. Implementación solicitada expresamente por el usuario junto con auditoría, diseño, plan y verificación. Esa autorización rige este trabajo; no se representa como una revisión humana de estos documentos.
## 3. Context
Desktop usa `frontendDist: ../dist`, Tauri 2.11.0 en Cargo.lock, SQL/Store/Shell/Notification. Ya existe mobile_entry_point, pero no proyecto Android. React arranca mediante desktopRuntime y ofrece elegir servidor a todo Tauri. Supabase persiste sesión en localStorage; SessionVault también guarda tokens en IndexedDB. Login usa contraseña, no OAuth de identidad. CallsProvider usa LiveKit y sincronización Realtime/polling. SW usa fetch de red para navegación y Web Push VAPID. Nginx sirve /app y shims sin caché. El API Hono refleja Origin en CORS y usa Authorization; el host no cambia este contrato.
## 4. Problem
Publicar UI frecuentemente no debe requerir reconstruir APK/IPA, ni dar privilegios nativos a contenido ajeno.
## 5. Goals
1. Android abre la SPA existente remotamente y conserva Desktop local.
2. Origen y ruta oficiales, permisos mínimos, bridge central y fallback local.
3. Host info, negociación de capacidades, haptics, notificación local y cola de deep links.
4. Validaciones automatizadas y pasos reproducibles para probar login/chat/Realtime/LiveKit en dispositivo.
## 6. Non-goals
FCM/APNs, CallKit/Telecom, OAuth de identidad, biometría y ejecución de llamadas en background se diseñan como extensiones; no se anuncian como capacidades implementadas. No se duplican React ni tablas.
## 7. User stories
Como usuario quiero abrir Atlas instalado y recibir cambios web sin actualizar el host. Como operador quiero seleccionar un entorno durante el build. Como usuario sin conexión quiero un error y reintento local.
## 8. UX requirements
Shell mínimo sin React: Atlas ERP, No se pudo conectar con Atlas, Reintentar y Diagnóstico. Notificaciones y permisos sólo por acción explícita. Los mensajes de incompatibilidad afectan la función, no todo Atlas. React reutiliza @atlas/ui; el bootstrap local independiente utiliza HTML accesible porque no carga React.
## 9. Routes/screens
SPA /app/ y descendientes. Shell local index.html. atlas://chat/{id} abre conversación; atlas://call/{id} entrega intención a CallsProvider tras autenticación, sin autoaceptar una llamada ni confiar en la pertenencia declarada por el link.
## 10. Data model
HostInfo: platform, nativeHostVersion, osVersion, bridgeVersion, capabilities, frontendUrl. Eventos en memoria nativa con id secuencial, tipo, payload; consulta y confirmación explícita. Límite y deduplicación. Persisten durante recargas, no después de matar el proceso.
## 11. Prisma impact
N/A. Sin migraciones ni cambios en datos existentes.
## 12. API contract
Sin endpoints nuevos en milestone. Se reutilizan Auth/API/Realtime/LiveKit con sus permisos. IPC explícito: host_info, host_connect (sólo shell local), host_ready, host_events y host_ack_events. Los futuros tokens push requieren registro autenticado y revocación al logout.
## 13. SDK contract
Bridge JS central con runtime(), isAvailable(), getHostInfo(), supports(), requireCapability(), notifications, haptics, deepLinks/events y openExternal. @atlas/sdk permanece igual.
## 14. Validator contract
Validación de origen exacto, rutas /app/, URLs externas http(s) sin credenciales, IDs acotados, versiones semánticas y eventos confirmados. Configuración de entorno se valida antes de invocar Tauri.
## 15. Module manifest impact
N/A: infraestructura nativa de la aplicación existente.
## 16. Navigation impact
Desktop conserva selección de servidor; Mobile usa únicamente el frontend seleccionado en build. Links externos abren navegador. Frames quedan bloqueados en Mobile, incluidos editores embebidos; no pueden recibir IPC indirectamente.
## 17. Blueprint impact
N/A.
## 18. RBAC/permissions
No se altera RBAC. Capability Desktop restringida a plataformas Desktop. Mobile sólo main, origen/ruta exactos y comandos enumerados. Sin SQL, Store, Shell genérico, filesystem ni creación de ventanas remotas. Actualizar Tauri a versión corregida >=2.11.1. CSP HTTP frame-src 'none', object-src 'none', base-uri 'self' para solicitudes del host; el bootstrap verifica el encabezado antes de navegar. No se consideran los checks JS frontera de seguridad.
## 19. Multi-company behavior
Conservar ActiveCompanyProvider y validaciones del backend. Deep links se consumen después del gate de sesión/empresa; el backend sigue autorizando cada entidad.
## 20. Files/storage impact
Conservar localStorage/IndexedDB, no conceder Store remoto ni presentar Store como almacenamiento cifrado. Keychain/Keystore para futuros secretos nativos. No guardar credenciales en cola o diagnósticos.
## 21. Export/import requirements
N/A.
## 22. Audit log requirements
N/A para milestone; diagnósticos locales sin tokens ni payloads de negocio.
## 23. Edge cases
DNS/TLS/timeout/HTTP error y JS que no confirma ready vuelven al shell. Reintentos invalidan watchdog anterior. Deep links durante cold start/login permanecen hasta ACK. No dar privilegios por user-agent: sólo selecciona CSP; ACL nativa siempre aplica. Development HTTP únicamente explícito y debug, nunca build release. HTTPS/WSS obligatorios en producción; permisos Android mic/cámara requieren manifest y consentimiento OS.
## 24. Risks
Android no distingue IPC desde iframes: bloquear frames en encabezado de la SPA y comprobarlo antes de cargar. Una SPA comprometida conserva las capacidades enumeradas: minimizar superficie. Servidor debe desplegar CSP antes de probar host. App Store no garantiza aprobación; evaluar 2.5.2/4.2 y funcionalidad nativa real. Android SDK existente sin NDK ni targets Rust móviles: instalar herramientas si están disponibles; no declarar validación física sin dispositivo.
## 25. Acceptance criteria
1. Dado Web/PWA/Desktop, conserva su arranque y distribución.
2. Dado Android, carga sólo /app/ del entorno compilado y devuelve HostInfo real.
3. Dado origen/frame externo, no obtiene bridge; navegación externa no ocupa main.
4. Dado error de red o falta de ready, vuelve al shell local con reintento.
5. Dado evento antes de login, se conserva hasta procesar y confirmar.
6. Dado host sin push/calls nativos, supports devuelve false.
7. Login, Realtime, Chat y audio/video requieren prueba Android real; una compilación no satisface esta aceptación por sí sola.
## 26. Verification plan
node:test para política/config/runtime/version/capabilities/eventos/fallback; cargo fmt/check/test; build Vite; React Doctor; generación Android y compilación cuando toolchain permita. Prueba adversarial de navegación/iframe y checklist de dispositivo documentados.
## 27. Rollback plan
Revertir sólo archivos de esta función. Web y Desktop siguen disponibles. No hay rollback de DB. Retirar acceso mobile remoto antes de relajar CSP.
## 28. Future enhancements
FCM/APNs con tokens por usuario/dispositivo/entorno, CallKit/Telecom, lifecycle nativo y colas persistentes con TTL, Keychain/Keystore, PKCE en navegador del sistema, Universal/App Links verificados, iOS en macOS con firma y revisión de tienda.
