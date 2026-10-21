# Guía de despliegue: Supabase (backend) + Vercel (web) — todo en planes gratuitos

**Arquitectura final**

```
Navegador (Vercel, versión web)  ─┐
Celular (Expo Go / simulador)    ─┴─▶  Supabase Edge Function "api"  ─▶  Postgres (tablas) + Storage (fotos y videos)
```

No hay servidor propio: el antiguo backend NestJS se convirtió en **una Edge Function de Supabase** (`supabase/functions/api`) con
las mismas reglas, permisos y rutas. La app (web o celular) solo necesita una URL: `EXPO_PUBLIC_API_URL`.

> **Vercel solo publica la versión WEB** de la app. Para celular sigues usando Expo Go o el simulador, apuntando a la misma API en Supabase.
> El plan **Hobby** de Vercel es gratuito para proyectos personales/no comerciales (un proyecto de curso encaja).

Tiempo estimado: 30–40 minutos. Necesitas: cuenta de Supabase, cuenta de GitHub, cuenta de Vercel (puedes entrar con GitHub), Node instalado.

---

## Parte A · Supabase

### 1. Crear el proyecto
1. <https://supabase.com> → **Start your project** → inicia sesión (GitHub o correo).
2. **New project**: Name `skucy` · **Database Password** → *Generate* y guárdala · Region más cercana (Colombia: **South America (São Paulo)**) · Plan **Free**.
3. Espera 1–2 minutos a que esté listo.
4. Anota tu **Project ref**: es el texto de la URL del proyecto `https://<project-ref>.supabase.co` (también en **Project Settings → General → Reference ID**).

> Si ya tenías un proyecto de la versión anterior: puedes reutilizarlo. Vuelve a ejecutar `schema.sql` (paso 2); es seguro repetirlo y agrega las funciones nuevas. Para empezar de cero usa la sección “Reiniciar la base” al final.

### 2. Crear tablas, funciones y buckets
1. **SQL Editor → New query**.
2. Pega **todo** el contenido de `supabase/schema.sql` y pulsa **Run** → debe decir *Success. No rows returned*.
3. Verifica:
   - **Table Editor**: 18 tablas de datos (+ `skucy_versions`) con el aviso *RLS enabled*.
   - **Storage**: 3 buckets: `avatars` (Public), `thumbnails` (Public), `videos` (**Private**).
   - **Database → Functions**: `skucy_load_changed` y `skucy_apply`. Además, la tabla `skucy_versions` (19.ª tabla, contador de versión por tabla).

### 3. Instalar y entrar al CLI de Supabase
No hace falta instalar nada global: se usa con `npx`.
```bash
cd skucy-mobile
npx supabase login          # abre el navegador; autoriza y vuelve a la terminal
```

### 4. Registrar la app en Microsoft (Azure) — login real con Microsoft 365 (HU-01)
Es gratis y no pide tarjeta. Solo necesitas una cuenta de Microsoft (la personal sirve para crear el registro).
1. Entra a <https://entra.microsoft.com> (o <https://portal.azure.com>) → **Identidad (Identity) → Aplicaciones → Registros de aplicaciones → Nuevo registro**.
   - Si te pide un *tenant/directorio* y no tienes, crea el gratuito de Azure con tu cuenta Microsoft cuando el portal lo ofrezca.
2. **Nombre**: `Skucy`. **Tipos de cuenta compatibles**: *Cuentas en cualquier directorio organizativo (multiinquilino)* — así entran estudiantes de cualquier universidad con Microsoft 365. No elijas “personal accounts”.
3. **URI de redirección**: plataforma **Aplicación de página única (SPA)** y agrega, una por una:
   - `https://TU-APP.vercel.app/auth` (la URL real de Vercel; agrégala después del paso 11)
   - `http://localhost:8081/auth` (para probar en el navegador local)
   - En *Autenticación → Agregar plataforma → Móvil y aplicaciones de escritorio*: `skucy://auth` (solo funciona en build propio, **no** en Expo Go).
4. Pulsa **Registrar**. Copia el **Id. de aplicación (cliente)** → será `MS_CLIENT_ID`. **No** crees ningún *client secret*: la app usa PKCE y no necesita uno.
5. **Permisos de API**: deja `User.Read` (viene por defecto). La app solo pide `openid profile email`.
> Algunas universidades **bloquean** que apps externas pidan consentimiento a sus estudiantes. Si a tus compañeros les sale “necesita aprobación del administrador”, el administrador de TI de la universidad debe aprobar la app (o usen el registro manual con contraseña).

