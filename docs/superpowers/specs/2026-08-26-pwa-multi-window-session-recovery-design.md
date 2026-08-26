# Recuperación de sesión entre ventanas PWA por módulo

Date: 2026-08-26
Status: In Progress (código implementado y verificado con tests automatizados + build; verificación manual multi-ventana pendiente — ver Plan B, Verification Gate)
Author: Claude Code
Spec file: docs/superpowers/specs/2026-08-26-pwa-multi-window-session-recovery-design.md
Plan file: docs/superpowers/plans/2026-08-26-pwa-session-fix-plan-a-api.md (backend)
Plan file: docs/superpowers/plans/2026-08-26-pwa-session-fix-plan-b-frontend.md (frontend)

---

## 1. Feature title

Recuperación de sesión entre ventanas PWA por módulo (fix de re-logins frecuentes)

## 2. Status

In Progress (código implementado y verificado con tests automatizados + build; verificación manual multi-ventana pendiente — ver Plan B, Verification Gate)

## 3. Context

Cada módulo Atlas puede instalarse como una PWA independiente (`apps/api/src/routes/pwa.js`, `apps/desktop/src/hooks/usePwaInstall.js`). Todas las PWA instaladas comparten el mismo origen y `scope: "/"`, así que en teoría comparten `localStorage`/`IndexedDB` (incluida la sesión de Supabase persistida por `apps/desktop/src/lib/supabase.js`).

En la práctica, cada módulo instalado abre su **propia ventana de nivel superior**, cada una con su propia instancia de `AuthProvider` (`apps/desktop/src/auth/AuthProvider.jsx`) y su propio ciclo de vida de refresh de token. Antes de que existiera la instalación por módulo, el usuario normalmente tenía una sola ventana de la app abierta; ahora es común tener 2-3 ventanas (módulos) abiertas y en segundo plano simultáneamente durante horas.

## 4. Problem

Los usuarios reportan que se les pide iniciar sesión con mucha frecuencia (a veces a diario), y que a veces, aunque un módulo instalado muestre sesión iniciada, abrir otro módulo instalado les pide loguearse de nuevo.

Investigación del código (ver `AuthProvider.jsx` y `apps/api/src/index.js`) identificó dos causas concretas:

1. **Cero tolerancia de reloj en la verificación local del JWT.** `verifySupabaseJwt()` (`apps/api/src/index.js:232-256`) rechaza cualquier token con `payload.exp <= now`, sin ningún margen. Un token que expira mientras una ventana en segundo plano aún no ha corrido su ciclo de refresco (por ejemplo, tras suspensión del sistema, donde los timers de `setTimeout` no son fiables) dispara un 401 inmediato en la primera petición, incluso si solo han pasado unos segundos desde el `exp`.
2. **`forceLogout()` no verifica si la sesión ya fue recuperada por otra ventana antes de cerrar sesión globalmente.** Cuando una ventana recibe un 401 con mensaje de token muerto, intenta un refresh manual (`AuthProvider.jsx:21-40`); si ese refresh falla (por ejemplo, porque otra ventana ya consumió/rotó el mismo refresh token momentos antes), la ventana llama a `supabase.auth.signOut()`, que revoca la sesión en el servidor y limpia el `localStorage` **compartido por todas las ventanas**. Esto cierra la sesión de todos los módulos instalados, aunque solo una ventana haya tenido el problema puntual, y aunque otra ventana ya tuviera (o estuviera a punto de tener) un token válido.

El resultado combinado: cualquier ventana que tropiece con un 401 de borde (por el punto 1) puede terminar deslogueando a todas las demás ventanas (por el punto 2), y esto ocurre con más frecuencia ahora que es normal tener varias ventanas de módulo abiertas en paralelo.

## 5. Goals

1. Eliminar los 401 falsos-positivos causados por falta de tolerancia de reloj en la verificación local del JWT.
2. Evitar que una ventana cierre la sesión compartida (`signOut()`) cuando otra ventana ya recuperó una sesión válida, en vez de forzar logout global.
3. Recuperar proactivamente la sesión de una ventana de módulo que estuvo mucho tiempo en segundo plano/inactiva, en el momento en que vuelve a tener foco, en vez de esperar a que falle una petición.
4. Mantener el comportamiento actual para el caso real de sesión muerta (refresh token inválido/revocado): el usuario debe seguir viendo la pantalla de login cuando corresponde.

## 6. Non-goals

