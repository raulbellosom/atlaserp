# Collabora en office.racoondevs.com

Configuración basada en los dominios y la salida de `docker ps` proporcionados por el administrador. Estos pasos se ejecutan en el VPS; este documento no implica que ya se hayan aplicado allí.

## Direcciones y puertos confirmados

| Servicio | Dominio / conexión | Puerto publicado en el VPS |
|---|---|---|
| Frontend Atlas | `https://atlas.racoondevs.com` | `5173` → contenedor web `80` |
| API Atlas | Conservar su proxy público actual | `4010` → contenedor API `4010` |
| Collabora | `https://office.racoondevs.com` | `127.0.0.1:9980` → contenedor CODE `9980` |

El listener de 4010 pertenece a `atlas-api-external`: es el Atlas existente, no un conflicto con otra aplicación. No cambiar ese puerto ni iniciar el perfil `local` en el VPS. Collabora no aparece en la lista de contenedores en ejecución proporcionada; eso no determina si existe un contenedor detenido.

## Variables del VPS

En `/opt/atlaserp/.env.external`, establecer estas entradas una sola vez, sustituyendo cualquier valor anterior de esas mismas claves:

```dotenv
ATLAS_APP_URL=https://atlas.racoondevs.com
ATLAS_API_PORT=4010
ATLAS_OFFICE_ENABLED=true
COLLABORA_PUBLIC_URL=https://office.racoondevs.com
ATLAS_OFFICE_HOST_ORIGIN=https://atlas.racoondevs.com
COLLABORA_INTERNAL_URL=http://collabora:9980
ATLAS_WOPI_URL=http://api:4010
ATLAS_OFFICE_ADDITIONAL_ORIGINS=http://tauri.localhost,https://tauri.localhost,tauri://localhost
ATLAS_WOPI_TOKEN_SECONDS=28800
```

Conservar `ATLAS_WOPI_SECRET` si ya tiene valor. En la primera activación puede quedar vacío: el instalador actualizado lo genera y persiste. Conservar las claves de autenticación, Storage y base de datos, la configuración de Calls y la URL pública actual de la API (`ATLAS_API_URL`). La salida de puertos no permite deducir si esta última usa `/api` o un subdominio. `CORS_ORIGIN` debe incluir `https://atlas.racoondevs.com`; conservar también los demás orígenes legítimos existentes.

`ATLAS_OFFICE_HOST_ORIGIN` corresponde al frontend que abre el usuario y coincide aquí con `ATLAS_APP_URL`; Office no hereda automáticamente esa variable. Las direcciones `api` y `collabora` son nombres internos de Docker.

El `.env` de la raíz del repositorio usado para desarrollo es distinto de `.env.external` del instalador. No copiar indiscriminadamente el archivo de desarrollo al VPS ni modificar los valores locales solo para configurar producción. En la carpeta del instalador, el archivo `.env` sin sufijo es generado para interpolar Compose.

## Nginx del host y certificado

Estos pasos usan el mismo esquema de los virtual hosts Atlas y RTC proporcionados: Nginx en el host, certificados en `/etc/letsencrypt/live/` y validación ACME mediante `/var/www/certbot`. Se utiliza Certbot en modo `webroot`.

El registro DNS A de `office.racoondevs.com` debe apuntar a `66.175.239.181`. Los puertos públicos 80/443 deben alcanzar este Nginx para emitir el certificado por HTTP y servir HTTPS. El puerto 9980 permanece en loopback.

Crear o editar `/etc/nginx/sites-available/office.racoondevs.com.conf`. Si aún no existe el certificado Office, guardar primero **solo el bloque HTTP** siguiente. No activar el bloque HTTPS hasta haber emitido el certificado, porque Nginx no podrá cargar rutas de certificados inexistentes.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name office.racoondevs.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

Para un archivo nuevo, habilitarlo si no hay ya un enlace, validar y recargar. Ejecutar la recarga solo si la validación termina correctamente:

```bash
ln -s /etc/nginx/sites-available/office.racoondevs.com.conf /etc/nginx/sites-enabled/office.racoondevs.com.conf
mkdir -p /var/www/certbot
nginx -t && systemctl reload nginx
```

Después de la recarga correcta, solicitar el certificado mediante [Certbot webroot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot):

```bash
certbot certonly --webroot -w /var/www/certbot --cert-name office.racoondevs.com -d office.racoondevs.com
```

Una vez emitido, añadir este segundo bloque al mismo archivo, debajo del HTTP:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name office.racoondevs.com;

    ssl_certificate /etc/letsencrypt/live/office.racoondevs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/office.racoondevs.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 12m;
    access_log off;

    location / {
        proxy_pass http://127.0.0.1:9980;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
```

Se usa `Connection "upgrade"` igual que en RTC, sin depender de una variable `map` adicional. Las cabeceras están documentadas para el [proxy WebSocket de Nginx](https://nginx.org/en/docs/http/websocket.html). Conservar la CSP de Collabora y no añadir `X-Frame-Options: SAMEORIGIN`, ya que Atlas debe poder embeber el editor desde otro dominio. Los access logs se desactivan para evitar registrar URLs de sesiones.

Validar y recargar el archivo completo:

```bash
nginx -t && systemctl reload nginx
```

Conservar el bloque ACME del puerto 80 para futuras renovaciones y asegurar que el flujo existente de renovación recargue Nginx cuando cambie el certificado. Si no existe ya ese mecanismo, el parámetro `--deploy-hook 'nginx -t -q && systemctl reload nginx'` puede añadirse al comando de emisión de Certbot. `-q` suprime los mensajes informativos de la prueba, pero conserva los errores reales. La configuración utiliza la sintaxis HTTP/2 de los otros sitios del VPS.

Si Certbot muestra `Successfully received certificate` y las rutas de `fullchain.pem`/`privkey.pem`, el certificado ya se emitió: no repetir la solicitud solo por un aviso del hook. El mensaje `Hook 'deploy-hook' ran with error output` puede corresponder a los mensajes de éxito que `nginx -t` escribe en stderr. Revisar el contenido y comprobar por separado la recarga; la emisión correcta no demuestra que el bloque HTTPS ya esté activo. Para un hook ya guardado, editar únicamente su valor en `/etc/letsencrypt/renewal/office.racoondevs.com.conf`, usando `nginx -t -q && systemctl reload nginx` y conservando la clave existente (`renew_hook` o `deploy_hook`).

El proxy puede responder 502 hasta que CODE arranque; la emisión del certificado usa la ruta ACME, independiente del editor. No abrir documentos hasta que el endpoint HTTPS esté disponible.

## Arranque y comprobación

Primero publicar las nuevas imágenes de Atlas y refrescar el instalador como indica la [guía general](office-collabora.md#first-deployment-on-an-existing-vps). Con la configuración anterior y el proxy listo, ejecutar en el VPS:

```bash
cd /opt/atlaserp
npm run atlas:external
docker compose -f docker-compose.yml -f docker-compose.linux.yml --profile office ps collabora
curl -fsS http://127.0.0.1:9980/hosting/discovery -o /dev/null
curl -fsS https://office.racoondevs.com/hosting/discovery -o /dev/null
```

Usar la actualización completa la primera vez para incluir las migraciones. CODE puede tardar en iniciar. Después abrir un documento desde `https://atlas.racoondevs.com`, editar, guardar, cerrar y reabrir. Las comprobaciones de discovery no sustituyen esta prueba de guardado.
