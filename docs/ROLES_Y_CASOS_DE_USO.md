# Skucy — Roles, permisos, historias de usuario y casos de uso

Alcance de esta versión: app Expo (móvil y web) + backend en Supabase (Edge Function, Postgres y Storage). Sin pagos, billetera, escrow ni retiros.

## 1. Roles (acumulativos)

| Rol | Descripción |
|---|---|
| `ANONYMOUS` | Sin cuenta. Explora contenido público, perfiles, instituciones y catálogo académico. |
| `VIEWER` | Cuenta validada con correo institucional. Perfil, comunidades, seguir, guardar, calificar, reportar, solicitar creator. |
| `CREATOR` | Viewer aprobado. Además crea contenido y lo envía a revisión. |
| `MODERATOR` | Modera contenido, solicitudes de creator, reportes, instituciones y suspensiones temporales. |
| `ADMIN` | Todo lo del moderador + usuarios, roles, verificación, umbrales y auditoría. |

Toda cuenta nueva inicia solo como `VIEWER`. Un usuario suspendido o baneado queda con permisos de solo lectura.

## 2. Matriz de permisos

| Permiso | Anón. | Viewer | Creator | Mod. | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| `content:read_public` | ✓ | ✓ | ✓ | – | ✓* |
| `profile:edit_own`, `follow:manage`, `community:join`, `content:save` | | ✓ | ✓ | | ✓* |
| `rating:create`, `report:create`, `notification:read`, `creator:apply` | | ✓ | ✓ | | ✓* |
| `content:create`, `content:submit` | | | ✓ | | ✓* |
| `moderation:content`, `moderation:creator_apps`, `moderation:reports` | | | | ✓ | ✓ |
| `moderation:institution_requests`, `moderation:suspend_user`, `moderation:hide_rating` | | | | ✓ | ✓ |
| `admin:users`, `admin:roles`, `admin:settings`, `admin:audit`, `admin:verification` | | | | | ✓ |

\* Los roles se suman: el administrador y los moderadores conservan también el rol Viewer. Ver `shared/permissions.ts`.

## 3. Reglas de negocio implementadas

- Registro solo con correo institucional; cuentas personales (gmail, outlook, etc.) se rechazan. La institución se
  resuelve por dominio; si no existe se puede enviar una solicitud (nombre, dominio, país, ciudad, evidencia).
- Solicitud de creator: perfil completo, comunidades, materias, experiencia (≥ 20 car.) y términos. Estados
  `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED | SUSPENDED`. Rechazar o suspender exige motivo.
  Nadie puede resolver su propia solicitud.
- Contenido: `DRAFT → PROCESSING → PENDING_REVIEW → APPROVED → PUBLISHED` (o `REJECTED` con motivo y reenvío, `ARCHIVED`,
  `REMOVED`). Solo el contenido `APPROVED` se publica. Nadie modera su propio contenido.
- Visibilidad: público, solo seguidores, pago único (bloqueado: sin pagos en esta versión).
- Creator suspendido: no puede crear, enviar ni publicar.
- Calificaciones: 1–5 estrellas, una activa por creator, editable y eliminable; subcalificaciones opcionales; no a sí
  mismo; solo si lo siguió ≥ N días (configurable) o vio contenido suyo; promedio ponderado (×1,5 si consumió contenido);
  moderación puede ocultar con motivo.
- Verificación: automática si `seguidores ≥ umbral` (configurable, 1000 por defecto), creator activo y sin
  suspensión; el admin puede otorgar/retirar manualmente.
- Auditoría: toda acción de moderación/administración registra actor, acción, recurso, antes/después y motivo.

## 4. Historias de usuario

**Anónimo**
- HU-01 Como anónimo quiero explorar instituciones, carreras, semestres, materias y contenido público para decidir si me registro.
- HU-02 Como anónimo quiero buscar personas, materias y etiquetas para encontrar contenido.

**Viewer**
- HU-03 Como estudiante quiero iniciar sesión con mi cuenta real de Microsoft 365 (o, de forma manual, con mi correo institucional y una contraseña de Skucy) y registrarme por cualquiera de las dos vías.
- HU-04 Como estudiante quiero completar mi perfil (nombre, bio, carrera, semestre) para que me reconozcan.
- HU-05 Como viewer quiero recorrer una carrera completa con contenido de cualquier institución.
- HU-06 Como viewer quiero seguir/dejar de seguir perfiles y comunidades y ver un feed personalizado.
- HU-07 Como viewer quiero guardar contenido para verlo después.
- HU-08 Como viewer quiero calificar a un creator con estrellas y subcalificaciones para ayudar a otros.
- HU-09 Como viewer quiero reportar contenido o usuarios inapropiados.
- HU-10 Como viewer quiero solicitar ser creator y ver el estado y motivos de la decisión.
- HU-11 Como viewer quiero recibir notificaciones de seguidores, contenido nuevo y decisiones.

