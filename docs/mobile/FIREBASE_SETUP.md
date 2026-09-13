# Preparar Firebase para Android

Estado: proyecto Firebase creado por el usuario; recepción y envío FCM pendientes de implementación. Las variables de Atlas que se documentan aquí preparan esa integración; no activan el push por sí solas. La web/PWA conserva su Web Push con VAPID.

## 1. Obtener el identificador del proyecto

En Firebase, abrir **Configuración del proyecto > General**. Copiar el **ID del proyecto**, no el nombre visible ni el número del proyecto, a `FIREBASE_PROJECT_ID` en el `.env` raíz.

## 2. Registrar la aplicación Android

En la descripción general del proyecto, elegir **Agregar app > Android**. Usar exactamente `com.racoondevs.atlaserp` como nombre del paquete. El apodo puede ser `Atlas ERP Android`.

Descargar `google-services.json` y guardarlo en:

```text
D:/RacoonDevs/atlaserp-v2/.secrets/firebase/google-services.json
```

La variable `ATLAS_ANDROID_GOOGLE_SERVICES_JSON` del `.env` local apunta a esa ubicación. Este archivo contiene identificadores de configuración de Android, no la clave privada del servidor. El SDK y el plugin de Google Services aún deben integrarse en Gradle. Al implementar el build, se deberá cargar explícitamente esta variable y copiar la configuración al módulo Android; el wrapper actual usa `process.env` y no carga automáticamente el `.env` raíz. No copiar la credencial del siguiente paso a Android.

Referencia: [Registrar Android y configurar el SDK](https://firebase.google.com/docs/android/setup).

## 3. Obtener la credencial para el servidor Atlas

En **Configuración del proyecto > Cuentas de servicio > Firebase Admin SDK**, elegir **Generar nueva clave privada** y guardar el JSON descargado, renombrándolo a:

```text
D:/RacoonDevs/atlaserp-v2/.secrets/firebase/service-account.json
```

`GOOGLE_APPLICATION_CREDENTIALS` ya apunta a esa ubicación en el `.env` local. El JSON debe pertenecer al mismo proyecto que la configuración Android. No pegar su contenido en el chat ni incluirlo en el APK o en variables `VITE_`.

El servidor podrá autenticarse con este archivo mediante Application Default Credentials. No se necesita una clave de servidor de la API heredada de FCM.

Referencia: [Autenticación de FCM HTTP v1 con cuenta de servicio](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## 4. Comprobar la API y completar el entorno

En Google Cloud Console, seleccionar el mismo proyecto y abrir **APIs y servicios > Biblioteca**. Buscar **Firebase Cloud Messaging API** y comprobar que esté habilitada.

El bloque local queda así, sustituyendo únicamente el ID:

```dotenv
ATLAS_FCM_ENABLED=false
FIREBASE_PROJECT_ID=tu-id-real-del-proyecto
GOOGLE_APPLICATION_CREDENTIALS=D:/RacoonDevs/atlaserp-v2/.secrets/firebase/service-account.json
ATLAS_ANDROID_GOOGLE_SERVICES_JSON=D:/RacoonDevs/atlaserp-v2/.secrets/firebase/google-services.json
```

Mantener `ATLAS_FCM_ENABLED=false` durante esta preparación. El interruptor todavía no tiene consumidor implementado. No hay que migrar la autenticación, los datos ni las llamadas de Atlas a Firebase para usar FCM.

## Archivos locales y producción

`.secrets/` contiene archivos persistentes de configuración; no es una carpeta temporal ni un resultado de build. Está excluida de Git y del contexto Docker, al igual que la copia Android de `google-services.json`. El `.env` real también está excluido. El repositorio contiene únicamente el ejemplo y esta guía.

Al desplegar la integración, la credencial privada debe provisionarse por separado en el servidor y montarse como archivo de solo lectura en el proceso/contenedor que envía los avisos. Allí `GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a la ruta dentro del contenedor, por ejemplo `/run/secrets/atlas-firebase-service-account.json`. Una ruta Windows del entorno local no funciona dentro de un contenedor Linux. No se han modificado los despliegues con esta preparación.

La configuración Android se utiliza al compilar y sus identificadores quedan en la app; la cuenta de servicio permanece exclusivamente en el servidor. Cambiar las variables de entorno del servidor no configura un APK ya instalado.

## Trabajo posterior a esta preparación

Integrar el registro y renovación de tokens por instalación, el envío desde la cola de Atlas, el receptor Android y las acciones de llamada; compilar e instalar un APK nuevo y probar en un dispositivo real con la app en segundo plano. FCM avisa de la llamada; LiveKit sigue transportando audio y video. La presentación de llamada y su continuidad al bloquear la pantalla requieren su propia integración nativa.

El soporte iOS nativo requiere configurar Apple/APNs y, para llamadas VoIP, PushKit/CallKit. Estos dos archivos Android/servidor no habilitan por sí solos el soporte iOS.
