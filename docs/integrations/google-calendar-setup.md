# Google Calendar Setup

## Resumen

Phase 1-3B adds:

- instance-level Google OAuth configuration
- one Google connection per Atlas user
- Google calendar discovery in `atlas.calendar`
- persistent Google calendar selection
- one internal Atlas calendar per selected Google calendar
- Google disconnect that disables linked sources without deleting Atlas calendars

It still does **not** sync events yet. Event import starts in Phase 3B.

## Required env vars

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_ENCRYPTION_KEY`

`GOOGLE_OAUTH_ENCRYPTION_KEY` must be a base64 value that decodes to exactly 32 bytes.

Generate it once per instance and keep it stable. Do not rotate it casually after users connect Google accounts, because previously encrypted Google tokens would stop being readable and users would need to reconnect.

PowerShell example:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Node example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Google Cloud OAuth setup

Create a Google OAuth client for your Atlas instance and grant these scopes:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

Register the redirect URI from `GOOGLE_OAUTH_REDIRECT_URI` exactly as Google will send it back.

## Redirect URI: important implementation detail

`/calendar/google/connect/callback` is an **authenticated Atlas API endpoint**. It expects:

- the Google `code` query param
- an Atlas `Authorization: Bearer <token>` header

Because of that, **do not point Google directly at the API callback** for normal browser use unless you have a custom bridge that adds Atlas auth.

Recommended pattern:

1. Google redirects the browser to `GOOGLE_OAUTH_REDIRECT_URI`
2. That browser-facing route reads `code` and `state`
3. The route calls `GET /calendar/google/connect/callback?code=...&state=...` with the logged-in user's Atlas bearer token

If Google redirects straight to `http://localhost:4010/calendar/google/connect/callback` or `https://atlas.example.com/calendar/google/connect/callback`, the request will arrive without Atlas bearer auth and the flow will fail.

## Local vs production

Use a browser-facing redirect URI for each environment.

Examples:

- local: `http://localhost:5173/app/google/calendar/callback`
- production: `https://atlas.example.com/app/google/calendar/callback`

Rules:

- the URI must match `GOOGLE_OAUTH_REDIRECT_URI` exactly
- local and production usually need separate entries in Google Cloud
- if your public app lives behind a reverse proxy, register the final public URL, not the internal container URL

## Example `.env`

```env
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5173/app/google/calendar/callback
GOOGLE_OAUTH_ENCRYPTION_KEY=replace-with-32-byte-base64
```

## Quick verification

1. Open `atlas.calendar`
2. Confirm the sidebar shows `Google Calendar`
3. If env vars are missing, confirm the UI shows `Google Calendar no configurado`
4. If env vars are present, click `Conectar Google`
5. After Google returns `code` and `state`, ensure your browser callback route forwards both to `GET /calendar/google/connect/callback` with the Atlas bearer token
6. Re-open the sidebar and confirm the connected Google email appears
7. Open `Elegir calendarios` and confirm the Google calendar list loads
8. Select one or more calendars and click `Guardar seleccion`
9. Confirm those calendars now appear under `Mis calendarios` in the Atlas sidebar
10. Re-open `Elegir calendarios` and confirm the previous selection remains preselected
11. Click `Desconectar Google` and confirm the Google connection badge disappears while the Atlas calendars remain available

## Current behavior after selection

When a user saves the picker selection:

- Atlas creates one `GoogleCalendarSource` per selected Google calendar
- Atlas creates one internal calendar immediately for each selected source
- re-selecting the same Google calendar reuses the same Atlas calendar
- omitting a previously selected Google calendar disables that source
- Atlas dispara la importacion inicial en segundo plano por cada source nuevo o reactivado
- los eventos importados quedan editables desde el inicio
- editar localmente un evento importado lo desacopla de futuras reimportaciones

## Verificacion de importacion inicial

1. Conecta Google Calendar
2. Selecciona uno o mas calendarios Google
3. Guarda la seleccion
4. Verifica que el source pase por `Pendiente` o `Sincronizando`
5. Verifica que termine en `Sincronizado`
6. Confirma que los eventos aparezcan en el calendario Atlas creado
7. Edita un evento importado y confirma que futuras reimportaciones no lo sobreescriben

## Command verification

```bash
cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-config.test.js
cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-connection-service.test.js
cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-oauth-service.test.js
cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-source-service.test.js
cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js
cmd /c pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js
cmd /c pnpm prisma validate
cmd /c npx -y react-doctor@latest . --verbose --diff
```

## Manual API fallback

If you are testing before a browser callback handoff exists, capture the Google `code` from your redirect URI and call the Atlas API callback manually:

```bash
curl -G "http://localhost:4010/calendar/google/connect/callback" ^
  --data-urlencode "code=GOOGLE_CODE" ^
  --data-urlencode "state=GOOGLE_STATE" ^
  -H "Authorization: Bearer ATLAS_TOKEN"
```
