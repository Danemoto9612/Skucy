// Modelo de dominio de Skucy. Compartido entre la app móvil y el backend (Supabase).

export type RoleName = 'VIEWER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type ContentType = 'VIDEO' | 'ACTIVITY' | 'GUIDED_TASK' | 'RESOURCE' | 'TUTORING';

export type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PAID';

export type ContentStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'REMOVED';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface Institution {
  id: string;
  name: string;
  city: string;
  country: string;
  domains: string[];
}

export interface Faculty {
  id: string;
  institutionId: string;
  name: string;
}

export interface Degree {
  id: string;
  institutionId: string;
  facultyId: string;
  name: string;
  description: string;
  semesters: number;
}

export interface Subject {
  id: string;
  degreeId: string;
  semester: number;
  code: string;
  name: string;
  description: string;
  credits?: number;
  active: boolean;
}

/** Comunidad = institución + facultad + carrera */
export interface Community {
  id: string;
  institutionId: string;
  facultyId: string;
  degreeId: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  handle: string;
  name: string;
  bio: string;
  institutionId: string;
  facultyId: string;
  degreeId: string;
  semester: number;
  roles: RoleName[];
  status: AccountStatus;
  statusReason?: string;
  /** Comunidad principal (primer elemento) + comunidades que sigue. */
  communityIds: string[];
  /** Foto de perfil: URL pública (Supabase Storage) y ruta del objeto en el bucket. */
  avatarUrl?: string;
  avatarPath?: string;
  /** null = automático según umbral, true/false = decisión manual del admin. */
  verifiedOverride: boolean | null;
  /** Cómo se creó la cuenta. `microsoft`: identidad verificada por Microsoft Entra ID; `password`: correo + contraseña. */
  authProvider?: 'microsoft' | 'password';
  /** Solo servidor (nunca viaja a la app): identidad Microsoft (`tid:oid`), hash de contraseña y control de intentos. */
  msKey?: string;
  passwordHash?: string;
  adminPwFp?: string;
  failedLogins?: number;
  lockedUntil?: string;
  /** true cuando el correo institucional fue comprobado por Microsoft; false en cuentas creadas con contraseña. */
  emailVerified?: boolean;
  createdAt: string;
  deletedAt?: string;
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Content {
  id: string;
  creatorId: string;
  type: ContentType;
  title: string;
  description: string;
  communityId: string;
  degreeId: string;
  semester: number;
  subjectId: string;
  tags: string[];
  visibility: Visibility;
  /** Solo informativo: los pagos no están implementados en esta versión. */
  priceLabel?: string;
  /** Portada (miniatura) en Supabase Storage: URL pública y ruta del objeto. */
  thumbnailUrl?: string;
  thumbnailPath?: string;
  /** Video en Supabase Storage (bucket privado). La ruta nunca sale del servidor. */
  videoPath?: string;
  videoMime?: string;
  videoSizeBytes?: number;
  /** Solo en los snapshots del servidor: indica que hay un video reproducible. */
  hasVideo?: boolean;
  status: ContentStatus;
  rejectionReason?: string;
  views: number;
  saves: number;
  reportsCount: number;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
}

export interface SubRatings {
  video?: number;
  clarity?: number;
  activities?: number;
  resources?: number;
}

export interface Rating {
  id: string;
  viewerId: string;
  creatorId: string;
  stars: number;
  sub: SubRatings;
  comment?: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedContent {
  userId: string;
  contentId: string;
}

export interface ViewLog {
  userId: string;
  contentId: string;
  creatorId: string;
  at: string;
}

export type ReportTarget = 'USER' | 'CONTENT';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolution?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface ApplicationEvent {
  status: ApplicationStatus;
  actorId: string;
  reason?: string;
  at: string;
}

export interface CreatorApplication {
  id: string;
  userId: string;
  status: ApplicationStatus;
  communityIds: string[];
  subjectsText: string;
  experience: string;
  links: string;
  acceptedTerms: boolean;
  history: ApplicationEvent[];
  createdAt: string;
}

export interface InstitutionRequest {
  id: string;
  requesterEmail: string;
  requesterName: string;
  name: string;
  domain: string;
  country: string;
  city: string;
  evidence: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reason?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string;
  before: string;
  after: string;
  reason: string;
  at: string;
}

export interface Settings {
  verificationThreshold: number;
  minFollowDaysToRate: number;
}

export interface RatingAggregateData {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  sub: SubRatings;
}

/**
 * Datos derivados que calcula el servidor para que el cliente pueda mostrar
 * información pública sin recibir datos privados (vistas, solicitudes de otros, etc.).
 */
export interface DerivedData {
  verified: Record<string, boolean>;
  creatorSuspended: Record<string, boolean>;
  aggregates: Record<string, RatingAggregateData>;
}

export interface Db {
  version: number;
  institutions: Institution[];
  faculties: Faculty[];
  degrees: Degree[];
  subjects: Subject[];
  communities: Community[];
  users: User[];
  follows: Follow[];
  contents: Content[];
  ratings: Rating[];
  saved: SavedContent[];
  views: ViewLog[];
  reports: Report[];
  notifications: AppNotification[];
  applications: CreatorApplication[];
  institutionRequests: InstitutionRequest[];
  audit: AuditLog[];
  settings: Settings;
  /** Sesión actual (null = usuario anónimo). */
  sessionUserId: string | null;
  /** Solo presente en los snapshots que envía el servidor. */
  derived?: DerivedData;
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  VIDEO: 'Video',
  ACTIVITY: 'Actividad',
  GUIDED_TASK: 'Tarea guiada',
  RESOURCE: 'Recurso',
  TUTORING: 'Explicación personalizada',
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  PUBLIC: 'Público',
  FOLLOWERS: 'Solo seguidores',
  PAID: 'Pago único',
};

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Borrador',
  PROCESSING: 'Procesando',
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
  REMOVED: 'Retirado',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  SUSPENDED: 'Suspendida',
};
