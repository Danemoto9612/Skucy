# Skucy (school + society) — App Expo + Supabase (backend) + Vercel (web)

- **App:** React Native + Expo + TypeScript (`app/`, `src/`). Corre en iOS/Android (Expo Go) y en **web** (Vercel).
- **Backend:** una **Edge Function de Supabase** (`supabase/functions/api`, fuente en `supabase/fn-src`) con la misma API, reglas y permisos.
- **Datos y archivos:** Supabase Postgres (18 tablas) + Storage (`avatars`, `thumbnails`, `videos`).
- **Dominio compartido:** `shared/` (tipos, permisos RBAC, reglas de negocio, selectores).

```
Navegador (Vercel) / Celular (Expo) ──REST──▶ Edge Function "api" ──▶ Postgres + Storage
```

**Para desplegar todo (Supabase + Vercel, planes gratuitos) sigue `docs/DEPLOY.md`, paso a paso.**

> Fuera de alcance: pagos, pasarelas, billetera y escrow. Login con **Microsoft 365 real** (Entra ID) y alternativa manual con contraseña.

## Estado inicial: app limpia

No hay cuentas ni datos de ejemplo. Al arrancar, el backend crea **una sola cuenta: el administrador** (correo en `ADMIN_EMAIL`).
Flujo para empezar:

1. Entra como administrador con `ADMIN_EMAIL` + `ADMIN_PASSWORD` (correo y contraseña).
2. Panel → Administración → **Catálogo**: crea institución (con su dominio de correo), facultad, carrera y materias.
3. Cualquier persona con correo de ese dominio se registra con **Microsoft 365** (o manualmente con correo + contraseña), completa su perfil y puede agregar su **foto**.
4. Un viewer pide ser creator → un moderador/admin aprueba (Administración → Usuarios → *Hacer moderador* para delegar).
5. El creator crea contenido: elige el **video** y la **portada** de la galería → se sube a Supabase Storage → envía a revisión →
   moderación aprueba → el creator publica.

Correos de dominios no registrados generan una *solicitud de institución* que moderación/admin puede aprobar.

## Requisitos

macOS con Node **24.19.0**, npm **11.17.0**, Expo **57.0.28**; Xcode (simulador) o Expo Go; internet; cuentas gratuitas de Supabase, GitHub y Vercel.

## Ejecución local (después de configurar Supabase según `docs/DEPLOY.md`, partes A)

```bash
npm run setup           # instala dependencias y crea .env  → completa EXPO_PUBLIC_API_URL
npm start               # 'i' simulador iOS · 'w' navegador
npm run build:web       # genera dist/ (lo que publica Vercel)
npm run fn:build        # recompila la función si cambias supabase/fn-src o shared/
```

No hay servidor local: la app (simulador, celular o navegador) usa la API desplegada en Supabase.

## Archivos (Supabase Storage)

| Bucket | Acceso | Contenido | Límite |
|---|---|---|---|
| `avatars` | público (lectura) | foto de perfil | 5 MB · JPG/PNG/WebP |
| `thumbnails` | público (lectura) | portada del contenido | 5 MB · JPG/PNG/WebP |
| `videos` | **privado** | video del creator | **50 MB** (tope del plan gratuito) · MP4/MOV/M4V/WebM/3GP |

La API valida permisos y emite una **URL firmada**; la app sube el archivo directo a Storage y la API lo verifica (tipo y tamaño) antes de enlazarlo.
El video se reproduce con una URL firmada de 1 hora, solo para quien tiene acceso al contenido.

## Seguridad

- Tablas con RLS activado y sin políticas; permisos de `anon`/`authenticated` revocados: la clave pública no puede leer nada.
- Access token HMAC de 15 min + refresh token rotativo (hasheado; reutilizar uno viejo revoca la sesión). Tokens en `expo-secure-store`.
- `@Access('permiso')` en cada endpoint + las mismas reglas dentro del dominio. `GET /sync` devuelve solo lo que cada usuario puede ver.
- Cada petición guarda sus cambios en **una sola transacción SQL** (todo o nada); si falla, responde 503.
- Microsoft: el servidor verifica el ID token (firma RS256 con las claves de Microsoft, emisor, audiencia, vigencia y nonce firmado); la identidad es `tenant:oid`, no el correo; se rechazan cuentas personales.
- Contraseñas: PBKDF2-SHA256 (600 000 iteraciones), bloqueo tras 5 fallos, mensaje de error genérico.
- Optimización: caché por versión de tabla + escritura solo de filas cambiadas + reintento automático por conflicto.

## Endpoints principales (`/api/v1`)

| Área | Endpoints |
|---|---|
| Auth | `GET /auth/microsoft/config` · `POST /auth/microsoft` · `/auth/login` · `/auth/register/start` · `/auth/register` · `/auth/refresh` · `/auth/logout` · `GET /auth/me` |
| Archivos | `POST /media/upload-url` · `POST /media/confirm` · `DELETE /profiles/me/avatar` |
| Lectura | `GET /sync` · `GET /health` |
| Perfil | `PATCH /profiles/me` · `DELETE /profiles/me/avatar` · `POST/DELETE /profiles/:id/follow` |
| Contenido | `POST /content` · `PATCH /content/:id` · `GET /content/:id/playback` · `POST /content/:id/submit-review\|publish\|archive\|view\|save` |
| Creator | `POST /creator-applications` · calificaciones `POST/PATCH/DELETE /creators/:id/ratings` |
| Moderación | `PATCH /moderation/content/:id` · `/creator-applications/:id` · `/reports/:id` · `/institution-requests/:id` · `/ratings/:id` |
| Admin | `/admin/users/:id/status\|roles/:role\|verification` · `PATCH /admin/settings` · `POST/DELETE /admin/catalog/...` · `GET /admin/audit-logs` |

Roles, permisos, historias de usuario y casos de uso: `docs/ROLES_Y_CASOS_DE_USO.md`.

## Estructura

```
app/ src/            App Expo (Expo Router, tema Google Stitch, cliente API, réplica de estado)
shared/              Dominio compartido (types, permissions, selectors, actions, bootstrap, engine)
supabase/fn-src/     Código fuente de la Edge Function (router, auth, media, runtime por petición)
supabase/functions/  Función compilada (la que se despliega) · schema.sql: tablas, funciones SQL, RLS y buckets
docs/                DEPLOY.md (guía) y ROLES_Y_CASOS_DE_USO.md
vercel.json          Configuración del despliegue web
```

## Límites conocidos

- Planes gratuitos: Supabase 500 MB de BD, 1 GB de archivos, 50 MB por archivo y pausa tras 1 semana sin actividad; Vercel Hobby es para uso no comercial.
- La caché es por instancia y las tablas modificadas se redescargan completas: pensado para cientos de usuarios, no miles.
- Registro manual: correo sin verificar y sin recuperación de contraseña por correo. Microsoft 365 no funciona en Expo Go (usa la web o un build propio) y algunas universidades exigen aprobación de su administrador.
- Las pruebas automáticas cubren la función con una base y un Storage simulados; el login real con Azure, el despliegue en Supabase/Vercel y la app en simulador/navegador deben validarse con tus cuentas.
