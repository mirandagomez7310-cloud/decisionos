# Despliegue de DecisionOS

Cada paso es **N3** y lo ejecuta o autoriza la persona usuaria.

## 1. Supabase Free · N3

1. Crea un proyecto en la región disponible más cercana a México. Desde la raíz del repo, vincúlalo y aplica las migraciones. En PowerShell 5.1 usa `npx.cmd`.

   ```sh
   npx supabase link --project-ref <referencia-del-proyecto>
   npx supabase db push
   ```

2. En **Authentication → URL Configuration**, configura **Site URL** como `https://<dominio>` y añade `https://<dominio>/**` a **Redirect URLs**.
3. Tras completar el paso 2, activa [SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp) en Auth. Usa `smtp.resend.com`, puerto `465`, usuario `resend` y la API key de Resend como contraseña. Configura un remitente del dominio verificado.
4. En las plantillas de correo de Auth, reemplaza el contenido de **Confirm signup** con [confirmation.html](../supabase/templates/confirmation.html). Activa **Confirm email** en el proveedor Email.

Supabase Free puede pausar proyectos inactivos. [Política de pausa](https://supabase.com/docs/guides/platform/free-project-pausing).

## 2. Resend · N3

Crea una cuenta, añade el dominio de envío y verifica los registros DNS que proporciona Resend. Genera una API key con permiso **Sending access**, limitada al dominio verificado. Completa entonces la configuración de SMTP y confirmación del paso 1. [SMTP de Resend](https://resend.com/changelog/smtp-service) · [Permisos de API keys](https://resend.com/changelog/new-api-key-permissions).

## 3. Vercel Hobby · N3

Importa el repo como proyecto Next.js y selecciona Node 24. Antes de desplegar a Production, configura las variables de [.env.example](../.env.example) con valores de producción.

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública del proyecto |
| `SUPABASE_SECRET_KEY` | Clave secreta del proyecto |
| `CRON_SECRET` | Secreto aleatorio de 32 caracteres o más |
| `MAIL_DRIVER` | `resend` |
| `RESEND_API_KEY` | Clave de envío de Resend |
| `MAIL_FROM` | Remitente del dominio verificado, por ejemplo `DecisionOS <alertas@<dominio-de-envío>>` |
| `APP_URL` | `https://<dominio>` |

Deja `AI_DRIVER` sin definir hasta evaluar el Advisor. Las variables de Mailpit y del driver falso son para desarrollo.

Al desplegar, Vercel sincroniza los `schedules` de [vercel.json](../vercel.json). `daily-insights`, `weekly-reports` y `jobs-sweep` envían un POST a `/api/jobs/run` con `CRON_SECRET` como token Bearer. [Vercel Schedules](https://vercel.com/blog/introducing-vercel-schedules).

Hobby es para uso personal no comercial. Pasa a Pro antes de dar servicio al primer cliente de pago (D-035). [Plan Hobby](https://vercel.com/docs/plans/hobby).

## 4. Dominio · N3

Añade el dominio en **Settings → Domains** del proyecto Vercel y aplica los registros DNS que indique el panel. Cuando Vercel valide el dominio y emita el certificado, confirma que abre por HTTPS y coincide con `APP_URL` y la configuración de Auth.

## 5. Comprobaciones después del despliegue · N3

1. Registra una cuenta, abre el correo de confirmación y comprueba que puedes iniciar sesión.
2. Crea una organización, importa un CSV y comprueba que el panel refleja sus datos.
3. Desde el proyecto vinculado a Vercel, ejecuta `vercel schedules invoke weekly-reports` y comprueba que llega el informe al correo del owner o admin. Revisa la ejecución en **Schedules**.
4. Abre la consola del navegador y comprueba que no hay errores de CSP. Ejecuta Lighthouse sobre el dominio desplegado.

## 6. Vuelta atrás · N3

En **Deployments**, usa **Instant Rollback** para restaurar el despliegue anterior. Las migraciones de Supabase solo avanzan. Si el esquema necesita una corrección, aplica una migración nueva compatible con la versión restaurada. [Instant Rollback](https://vercel.com/docs/instant-rollback).
