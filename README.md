# Gómez Estilistas

## Puesta en marcha

1. Crea un proyecto gratuito en Supabase.
2. Ejecuta `supabase/schema.sql` en el SQL Editor.
3. Copia `.env.example` a `.env` y completa las credenciales del proyecto y `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_NAME` y `ADMIN_TOKEN_SECRET`.
4. Instala dependencias con `npm install`.
5. Arranca con `npm start`. Puedes abrir la interfaz con Go Live en `http://localhost:5502`; la API Express escuchará en `http://localhost:5503`.

La clave `SUPABASE_SERVICE_ROLE_KEY`, el hash de contraseña admin y `ADMIN_TOKEN_SECRET` solo se usan en el servidor. No los publiques ni los incluyas en el frontend.

Si ya ejecutaste la versión anterior del esquema, vuelve a ejecutar `supabase/schema.sql` para crear la tabla `blocked_slots`, que permite cerrar horas manualmente desde el panel.

## Seguridad del administrador

Genera un hash bcrypt para la contraseña sin guardar la contraseña en el proyecto:

`node -e "require('bcrypt').hash(process.argv[1], 12).then(console.log)" "TU_CONTRASEÑA"`

Genera el secreto JWT con:

`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Configura el resultado como `ADMIN_PASSWORD_HASH` y `ADMIN_TOKEN_SECRET`. En Render usa `NODE_ENV=production` y cambia `PUBLIC_APP_ORIGIN` por el dominio público exacto.
