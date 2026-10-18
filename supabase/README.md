# Panel de administración · puesta en marcha

1. **Crear proyecto** gratis en https://supabase.com (región UE, p. ej. Frankfurt).
2. **SQL Editor** → pega todo `supabase/schema.sql` → *Run*. (Se puede repetir sin problema.)
3. **Authentication → Users → Add user**: tu correo y una contraseña larga (≥ 12 caracteres). Marca *Auto Confirm*.
4. En el SQL Editor, da permisos de administrador a ese usuario:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'TU_CORREO';
   ```
5. **Authentication → Providers → Email**: desactiva *Allow new users to sign up* (nadie más podrá registrarse).
6. **Project Settings → API**: copia *Project URL* y la clave *anon / publishable* a `js/config.js` (`supabaseUrl`, `supabaseKey`). La clave anon es pública por diseño; la protección real son las políticas RLS del esquema.
7. Sube a Vercel. El panel está en `https://TU-DOMINIO/administrador/`.
8. (Opcional) Para que Google Sheets use los mismos servicios y horarios: en `google-sheets/Code.gs` rellena `SUPABASE_URL` y `SUPABASE_KEY`, y en Apps Script haz *Implementar → Gestionar implementaciones → Editar → Nueva versión*.

Las reservas de la web se guardan en Google Sheets **y** en Supabase (sección *Reservas* del panel).
