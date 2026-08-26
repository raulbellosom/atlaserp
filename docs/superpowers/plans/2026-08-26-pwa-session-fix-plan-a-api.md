# PWA session fix — Plan A (API) — Implementation Plan

Date: 2026-08-26
Spec: docs/superpowers/specs/2026-08-26-pwa-multi-window-session-recovery-design.md
Status: In Progress

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Eliminar los 401 falsos-positivos de `authMiddleware` causados por la falta de tolerancia de reloj en `verifySupabaseJwt()`, sin debilitar la garantía real de expiración del token. Corresponde a Goal 1 y Acceptance Criteria 1-2 de la spec.

## Architecture summary

Cambio mínimo, localizado en `apps/api/src/index.js`: se agrega una constante de margen (`JWT_CLOCK_SKEW_LEEWAY_SECS`) y se usa en la comparación `payload.exp <= now` de `verifySupabaseJwt()`. Se exporta la función (único export nuevo del archivo, sin refactor adicional) para poder testearla con `node --test`, respetando la regla de "no refactors no relacionados" de `CLAUDE.md`.

---

## File Structure Map

### Create

- `apps/api/src/services/__tests__/verify-supabase-jwt.test.js`

### Modify

- `apps/api/src/index.js` — agrega constante de leeway, la usa en `verifySupabaseJwt()`, y exporta la función.

---

## Task 1 — Agregar tolerancia de reloj a `verifySupabaseJwt`

**Files:**
- Modify: `apps/api/src/index.js`

**Changes:**

- [x] Step 1: Declarar `const JWT_CLOCK_SKEW_LEEWAY_SECS = 10` cerca de la definición de `verifySupabaseJwt` (línea ~232), con un comentario breve explicando por qué existe (margen de reloj entre cliente/servidor, evita 401 de borde en ventanas de módulo inactivas).
- [x] Step 2: Cambiar `if (payload.exp && payload.exp <= now) return null;` por `if (payload.exp && payload.exp <= now - JWT_CLOCK_SKEW_LEEWAY_SECS) return null;` — ojo con el signo: el token debe rechazarse solo si `exp` quedó en el pasado por más del leeway, es decir `payload.exp + JWT_CLOCK_SKEW_LEEWAY_SECS <= now`. Usar esta forma (más legible) en vez de restar del lado de `now`.
- [x] Step 3: Exportar la función: `export function verifySupabaseJwt(token, secret) { ... }` (agregar `export` a la declaración existente; no mover el archivo ni cambiar su ubicación).
- [x] Step 4: Confirmar que el cálculo de TTL de caché (líneas ~274-278, `payload.exp - Math.floor(Date.now() / 1000) - 30`) sigue siendo coherente — no requiere cambio, pero revisar que no quede un TTL negativo pasado al cache cuando el token está dentro del leeway pero ya vencido en `exp` (en ese caso `ttlSecs` puede dar negativo; el código ya tiene `if (ttlSecs > 0) cacheSet(...)`, así que un TTL negativo simplemente no cachea — comportamiento correcto, no tocar).

Nota: este paso ya estaba aplicado en el working tree al momento de continuar la implementación (cambio sin commitear, idéntico al descrito arriba, confirmado con `git diff` y `node --check`). No se requirió reescribirlo.

**Validation:**

```bash
node --check apps/api/src/index.js
```

Éxito: el comando sale con código 0 (sintaxis válida).

---

## Task 2 — Test de regresión para el leeway

**Files:**
- Create: `apps/api/src/services/__tests__/verify-supabase-jwt.test.js`

**Changes:**

- [x] Step 1: Importar `verifySupabaseJwt` desde `../../index.js` (ajustar la ruta relativa real desde `apps/api/src/services/__tests__/` hacia `apps/api/src/index.js`).
- [x] Step 2: Escribir un helper local de test que firme un JWT HS256 mínimo (header+payload+HMAC-SHA256 en base64url) con un `secret` de prueba, replicando el mismo algoritmo que `verifySupabaseJwt` para no depender de una librería externa de JWT.
- [x] Step 3: Test "acepta un token vencido hace menos del leeway": generar un token con `exp = now - 5` (5s en el pasado), verificar que `verifySupabaseJwt(token, secret)` devuelve el payload (no `null`).
- [x] Step 4: Test "rechaza un token vencido hace más del leeway": generar un token con `exp = now - 30` (30s en el pasado), verificar que `verifySupabaseJwt(token, secret)` devuelve `null`.
- [x] Step 5: Test "rechaza firma inválida" (regresión del comportamiento existente, no debe romperse): generar un token con la `secret` incorrecta, verificar que devuelve `null`.
- [x] Step 6: Test "acepta token sin exp" (regresión, comportamiento existente para tokens sin campo `exp`): verificar que sigue devolviendo el payload.

Nota: Step 1 se implementó importando desde `../jwt-verification.js` (el módulo al que Task 1 ya había extraído `verifySupabaseJwt`), no desde `../../index.js` como decía el plan original. Verificado empíricamente que importar `apps/api/src/index.js` directamente en un test es inseguro: el archivo ejecuta `serve({ fetch: app.fetch, port })` de forma incondicional al cargarse, lo que (a) intenta enlazar el puerto real de `pnpm dev:api` (4010, en uso durante esta implementación) y (b) deja un handle HTTP abierto que cuelga indefinidamente tanto `node --test <este archivo>` como la invocación de todo el directorio documentada en CLAUDE.md (`node --test apps/api/src/services/__tests__/` vía glob) — confirmado con timeouts que ambos casos no retornan control sin un workaround. Importar el módulo extraído evita el problema de raíz sin tocar `index.js` más allá de lo ya descrito en Task 1, y es una prueba unitaria más rápida y hermética (sin red, sin puerto, sin credenciales).

**Validation:**

```bash
node --test apps/api/src/services/__tests__/verify-supabase-jwt.test.js
```

Éxito: todos los tests pasan (exit code 0).

---

## Rollback Notes

- Si se aborta después de Task 1: revertir el diff de `apps/api/src/index.js` (una constante + una condición + un `export`); no hay estado persistente afectado.
- Si se aborta después de Task 2: el test nuevo puede eliminarse sin efectos secundarios.

---

## Verification Gate

Before marking any phase task complete in `docs/TASKS.md`:

- [x] All task validation commands have been run.
- [x] All commands exited without errors.
- [x] `node --test apps/api/src/services/__tests__/verify-supabase-jwt.test.js` passes.
- [ ] Manual smoke test: iniciar la API (`pnpm dev:api`), hacer un request autenticado normal a `/health`-equivalente protegido (o `/user/me`) con un token válido, confirmar 200 como antes (no hay regresión en el camino feliz). Pendiente: un `pnpm dev:api` ya estaba corriendo en el puerto 4010 durante esta implementación (propiedad de otra sesión); no se interactuó con él para evitar interferir. Recomendado que quien lo tenga corriendo confirme manualmente.