### 5. Definir los secretos de la función
Genera una clave aleatoria para firmar los tokens y elige la contraseña del administrador:
```bash
openssl rand -hex 32        # copia el resultado: será JWT_SECRET

npx supabase secrets set \
  JWT_SECRET=PEGA_AQUI_LA_CLAVE_GENERADA \
  MS_CLIENT_ID=ID_DE_APLICACION_DE_AZURE \
  ADMIN_EMAIL=tucorreo@gmail.com \
  ADMIN_NAME="Tu Nombre" \
  ADMIN_PASSWORD="UnaContraseñaLarga-Con-Numeros-2026" \
  --project-ref TU_PROJECT_REF
```
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **ya los inyecta Supabase**: no los pongas tú.
- `ADMIN_EMAIL` es la **única** cuenta que existe al inicio. Entra con **correo + `ADMIN_PASSWORD`** (mín. 8 caracteres con letra y número). Para cambiar la clave del admin, vuelve a ejecutar `secrets set` con otra `ADMIN_PASSWORD`; se aplica en la siguiente petición.
- Sin `MS_CLIENT_ID` el botón de Microsoft avisa que no está configurado, pero el ingreso manual sigue funcionando.
- Nunca subas estos valores a GitHub ni los pegues en chats.

### 6. Desplegar la función
```bash
npx supabase functions deploy api --no-verify-jwt --use-api --project-ref TU_PROJECT_REF
```
- `--no-verify-jwt`: la función usa su propio login (tokens firmados), no el JWT de Supabase Auth.
- `--use-api`: compila en la nube de Supabase (no necesitas Docker).
- Si el CLI pregunta algo sobre `project_id`, deja el valor por defecto.

Comprueba que responde (reemplaza el ref):
```bash
curl https://TU_PROJECT_REF.supabase.co/functions/v1/api/health
# → {"status":"ok","time":"..."}

curl https://TU_PROJECT_REF.supabase.co/functions/v1/api/sync
# → JSON con "users": [ ...solo el admin... ]  (la primera llamada crea la cuenta de administrador)
```
Mira los registros en **Supabase → Edge Functions → api → Logs** si algo falla.

> Si la función responde *“Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY”*: en **Project Settings → API Keys** copia la **Secret key** (`sb_secret_…`) y ejecuta `npx supabase secrets set SKUCY_SECRET_KEY=sb_secret_xxx --project-ref TU_PROJECT_REF`; la función la usa si existe.

### 7. Configurar la app (`.env`)
```bash
npm run setup                 # instala dependencias (incluye soporte web) y crea .env
```
Edita `.env`:
```env
EXPO_PUBLIC_API_URL=https://TU_PROJECT_REF.supabase.co/functions/v1/api
```
(sin `/` al final).

### 8. Probar en local
```bash
npm start       # presiona i (simulador iOS) o w (navegador)
```
Entra con `ADMIN_EMAIL` + `ADMIN_PASSWORD` → **Panel → Administración → Catálogo** y crea institución (con su dominio de correo), facultad, carrera y materias.
Después puedes registrar usuarios con correos de ese dominio, agregar foto de perfil y subir videos (máx. 50 MB).

> Celular físico con Expo Go: no necesita estar en la misma red que tu Mac; usa la API en Supabase.

---

## Parte B · Vercel (versión web)

### 9. Subir el proyecto a GitHub
Después de `npm run setup` (que actualiza `package.json` y crea `package-lock.json`):
```bash
cd skucy-mobile
git init
git add .
git commit -m "Skucy"
# Crea un repositorio vacío en github.com (botón New) y copia su URL:
git branch -M main
git remote add origin https://github.com/TU_USUARIO/skucy.git
git push -u origin main
```
`.env` NO se sube (está en `.gitignore`); no contiene secretos de todas formas, solo la URL pública de la API.
**Importante:** haz commit de `package.json` y `package-lock.json` con las dependencias instaladas, o Vercel no podrá construir la app.

### 10. Probar la versión web localmente (opcional)
```bash
npm run build:web           # genera la carpeta dist/
npx serve dist              # abre la URL que muestre
```

### 11. Desplegar en Vercel
1. <https://vercel.com> → **Sign up** con GitHub (plan **Hobby**, gratis).
2. **Add New… → Project** → importa tu repositorio `skucy`.
3. Configuración (viene de `vercel.json`, solo verifica):
   - Framework Preset: **Other**
   - Install Command: `npm install`
   - Build Command: `npx expo export -p web`
   - Output Directory: `dist`
4. **Environment Variables** (antes de desplegar): Name `EXPO_PUBLIC_API_URL` · Value `https://TU_PROJECT_REF.supabase.co/functions/v1/api` · Environments: Production, Preview, Development.
5. **Deploy**. Cuando termine, Vercel te da una URL tipo `https://skucy-xxxx.vercel.app`.
6. Abre la URL y entra con el correo del admin.

Cada `git push` a `main` vuelve a desplegar. Si cambias `EXPO_PUBLIC_API_URL`, haz **Redeploy** (la variable se incrusta al construir).

Alternativa con CLI: `npx vercel` (primera vez, responde las preguntas) y `npx vercel --prod`.

---

## Cuando cambies código de la función
La carpeta `supabase/fn-src/` es el código fuente; `supabase/functions/api/index.ts` es el archivo compilado que se despliega.
```bash
npm run fn:build            # recompila
npm run fn:deploy -- --project-ref TU_PROJECT_REF
```
Si cambias reglas en `shared/` (permisos, acciones) también debes recompilar y desplegar.