1. No se cambia la configuración de Supabase Studio (expiración de JWT, "Refresh Token Reuse Interval"). Se documenta como recomendación operativa fuera de este plan (ver Sección 24, Riesgo 3).
2. No se introduce un mecanismo de elección de "ventana líder" (BroadcastChannel/leader election) ni se reemplaza la sincronización multi-tab nativa de `supabase-js` (`storage` events + `navigator.locks`); solo se añade una verificación defensiva adicional.
3. No se modifica el sistema de instalación/manifiesto PWA (`pwa.js`, `usePwaInstall.js`, `pwa-bootstrap.js`) — el origen/scope compartido ya es correcto.
4. No se realiza la descomposición de `apps/api/src/index.js` (archivo ya señalado como violador conocido en `CLAUDE.md`); solo se añade un export puntual de la función tocada para poder testearla.
5. No se cambia el comportamiento de sesión offline (`SessionVault`/`@atlas/offline`) más allá de lo que ya ocurre por los cambios en `AuthProvider`.

## 7. User stories

- Como usuario que tiene instalados varios módulos como PWA, quiero que abrir un módulo no me pida loguearme de nuevo si ya tengo sesión activa en otro módulo, para no interrumpir mi flujo de trabajo.
- Como usuario que deja una ventana de módulo abierta en segundo plano durante horas, quiero que al volver a esa ventana la sesión se refresque sola si aún es válida, en vez de que la primera acción que haga falle con un error de autenticación.

## 8. UX requirements

- Ningún cambio visual nuevo. El único cambio observable es que la pantalla de login (`apps/desktop/src/auth/LoginScreen.jsx`) debe aparecer con menos frecuencia, y solo cuando la sesión realmente esté muerta (refresh token inválido/revocado).
- No se debe introducir ningún parpadeo perceptible ni pantalla de carga adicional visible al usuario durante la revalidación en foco (debe ocurrir en segundo plano).

## 9. Routes/screens

N/A — no se agregan ni modifican rutas o pantallas.

## 10. Data model

N/A — no hay cambios de entidades.

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

No se agregan endpoints nuevos. Se modifica el comportamiento interno de la verificación de JWT usada por `authMiddleware` (todas las rutas protegidas existentes):

### Verificación de JWT (interna, no es un endpoint nuevo)

Auth: N/A (es la función de verificación en sí)
Cambio: `verifySupabaseJwt()` acepta un margen de tolerancia de reloj (`JWT_CLOCK_SKEW_LEEWAY_SECS`) al comparar `payload.exp` contra el tiempo actual, en vez de comparar sin margen.
Respuesta de error sin cambios: `{ error: "No autorizado. Token invalido o expirado." }` (401) para tokens realmente expirados más allá del margen.

## 13. SDK contract

N/A — no se agregan ni modifican métodos de `@atlas/sdk`.

## 14. Validator contract

N/A — no se agregan ni modifican schemas Zod.

## 15. Module manifest impact

N/A — este fix no toca ningún manifiesto de módulo.

## 16. Navigation impact

N/A

## 17. Blueprint impact

N/A

## 18. RBAC/permissions

N/A — no se agregan ni modifican permisos.

## 19. Multi-company behavior

Sin cambios. El fix no toca la resolución de `companyId` ni el aislamiento entre compañías.

## 20. Files/storage impact

N/A

## 21. Export/import requirements

N/A

## 22. Audit log requirements

N/A — los eventos de login/logout de Supabase no pasan por `AuditLog` hoy y este fix no cambia eso.

## 23. Edge cases

1. Dos ventanas de módulo abren casi al mismo tiempo tras dormir la laptop varias horas: solo una debe terminar mostrando login (si la sesión realmente expiró) o ninguna (si el refresh token seguía vivo).
2. Una ventana con reloj de sistema ligeramente desincronizado del servidor no debe generar 401 falsos por unos pocos segundos de diferencia.
3. Sesión realmente revocada (usuario cambió contraseña, admin revocó sesión, refresh token expirado por política): todas las ventanas deben terminar mostrando login; el fix no debe enmascarar este caso.
4. Ventana que recupera el foco después de días inactiva, con refresh token ya inválido: debe mostrar login limpio, sin quedar en un estado de carga infinita.
5. Margen de tolerancia de reloj (leeway) no debe ser tan grande que permita usar un token varios minutos después de su expiración real — se usa un valor pequeño (segundos, no minutos).

## 24. Risks