**Creator**
- HU-12 Como creator quiero crear videos (archivo de video de la galería, subido a Supabase Storage, con su portada), actividades, tareas guiadas, recursos o explicaciones asociados a una materia.
- HU-13 Como creator quiero enviar mi contenido a revisión y ver observaciones si es rechazado, para corregirlo y reenviarlo.
- HU-14 Como creator quiero publicar solo contenido aprobado y archivarlo cuando ya no aplique.
- HU-15 Como creator quiero ver mi calificación promedio y su distribución.
- HU-16 Como creator quiero obtener el badge de verificado al superar el umbral de seguidores.

**Moderador**
- HU-17 Como moderador quiero aprobar o rechazar contenido con motivo para mantener la calidad.
- HU-18 Como moderador quiero aprobar o rechazar solicitudes de creator.
- HU-19 Como moderador quiero resolver reportes y ocultar calificaciones fraudulentas.
- HU-20 Como moderador quiero aprobar solicitudes de nuevas instituciones.
- HU-21 Como moderador quiero suspender o reactivar creators con motivo.

**Administrador**
- HU-22 Como admin quiero suspender, banear, reactivar o eliminar lógicamente usuarios.
- HU-23 Como admin quiero asignar o quitar el rol de moderador.
- HU-24 Como admin quiero configurar el umbral de verificación y los días mínimos para calificar.
- HU-25 Como admin quiero otorgar o retirar la verificación manualmente.
- HU-26 Como admin quiero consultar el registro de auditoría.

## 5. Casos de uso principales

| ID | Caso de uso | Actor | Flujo principal | Alternos / reglas |
|---|---|---|---|---|
| CU-01 | Iniciar sesión / registrarse | Anónimo | Ingresa correo → valida dominio → institución encontrada → completa perfil → queda Viewer | Cuenta personal: rechazo. Dominio desconocido: CU-02. Usuario existente: entra directo. Baneado: bloqueado |
| CU-02 | Solicitar institución | Anónimo | Envía nombre, dominio, país, ciudad, evidencia | Dominio duplicado o solicitud pendiente: error |
| CU-03 | Revisar institución | Moderador | Aprueba (se crea institución, facultad y programa base) o rechaza con motivo | Auditado |
| CU-04 | Explorar catálogo | Anónimo/Viewer | Institución → carrera → semestre → materia → contenido | Solo contenido publicado y visible |
| CU-05 | Seguir / dejar de seguir | Viewer | Pulsa Seguir en un perfil | No a sí mismo; notifica al seguido |
| CU-06 | Solicitar ser creator | Viewer | Completa formulario y acepta términos | Una solicitud activa a la vez; perfil incompleto: error |
| CU-07 | Resolver solicitud de creator | Moderador | Revisa → aprueba (añade rol Creator) o rechaza con motivo | No resolver la propia; auditado; notifica |
| CU-08 | Crear y enviar contenido | Creator | Borrador → elige el video (máx. 50 MB) y la portada de la galería → se suben a Supabase Storage → envía → el backend confirma que el video está en Storage → en revisión | Suspendido: bloqueado. Video ausente en Storage: rechazado con motivo |
| CU-09 | Moderar contenido | Moderador | Aprueba o rechaza (motivo) / archiva / retira | No moderar el propio; auditado |
| CU-10 | Publicar contenido | Creator | Publica contenido aprobado; se notifica a seguidores | Solo `APPROVED` |
| CU-11 | Calificar creator | Viewer | Elige estrellas y subcalificaciones → agregados se recalculan | Elegibilidad por seguimiento/consumo; una activa; no a sí mismo |
| CU-12 | Ocultar calificación | Moderador/Admin | Oculta con motivo | Excluida de agregados; auditado |
| CU-13 | Reportar | Viewer | Describe motivo → reporte abierto | Sin duplicados abiertos; no a sí mismo |
| CU-14 | Resolver reporte | Moderador | Resuelve o descarta con resolución | Notifica al reportante; auditado |
| CU-15 | Suspender / reactivar creator | Moderador | Suspende con motivo → no puede publicar | Auditado; no a staff |
| CU-16 | Gestionar cuentas | Admin | Suspende, banea, reactiva, elimina lógicamente | Motivo obligatorio; no la propia |
| CU-17 | Verificación de perfil | Admin / sistema | Automática por umbral o manual | Requiere creator activo y sin suspensión |
| CU-18 | Configurar umbrales | Admin | Edita umbral y días mínimos | Validación de enteros; auditado |
| CU-19 | Consultar auditoría | Admin | Lista cronológica de acciones | Solo lectura |