## Límites de los planes gratuitos

| Servicio | Límite relevante |
|---|---|
| Supabase Free | 500 MB base de datos · **1 GB** de archivos · **50 MB por archivo** · 5 GB de salida/mes · el proyecto se **pausa tras 1 semana sin actividad** (Dashboard → *Restore project*) |
| Edge Functions (Free) | Cuota mensual de invocaciones y tiempo de CPU limitado por petición; hay “arranque en frío” (la primera llamada tras un rato puede tardar 1–3 s) |
| Vercel Hobby | Uso personal/no comercial; ancho de banda y builds limitados. Una app estática como esta cabe de sobra |

Comprueba las cifras vigentes en <https://supabase.com/pricing> y <https://vercel.com/pricing>.

**Cómo se agilizaron las consultas (HU-04):**
- Cada tabla tiene un contador de versión. En cada petición la función hace **una** llamada liviana (`skucy_load_changed`) y descarga **solo las tablas que cambiaron** desde la última vez; si nada cambió, no se descarga ningún dato.
- Las escrituras guardan solo las filas modificadas, en una transacción, y actualizan la caché de la propia instancia.
- Si dos peticiones escriben la misma tabla a la vez, la segunda detecta el conflicto de versión y se **repite sola** (hasta 4 veces) en lugar de pisar datos: ya no “gana la última”.
- Índices sobre correo, handle, estado de contenidos, creador/materia y notificaciones.

**Límites técnicos de este diseño (honestos):**
- La caché vive en la memoria de cada instancia de la función (se pierde en un arranque en frío). Cuando una tabla cambia se vuelve a descargar **entera**; con miles de usuarios habría que migrar a consultas paginadas por tabla.
- El límite de peticiones por IP es en memoria de cada instancia: protege lo básico, no es defensa seria contra abuso.
- **Registro manual**: el correo queda *sin verificar* (no hay servicio de correo gratuito configurado); por eso solo se acepta un dominio institucional registrado y, si luego esa persona entra con Microsoft 365, la cuenta se verifica y la contraseña se desactiva (solo cuentas Viewer; las cuentas con permisos especiales no se pueden reclamar así). La “contraseña de la cuenta” del registro manual es una contraseña **de Skucy**, nunca la de Microsoft.
- No hay recuperación de contraseña por correo. Si un usuario manual la olvida, un admin debe resolverlo o puede entrar con Microsoft 365.
- 5 intentos fallidos bloquean la cuenta 15 minutos.
- El inicio con Microsoft funciona en la **versión web (Vercel)** y en builds propios; **no en Expo Go** (no admite el esquema `skucy://`).
- La versión web guarda la sesión en el almacenamiento del navegador (no hay llavero como en el celular).

## Reiniciar la base (borrar todo y empezar limpio)
1. SQL Editor:
```sql
truncate table
  public.users, public.contents, public.institutions, public.faculties,
  public.degrees, public.subjects, public.communities, public.follows,
  public.ratings, public.saved, public.views, public.reports,
  public.notifications, public.applications, public.institution_requests,
  public.audit_logs, public.refresh_tokens, public.app_settings;
```
2. **Storage**: abre `avatars`, `thumbnails` y `videos`, selecciona todo y **Delete** (desde el panel, no por SQL).
3. La siguiente petición a la API vuelve a crear la cuenta del administrador.

## Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| App: “No hay conexión con el servidor” | `EXPO_PUBLIC_API_URL` vacío o mal escrito (sin `/api` al final o con `/` extra). Reinicia con `npm run reset`. En Vercel: redeploy. |
| `{"message":"Faltan las funciones de la base de datos…"}` | No ejecutaste `supabase/schema.sql` (paso 2). |
| `{"message":"Falta el secreto JWT_SECRET…"}` | Paso 4: define `JWT_SECRET` (mínimo 16 caracteres) y vuelve a desplegar. |
| `Invalid JWT` / 401 antes de llegar a la función | La función se desplegó sin `--no-verify-jwt`. Vuelve a desplegar con ese flag. |
| El navegador bloquea la petición (CORS) | Vuelve a desplegar la función; ya responde las cabeceras CORS. Verifica que la URL sea la de la función. |
| No existe la cuenta de admin | Revisa `ADMIN_EMAIL` en los secretos (`npx supabase secrets list --project-ref …`) y llama a `/sync` una vez. |
| La subida de video falla | Máximo 50 MB y formatos MP4/MOV/M4V/WebM/3GP. Revisa que existan los buckets (paso 2). |
| Error 503 “No se pudo guardar en Supabase” | Proyecto pausado o sin internet: Dashboard → *Restore project*. |
| Vercel: build falla por dependencias | Falta hacer commit de `package.json`/`package-lock.json` tras `npm run setup` (paso 8). |
| Vercel: página en blanco al recargar una ruta | Verifica que exista `vercel.json` con el rewrite a `/index.html`. |