1. Riesgo: un leeway demasiado grande en la verificación de JWT debilita la garantía de expiración. Mitigación: usar un valor pequeño (≤10s), documentado como constante nombrada, alineado con el margen de reloj típico entre servidores NTP-sincronizados.
2. Riesgo: la verificación defensiva "re-chequear sesión antes de cerrar sesión" podría enmascarar un caso real de sesión muerta si se implementa mal (por ejemplo, si lee una sesión en caché obsoleta en vez de una fresca). Mitigación: siempre leer `supabase.auth.getSession()` fresco (no un valor cacheado en memoria) antes de decidir, y solo abortar el `signOut()` si el `expires_at` de esa sesión fresca es futuro con margen.
3. Riesgo (fuera del código): si el "Refresh Token Reuse Interval" de Supabase Studio está en 0/muy bajo, seguirá habiendo una ventana de carrera real entre refrescos casi simultáneos de distintas ventanas. Mitigación: recomendar al usuario revisar ese valor en Supabase Studio (Authentication > Sessions) como acción operativa complementaria a este fix; no es parte del código de este plan.
4. Riesgo: `index.js` ya está señalado como archivo que excede el límite de líneas. Mitigación: el cambio de este plan es de una sola constante y una condición; no se agrega lógica nueva de tamaño significativo a ese archivo.

## 25. Acceptance criteria

1. Dado un token JWT cuyo `exp` quedó en el pasado hace menos de `JWT_CLOCK_SKEW_LEEWAY_SECS` segundos, cuando `authMiddleware` lo verifica localmente, entonces la petición se autoriza (no 401).
2. Dado un token JWT cuyo `exp` quedó en el pasado hace más de `JWT_CLOCK_SKEW_LEEWAY_SECS` segundos, cuando `authMiddleware` lo verifica, entonces la petición se rechaza con 401 como hoy.
3. Dado que la Ventana B recibe un 401 de token muerto y su refresh manual falla, pero `supabase.auth.getSession()` fresco ya trae una sesión con `expires_at` futuro (porque la Ventana A ya refrescó y escribió en el `localStorage` compartido), cuando `forceLogout()` corre en la Ventana B, entonces NO se llama a `signOut()` y la Ventana B queda con la sesión ya renovada.
4. Dado que ninguna ventana tiene una sesión válida (refresh token realmente muerto), cuando `forceLogout()` corre, entonces se llama a `signOut()` como hoy y el usuario ve `LoginScreen`.
5. Dado que una ventana de módulo estuvo oculta/en background y su token expiró mientras tanto, cuando la ventana recupera el foco (`visibilitychange`/`focus`), entonces se dispara una revalidación de sesión sin esperar a que una petición falle primero.

## 26. Verification plan

- `node --test apps/api/src/services/__tests__/` — no debe romper nada existente.
- Nuevo test unitario para el leeway de `verifySupabaseJwt` (ver Plan A).
- Nuevo test unitario para el helper puro de frescura de sesión (ver Plan B).
- `pnpm build` — sin errores de build en `apps/api` y `apps/desktop`.
- Manual: abrir dos módulos instalados como PWA (o dos pestañas en `/app/m/<moduleA>/` y `/app/m/<moduleB>/`), dejar pasar el tiempo de expiración del access token (o adelantar el reloj del sistema en un entorno de prueba), y confirmar que ambas ventanas se recuperan sin pedir login, salvo que el refresh token también haya expirado.
- Manual: forzar un refresh token realmente inválido (revocar sesión desde Supabase Studio) y confirmar que ambas ventanas terminan mostrando `LoginScreen` correctamente (que el fix no oculta el caso real).

## 27. Rollback plan

Ambos planes son cambios pequeños y localizados (una constante + una condición en `apps/api/src/index.js`; un helper puro nuevo + dos ajustes en `AuthProvider.jsx`). Revertir es un `git revert` de los commits de cada plan; no hay migraciones ni cambios de esquema involucrados.

## 28. Future enhancements

1. Evaluar mover `authMiddleware`/`verifySupabaseJwt` a un servicio dedicado (`apps/api/src/services/auth-verification-service.js`) como parte de la descomposición pendiente de `index.js`, fuera del alcance de este fix.
2. Evaluar un indicador visual sutil ("reconectando sesión...") si la revalidación en foco tarda más de X segundos, si en el futuro se reporta que el usuario percibe demora.
3. Evaluar exponer en Supabase Studio (vía documentación interna) el ajuste recomendado de "Refresh Token Reuse Interval" como parte del runbook de infraestructura (`project_supabase_infra` en memoria).
