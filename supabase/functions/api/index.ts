// @ts-nocheck — generado por `npm run fn:build` desde supabase/fn-src. No lo edites a mano.
// supabase/fn-src/backend.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/fn-src/http.ts
class HttpError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function statusForDomainError(message) {
  if (message.startsWith("Debes iniciar sesión"))
    return 401;
  if (message.startsWith("No tienes permiso") || message.startsWith("Solo un administrador") || message.startsWith("Solo los creators") || message.startsWith("Tu cuenta de creator está suspendida")) {
    return 403;
  }
  if (/no encontrad/i.test(message))
    return 404;
  return 400;
}
function env(name) {
  const g = globalThis;
  const value = g.Deno?.env?.get?.(name) ?? g.process?.env?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// supabase/fn-src/collections.ts
var byId = (item) => item.id;
var COLLECTIONS = [
  { key: "institutions", table: "institutions", id: byId },
  { key: "faculties", table: "faculties", id: byId },
  { key: "degrees", table: "degrees", id: byId },
  { key: "subjects", table: "subjects", id: byId },
  { key: "communities", table: "communities", id: byId },
  { key: "users", table: "users", id: byId, sort: { field: "createdAt", dir: "asc" } },
  { key: "follows", table: "follows", id: (f) => `${f.followerId}:${f.followingId}`, sort: { field: "createdAt", dir: "asc" } },
  { key: "contents", table: "contents", id: byId, sort: { field: "createdAt", dir: "desc" } },
  { key: "ratings", table: "ratings", id: byId, sort: { field: "createdAt", dir: "asc" } },
  { key: "saved", table: "saved", id: (s) => `${s.userId}:${s.contentId}` },
  { key: "views", table: "views", id: (v) => `${v.userId}:${v.contentId}`, sort: { field: "at", dir: "asc" } },
  { key: "reports", table: "reports", id: byId, sort: { field: "createdAt", dir: "desc" } },
  { key: "notifications", table: "notifications", id: byId, sort: { field: "createdAt", dir: "desc" } },
  { key: "applications", table: "applications", id: byId, sort: { field: "createdAt", dir: "asc" } },
  { key: "institutionRequests", table: "institution_requests", id: byId, sort: { field: "createdAt", dir: "desc" } },
  { key: "audit", table: "audit_logs", id: byId, sort: { field: "at", dir: "desc" } },
  { key: "refreshTokens", table: "refresh_tokens", id: byId }
];
var SETTINGS_TABLE = "app_settings";
var SETTINGS_ID = "global";
var ALL_TABLES = [...COLLECTIONS.map((c) => c.table), SETTINGS_TABLE];

// supabase/fn-src/backend.ts
class ConflictError extends Error {
}
function explain(error) {
  if (error.code === "PGRST202" || /Could not find the function|does not exist/i.test(error.message)) {
    return new Error("Faltan las funciones de la base de datos (o están desactualizadas). Ejecuta supabase/schema.sql en el SQL Editor.");
  }
  if (/invalid api key|jwt/i.test(error.message)) {
    return new Error("Supabase rechazó la clave del servidor (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return new Error(`Supabase: ${error.message}`);
}
var cached = null;
function supabaseClient() {
  if (cached)
    return cached;
  const url = env("SUPABASE_URL");
  const key = env("SKUCY_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la función.");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

class SupabaseBackend {
  client;
  constructor(client = supabaseClient()) {
    this.client = client;
  }
  async loadChanged(known) {
    const { data, error } = await this.client.rpc("skucy_load_changed", { known });
    if (error)
      throw explain(error);
    const result = data ?? {};
    return { versions: result.versions ?? {}, tables: result.tables ?? {} };
  }
  async apply(changes, expected) {
    const { data, error } = await this.client.rpc("skucy_apply", { changes, expected });
    if (error) {
      if (error.code === "40001" || /SKUCY_CONFLICT/.test(error.message))
        throw new ConflictError(error.message);
      throw explain(error);
    }
    return data ?? {};
  }
}

// supabase/fn-src/admin-bootstrap.ts
import { createHmac } from "node:crypto";

// shared/bootstrap.ts
var DEFAULT_SETTINGS = { verificationThreshold: 1000, minFollowDaysToRate: 1 };
function emptyDb() {
  return {
    version: 1,
    institutions: [],
    faculties: [],
    degrees: [],
    subjects: [],
    communities: [],
    users: [],
    follows: [],
    contents: [],
    ratings: [],
    saved: [],
    views: [],
    reports: [],
    notifications: [],
    applications: [],
    institutionRequests: [],
    audit: [],
    settings: { ...DEFAULT_SETTINGS },
    sessionUserId: null
  };
}
function buildAdmin(db, rawEmail, rawName) {
  const email = rawEmail.trim().toLowerCase();
  const local = email.split("@")[0] || "admin";
  const base = local.replace(/[^a-z0-9]/g, "") || "admin";
  let handle = base;
  let n = 1;
  while (db.users.some((u) => u.handle === handle))
    handle = `${base}${n++}`;
  return {
    id: `u_admin_${Date.now().toString(36)}`,
    email,
    handle,
    name: rawName?.trim() || local,
    bio: "",
    institutionId: "",
    facultyId: "",
    degreeId: "",
    semester: 1,
    roles: ["VIEWER", "ADMIN"],
    status: "ACTIVE",
    communityIds: [],
    verifiedOverride: null,
    createdAt: new Date().toISOString()
  };
}

// supabase/fn-src/passwords.ts
var ITERATIONS = 600000;
var enc = new TextEncoder;
var toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
var fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}
async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash)
    return false;
  const expected = fromB64(hash);
  const actual = await derive(password, fromB64(salt), Number(iterations));
  if (actual.length !== expected.length)
    return false;
  let diff = 0;
  for (let i = 0;i < actual.length; i++)
    diff |= actual[i] ^ expected[i];
  return diff === 0;
}
var dummy = null;
async function burnPasswordCheck(password) {
  dummy ??= hashPassword("skucy-dummy-password");
  await verifyPassword(password, await dummy);
}
function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8)
    return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > 128)
    return "La contraseña no puede superar 128 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "La contraseña debe incluir al menos una letra y un número.";
  return null;
}

// supabase/fn-src/runtime.ts
import { AsyncLocalStorage } from "node:async_hooks";

// shared/engine.ts
var engine = null;
function registerEngine(e) {
  engine = e;
}
function current() {
  if (!engine)
    throw new Error("El motor de dominio no está inicializado.");
  return engine;
}
var getState = () => current().getState();
var mutate = (fn) => current().mutate(fn);
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return new Date().toISOString();
}

// supabase/fn-src/runtime.ts
class StorageWriteError extends Error {
}
var als = new AsyncLocalStorage;
function ctx() {
  const c = als.getStore();
  if (!c)
    throw new Error("No hay una petición en curso.");
  return c;
}
var items = (db, def) => db[def.key];
function rowsOf(db) {
  const out = COLLECTIONS.map((def) => {
    const rows = new Map;
    for (const item of items(db, def))
      rows.set(def.id(item), { json: JSON.stringify(item), data: item });
    return { table: def.table, rows };
  });
  out.push({
    table: SETTINGS_TABLE,
    rows: new Map([[SETTINGS_ID, { json: JSON.stringify(db.settings), data: db.settings }]])
  });
  return out;
}
function toIndex(db) {
  const index = new Map;
  for (const { table, rows } of rowsOf(db)) {
    index.set(table, new Map(Array.from(rows.entries()).map(([id, r]) => [id, r.json])));
  }
  return index;
}
function diffAgainst(index, db) {
  const changes = [];
  for (const { table, rows } of rowsOf(db)) {
    const before = index.get(table) ?? new Map;
    const upserts = [];
    for (const [id, r] of rows) {
      if (before.get(id) !== r.json)
        upserts.push({ id, data: r.data });
    }
    const deletes = Array.from(before.keys()).filter((id) => !rows.has(id));
    if (upserts.length || deletes.length)
      changes.push({ table, upserts, deletes });
  }
  return changes;
}
function buildState(data) {
  const db = { ...emptyDb(), refreshTokens: [] };
  for (const def of COLLECTIONS) {
    const list = [...data[def.table] ?? []];
    if (def.sort) {
      const { field, dir } = def.sort;
      list.sort((a, b) => {
        const cmp = String(a[field] ?? "").localeCompare(String(b[field] ?? ""));
        return dir === "asc" ? cmp : -cmp;
      });
    }
    db[def.key] = list;
  }
  const settings = (data[SETTINGS_TABLE] ?? [])[0];
  if (settings)
    db.settings = { ...db.settings, ...settings };
  return db;
}
function rawTable(db, table) {
  if (table === SETTINGS_TABLE)
    return [db.settings];
  const def = COLLECTIONS.find((c) => c.table === table);
  return items(db, def);
}
var caches = new WeakMap;
var MAX_ATTEMPTS = 4;
async function loadState(backend) {
  let cache = caches.get(backend);
  if (!cache) {
    cache = { versions: {}, tables: {} };
    caches.set(backend, cache);
  }
  const res = await backend.loadChanged(cache.versions);
  const changed = Object.keys(res.tables);
  for (const t of changed)
    cache.tables[t] = res.tables[t];
  cache.versions = res.versions;
  if (!cache.state || !cache.index || changed.length) {
    cache.state = buildState(cache.tables);
    cache.index = toIndex(cache.state);
  }
  return { cache, state: cache.state, index: cache.index, versions: res.versions };
}
async function runRequest(backend, fn) {
  for (let attempt = 1;; attempt++) {
    const { cache, state, index, versions } = await loadState(backend);
    const context = { actorId: null, state, loaded: index };
    const outcome = await als.run(context, async () => {
      let result;
      let failure;
      let failed = false;
      try {
        result = await fn((id) => {
          context.actorId = id;
        });
      } catch (e) {
        failed = true;
        failure = e;
      }
      return { result, failure, failed };
    });
    const changes = diffAgainst(index, context.state);
    if (changes.length) {
      const expected = {};
      for (const c of changes)
        expected[c.table] = versions[c.table] ?? 0;
      try {
        const updated = await backend.apply(changes, expected);
        for (const c of changes) {
          cache.tables[c.table] = rawTable(context.state, c.table);
          cache.versions[c.table] = updated[c.table];
        }
        cache.state = undefined;
        cache.index = undefined;
      } catch (e) {
        if (e instanceof ConflictError && attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 20 * attempt + Math.random() * 40));
          continue;
        }
        const reason = e instanceof ConflictError ? "hay demasiada actividad simultánea, intenta de nuevo" : e instanceof Error ? e.message : String(e);
        throw new StorageWriteError(`No se pudo guardar en Supabase: ${reason}`);
      }
    }
    if (outcome.failed)
      throw outcome.failure;
    return outcome.result;
  }
}
var currentActorId = () => ctx().actorId;
var readRaw = () => ctx().state;
function getState2() {
  const c = ctx();
  return { ...c.state, sessionUserId: c.actorId };
}
function mutateServer(fn) {
  const c = ctx();
  const draft = JSON.parse(JSON.stringify(c.state));
  draft.sessionUserId = c.actorId;
  const result = fn(draft);
  draft.sessionUserId = null;
  c.state = draft;
  return result;
}
registerEngine({ getState: getState2, mutate: mutateServer });

// supabase/fn-src/admin-bootstrap.ts
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function ensureAdmin() {
  const email = env("ADMIN_EMAIL")?.toLowerCase();
  if (!email || !EMAIL_RE.test(email))
    return;
  const password = env("ADMIN_PASSWORD");
  const fp = password ? createHmac("sha256", env("JWT_SECRET") ?? "skucy").update(password).digest("hex") : undefined;
  const existing = readRaw().users.find((u) => u.email === email);
  if (existing && (!password || existing.adminPwFp === fp))
    return;
  if (!existing && !password) {
    mutateServer((d) => {
      d.users.push({ ...buildAdmin(d, email, env("ADMIN_NAME")), authProvider: "password", emailVerified: true });
    });
    return;
  }
  if (existing && !existing.roles.includes("ADMIN"))
    return;
  const passwordHash = await hashPassword(password);
  mutateServer((d) => {
    let admin = d.users.find((u) => u.email === email);
    if (!admin) {
      admin = buildAdmin(d, email, env("ADMIN_NAME"));
      d.users.push(admin);
    }
    admin.authProvider = "password";
    admin.emailVerified = true;
    admin.passwordHash = passwordHash;
    admin.adminPwFp = fp;
    admin.failedLogins = 0;
    admin.lockedUntil = undefined;
  });
}

// supabase/fn-src/auth.ts
import { randomBytes } from "node:crypto";

// shared/permissions.ts
var ANONYMOUS = ["content:read_public"];
var VIEWER = [
  ...ANONYMOUS,
  "profile:edit_own",
  "follow:manage",
  "community:join",
  "content:save",
  "rating:create",
  "report:create",
  "notification:read",
  "creator:apply"
];
var CREATOR = [...VIEWER, "content:create", "content:submit"];
var MODERATOR = [
  "moderation:content",
  "moderation:creator_apps",
  "moderation:reports",
  "moderation:institution_requests",
  "moderation:suspend_user",
  "moderation:hide_rating"
];
var ADMIN = [
  ...MODERATOR,
  "admin:users",
  "admin:roles",
  "admin:settings",
  "admin:audit",
  "admin:verification",
  "admin:catalog"
];
var ROLE_PERMISSIONS = {
  ANONYMOUS,
  VIEWER,
  CREATOR,
  MODERATOR,
  ADMIN
};
function permissionsOf(user) {
  if (!user)
    return new Set(ROLE_PERMISSIONS.ANONYMOUS);
  const set = new Set;
  for (const role of user.roles) {
    for (const p of ROLE_PERMISSIONS[role])
      set.add(p);
  }
  if (user.status !== "ACTIVE") {
    return new Set(["content:read_public", "notification:read"]);
  }
  return set;
}
function can(user, permission) {
  return permissionsOf(user).has(permission);
}
function hasRole(user, role) {
  return !!user && user.roles.includes(role);
}

// shared/selectors.ts
function userById(db, id) {
  return id ? db.users.find((u) => u.id === id && !u.deletedAt) : undefined;
}
function sessionUser(db) {
  return userById(db, db.sessionUserId) ?? null;
}
function followersCount(db, userId) {
  return db.follows.filter((f) => f.followingId === userId).length;
}
function isFollowing(db, followerId, followingId) {
  return !!followerId && db.follows.some((f) => f.followerId === followerId && f.followingId === followingId);
}
function latestApplication(db, userId) {
  return db.applications.filter((a) => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
function isCreatorSuspended(db, userId) {
  const flag = db.derived?.creatorSuspended[userId];
  if (flag !== undefined)
    return flag;
  return latestApplication(db, userId)?.status === "SUSPENDED";
}
function isVerified(db, userId) {
  const derived = db.derived?.verified[userId];
  if (derived !== undefined)
    return derived;
  const user = db.users.find((u) => u.id === userId);
  if (!user)
    return false;
  if (user.verifiedOverride !== null)
    return user.verifiedOverride;
  return hasRole(user, "CREATOR") && user.status === "ACTIVE" && !isCreatorSuspended(db, userId) && followersCount(db, userId) >= db.settings.verificationThreshold;
}
function ratingAggregate(db, creatorId) {
  const precomputed = db.derived?.aggregates[creatorId];
  if (precomputed)
    return precomputed;
  const visible = db.ratings.filter((r) => r.creatorId === creatorId && !r.hidden);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let weightedSum = 0;
  let weightTotal = 0;
  const subSums = {
    video: { s: 0, n: 0 },
    clarity: { s: 0, n: 0 },
    activities: { s: 0, n: 0 },
    resources: { s: 0, n: 0 }
  };
  for (const r of visible) {
    distribution[r.stars] += 1;
    const consumed = db.views.some((v) => v.userId === r.viewerId && v.creatorId === creatorId);
    const w = consumed ? 1.5 : 1;
    weightedSum += r.stars * w;
    weightTotal += w;
    Object.keys(subSums).forEach((k) => {
      const v = r.sub[k];
      if (v) {
        subSums[k].s += v;
        subSums[k].n += 1;
      }
    });
  }
  const sub = {};
  Object.keys(subSums).forEach((k) => {
    if (subSums[k].n)
      sub[k] = Math.round(subSums[k].s / subSums[k].n * 10) / 10;
  });
  return {
    average: weightTotal ? Math.round(weightedSum / weightTotal * 10) / 10 : 0,
    count: visible.length,
    distribution,
    sub
  };
}
function ratingEligibility(db, viewer, creatorId) {
  if (!viewer)
    return { ok: false, reason: "Inicia sesión para calificar." };
  if (!can(viewer, "rating:create"))
    return { ok: false, reason: "Tu cuenta no puede calificar." };
  if (viewer.id === creatorId)
    return { ok: false, reason: "No puedes calificarte a ti mismo." };
  const creator = db.users.find((u) => u.id === creatorId);
  if (!creator || !hasRole(creator, "CREATOR"))
    return { ok: false, reason: "Este perfil no es creator." };
  const consumed = db.views.some((v) => v.userId === viewer.id && v.creatorId === creatorId);
  if (consumed)
    return { ok: true };
  const follow = db.follows.find((f) => f.followerId === viewer.id && f.followingId === creatorId);
  if (follow) {
    const days = (Date.now() - new Date(follow.createdAt).getTime()) / 86400000;
    if (days >= db.settings.minFollowDaysToRate)
      return { ok: true };
    return {
      ok: false,
      reason: `Debes seguir al creator al menos ${db.settings.minFollowDaysToRate} día(s) o ver contenido suyo.`
    };
  }
  return { ok: false, reason: "Sigue al creator o mira contenido suyo para poder calificar." };
}
function contentAccess(db, content, viewer) {
  const isOwner = viewer?.id === content.creatorId;
  const isMod = can(viewer, "moderation:content");
  if (isOwner || isMod)
    return { ok: true };
  if (content.status !== "PUBLISHED")
    return { ok: false, reason: "Este contenido no está publicado." };
  if (content.visibility === "PUBLIC")
    return { ok: true };
  if (content.visibility === "FOLLOWERS") {
    return isFollowing(db, viewer?.id, content.creatorId) ? { ok: true } : { ok: false, reason: "Contenido exclusivo para seguidores del creator." };
  }
  return { ok: false, reason: "Contenido de pago único. Los pagos no están disponibles en esta versión." };
}
function findInstitutionByDomain(db, domain) {
  const d = domain.toLowerCase();
  return db.institutions.find((i) => i.domains.some((x) => d === x || d.endsWith(`.${x}`)));
}

// shared/actions.ts
function requireUser(d) {
  const u = sessionUser(d);
  if (!u)
    throw new Error("Debes iniciar sesión para hacer esto.");
  return u;
}
function requirePerm(d, permission) {
  const u = requireUser(d);
  if (!can(u, permission))
    throw new Error("No tienes permiso para realizar esta acción.");
  return u;
}
function audit(d, actor, action, resource, resourceId, before, after, reason = "") {
  d.audit.unshift({
    id: uid("aud"),
    actorId: actor.id,
    action,
    resource,
    resourceId,
    before,
    after,
    reason,
    at: nowIso()
  });
}
function notify(d, userId, type, title, body) {
  d.notifications.unshift({ id: uid("n"), userId, type, title, body, read: false, createdAt: nowIso() });
}
function mustHaveReason(reason, min = 5) {
  const r = (reason ?? "").trim();
  if (r.length < min)
    throw new Error("Debes indicar un motivo (mínimo 5 caracteres).");
  return r;
}
var PERSONAL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "icloud.com", "msn.com"];
var EMAIL_RE2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function checkInstitutionalEmail(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE2.test(email))
    throw new Error("Ingresa un correo válido.");
  const domain = email.split("@")[1];
  if (PERSONAL_DOMAINS.includes(domain)) {
    throw new Error("Solo se permite el correo institucional de Microsoft 365 (no cuentas personales).");
  }
  return { email, domain, institutionId: findInstitutionByDomain(getState(), domain)?.id };
}
function completeRegistration(input) {
  return mutate((d) => {
    const email = input.email.trim().toLowerCase();
    if (d.users.some((u) => u.email === email))
      throw new Error("Ya existe una cuenta con este correo.");
    const institution = d.institutions.find((i) => i.id === input.institutionId);
    const degree = d.degrees.find((x) => x.id === input.degreeId);
    if (!institution || !degree)
      throw new Error("Selecciona tu institución y carrera.");
    if (degree.institutionId !== institution.id)
      throw new Error("La carrera no pertenece a la institución.");
    const name = input.name.trim();
    if (name.length < 3)
      throw new Error("Escribe tu nombre completo.");
    if (!Number.isInteger(input.semester) || input.semester < 1 || input.semester > degree.semesters) {
      throw new Error(`El semestre debe estar entre 1 y ${degree.semesters}.`);
    }
    const base = email.split("@")[0].replace(/[^a-z0-9]/g, "") || "user";
    let handle = base;
    let n = 1;
    while (d.users.some((u) => u.handle === handle))
      handle = `${base}${n++}`;
    const user = {
      id: uid("u"),
      email,
      handle,
      name,
      bio: input.bio.trim(),
      institutionId: institution.id,
      facultyId: degree.facultyId,
      degreeId: degree.id,
      semester: input.semester,
      roles: ["VIEWER"],
      status: "ACTIVE",
      communityIds: [`com_${degree.id}`],
      verifiedOverride: null,
      authProvider: input.credentials.provider,
      msKey: input.credentials.provider === "microsoft" ? input.credentials.msKey : undefined,
      passwordHash: input.credentials.provider === "password" ? input.credentials.passwordHash : undefined,
      emailVerified: input.credentials.provider === "microsoft",
      createdAt: nowIso()
    };
    d.users.push(user);
    audit(d, user, "USER_REGISTERED", "User", user.id, "-", "VIEWER");
    notify(d, user.id, "WELCOME", "Bienvenido a Skucy", "Tu cuenta fue creada como Viewer.");
    return user.id;
  });
}
function submitInstitutionRequest(input) {
  mutate((d) => {
    if (input.name.trim().length < 3)
      throw new Error("Escribe el nombre de la institución.");
    const domain = input.domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
      throw new Error("Dominio institucional inválido.");
    if (!input.country.trim() || !input.city.trim())
      throw new Error("Indica país y ciudad.");
    if (input.evidence.trim().length < 5)
      throw new Error("Agrega una evidencia o referencia administrativa.");
    if (findInstitutionByDomain(d, domain))
      throw new Error("Esa institución ya existe, inicia sesión de nuevo.");
    if (d.institutionRequests.some((r) => r.domain === domain && r.status === "PENDING")) {
      throw new Error("Ya hay una solicitud pendiente para este dominio.");
    }
    d.institutionRequests.unshift({
      id: uid("ir"),
      requesterEmail: input.requesterEmail,
      requesterName: input.requesterName.trim() || input.requesterEmail,
      name: input.name.trim(),
      domain,
      country: input.country.trim(),
      city: input.city.trim(),
      evidence: input.evidence.trim(),
      status: "PENDING",
      createdAt: nowIso()
    });
  });
}
function reviewInstitutionRequest(id, approve, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:institution_requests");
    const req = d.institutionRequests.find((r) => r.id === id);
    if (!req)
      throw new Error("Solicitud no encontrada.");
    if (req.status !== "PENDING")
      throw new Error("La solicitud ya fue resuelta.");
    if (!approve)
      mustHaveReason(reason);
    const before = req.status;
    req.status = approve ? "APPROVED" : "REJECTED";
    req.reviewedBy = actor.id;
    req.reason = reason?.trim();
    if (approve) {
      d.institutions.push({
        id: uid("inst"),
        name: req.name,
        city: req.city,
        country: req.country,
        domains: [req.domain]
      });
    }
    audit(d, actor, approve ? "INSTITUTION_APPROVED" : "INSTITUTION_REJECTED", "InstitutionRequest", id, before, req.status, reason ?? "");
  });
}
function updateProfile(patch) {
  mutate((d) => {
    const user = requirePerm(d, "profile:edit_own");
    const me = d.users.find((u) => u.id === user.id);
    if (patch.name.trim().length < 3)
      throw new Error("Escribe tu nombre completo.");
    if (!me.institutionId) {
      me.name = patch.name.trim();
      me.bio = patch.bio.trim();
      return;
    }
    const degree = d.degrees.find((x) => x.id === patch.degreeId);
    if (!degree || degree.institutionId !== me.institutionId)
      throw new Error("Carrera inválida para tu institución.");
    if (patch.semester < 1 || patch.semester > degree.semesters)
      throw new Error(`Semestre entre 1 y ${degree.semesters}.`);
    me.name = patch.name.trim();
    me.bio = patch.bio.trim();
    me.semester = patch.semester;
    if (me.degreeId !== degree.id) {
      me.degreeId = degree.id;
      me.facultyId = degree.facultyId;
      me.communityIds = [`com_${degree.id}`, ...me.communityIds.slice(1).filter((c) => c !== `com_${degree.id}`)];
    }
  });
}
function setAvatar(avatar) {
  mutate((d) => {
    const user = requirePerm(d, "profile:edit_own");
    const me = d.users.find((u) => u.id === user.id);
    me.avatarUrl = avatar?.url;
    me.avatarPath = avatar?.path;
  });
}
function toggleCommunity(communityId) {
  mutate((d) => {
    const user = requirePerm(d, "community:join");
    const me = d.users.find((u) => u.id === user.id);
    if (!d.communities.some((c) => c.id === communityId))
      throw new Error("Comunidad no encontrada.");
    if (me.communityIds[0] === communityId)
      throw new Error("Es tu comunidad principal.");
    me.communityIds = me.communityIds.includes(communityId) ? me.communityIds.filter((c) => c !== communityId) : [...me.communityIds, communityId];
  });
}
function followUser(targetId) {
  mutate((d) => {
    const me = requirePerm(d, "follow:manage");
    if (me.id === targetId)
      throw new Error("No puedes seguirte a ti mismo.");
    const target = userById(d, targetId);
    if (!target)
      throw new Error("Perfil no encontrado.");
    if (d.follows.some((f) => f.followerId === me.id && f.followingId === targetId))
      return;
    d.follows.push({ followerId: me.id, followingId: targetId, createdAt: nowIso() });
    notify(d, targetId, "FOLLOW", "Nuevo seguidor", `${me.name} empezó a seguirte.`);
  });
}
function unfollowUser(targetId) {
  mutate((d) => {
    const me = requirePerm(d, "follow:manage");
    d.follows = d.follows.filter((f) => !(f.followerId === me.id && f.followingId === targetId));
  });
}
function toggleSave(contentId) {
  return mutate((d) => {
    const me = requirePerm(d, "content:save");
    const content = d.contents.find((c) => c.id === contentId);
    if (!content)
      throw new Error("Contenido no encontrado.");
    const idx = d.saved.findIndex((s) => s.userId === me.id && s.contentId === contentId);
    if (idx >= 0) {
      d.saved.splice(idx, 1);
      content.saves = Math.max(0, content.saves - 1);
      return false;
    }
    d.saved.push({ userId: me.id, contentId });
    content.saves += 1;
    return true;
  });
}
function submitCreatorApplication(input) {
  mutate((d) => {
    const me = requirePerm(d, "creator:apply");
    if (hasRole(me, "CREATOR"))
      throw new Error("Ya eres creator.");
    const last = latestApplication(d, me.id);
    if (last && (last.status === "SUBMITTED" || last.status === "UNDER_REVIEW")) {
      throw new Error("Ya tienes una solicitud en revisión.");
    }
    if (me.name.trim().length < 3 || me.bio.trim().length < 10) {
      throw new Error("Completa tu perfil (nombre y biografía de al menos 10 caracteres) antes de aplicar.");
    }
    if (input.communityIds.length === 0)
      throw new Error("Elige al menos una comunidad.");
    if (input.subjectsText.trim().length < 3)
      throw new Error("Indica las materias o áreas que cubrirás.");
    if (input.experience.trim().length < 20)
      throw new Error("Describe tu experiencia (mínimo 20 caracteres).");
    if (!input.acceptedTerms)
      throw new Error("Debes aceptar los términos de publicación.");
    d.applications.push({
      id: uid("app"),
      userId: me.id,
      status: "SUBMITTED",
      communityIds: input.communityIds,
      subjectsText: input.subjectsText.trim(),
      experience: input.experience.trim(),
      links: input.links.trim(),
      acceptedTerms: true,
      history: [{ status: "SUBMITTED", actorId: me.id, at: nowIso() }],
      createdAt: nowIso()
    });
    audit(d, me, "CREATOR_APPLICATION_SUBMITTED", "CreatorApplication", me.id, "-", "SUBMITTED");
  });
}
function reviewCreatorApplication(applicationId, decision, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:creator_apps");
    const app = d.applications.find((a) => a.id === applicationId);
    if (!app)
      throw new Error("Solicitud no encontrada.");
    if (app.userId === actor.id)
      throw new Error("No puedes resolver tu propia solicitud.");
    if (app.status !== "SUBMITTED" && app.status !== "UNDER_REVIEW")
      throw new Error("La solicitud ya fue resuelta.");
    if (decision === "REJECTED")
      mustHaveReason(reason);
    const before = app.status;
    app.status = decision;
    app.history.push({ status: decision, actorId: actor.id, reason: reason?.trim(), at: nowIso() });
    const applicant = d.users.find((u) => u.id === app.userId);
    if (decision === "APPROVED" && !applicant.roles.includes("CREATOR"))
      applicant.roles.push("CREATOR");
    if (decision !== "UNDER_REVIEW") {
      notify(d, applicant.id, "CREATOR_DECISION", decision === "APPROVED" ? "¡Ahora eres creator!" : "Solicitud de creator rechazada", decision === "APPROVED" ? "Ya puedes crear y enviar contenido a revisión." : `Motivo: ${reason?.trim()}`);
    }
    audit(d, actor, `CREATOR_APPLICATION_${decision}`, "CreatorApplication", app.id, before, decision, reason ?? "");
  });
}
function suspendCreator(userId, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:suspend_user");
    const app = latestApplication(d, userId);
    const target = d.users.find((u) => u.id === userId);
    if (!target || !hasRole(target, "CREATOR") || !app || app.status !== "APPROVED") {
      throw new Error("El usuario no es un creator activo.");
    }
    if (hasRole(target, "ADMIN") || hasRole(target, "MODERATOR") && !hasRole(actor, "ADMIN")) {
      throw new Error("No puedes suspender a un usuario con rol de moderación.");
    }
    const r = mustHaveReason(reason);
    app.status = "SUSPENDED";
    app.history.push({ status: "SUSPENDED", actorId: actor.id, reason: r, at: nowIso() });
    notify(d, userId, "CREATOR_SUSPENDED", "Cuenta de creator suspendida", `Motivo: ${r}`);
    audit(d, actor, "CREATOR_SUSPENDED", "User", userId, "APPROVED", "SUSPENDED", r);
  });
}
function reactivateCreator(userId, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:suspend_user");
    const app = latestApplication(d, userId);
    if (!app || app.status !== "SUSPENDED")
      throw new Error("El creator no está suspendido.");
    const r = mustHaveReason(reason);
    app.status = "APPROVED";
    app.history.push({ status: "APPROVED", actorId: actor.id, reason: r, at: nowIso() });
    notify(d, userId, "CREATOR_REACTIVATED", "Cuenta de creator reactivada", "Ya puedes volver a publicar.");
    audit(d, actor, "CREATOR_REACTIVATED", "User", userId, "SUSPENDED", "APPROVED", r);
  });
}
function assertCanPublish(d, user) {
  if (!can(user, "content:create"))
    throw new Error("Solo los creators pueden crear contenido.");
  if (isCreatorSuspended(d, user.id))
    throw new Error("Tu cuenta de creator está suspendida.");
}
function saveContent(input, id) {
  return mutate((d) => {
    const me = requireUser(d);
    assertCanPublish(d, me);
    if (input.title.trim().length < 4)
      throw new Error("El título debe tener al menos 4 caracteres.");
    if (input.description.trim().length < 10)
      throw new Error("La descripción debe tener al menos 10 caracteres.");
    const subject = d.subjects.find((s) => s.id === input.subjectId);
    if (!subject)
      throw new Error("Selecciona una materia.");
    const community = d.communities.find((c) => c.id === input.communityId);
    if (!community || community.degreeId !== subject.degreeId) {
      throw new Error("La comunidad debe corresponder a la carrera de la materia.");
    }
    const fields = {
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      subjectId: subject.id,
      degreeId: subject.degreeId,
      semester: subject.semester,
      communityId: community.id,
      tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
      visibility: input.visibility,
      priceLabel: input.visibility === "PAID" ? input.priceLabel?.trim() || "Precio por definir" : undefined,
      updatedAt: nowIso()
    };
    if (id) {
      const c = d.contents.find((x) => x.id === id);
      if (!c || c.creatorId !== me.id)
        throw new Error("Contenido no encontrado.");
      if (c.status !== "DRAFT" && c.status !== "REJECTED")
        throw new Error("Solo se edita en borrador o rechazado.");
      Object.assign(c, fields);
      return c.id;
    }
    const content = {
      id: uid("c"),
      creatorId: me.id,
      status: "DRAFT",
      views: 0,
      saves: 0,
      reportsCount: 0,
      createdAt: nowIso(),
      ...fields
    };
    d.contents.unshift(content);
    return content.id;
  });
}
function submitForReview(id) {
  mutate((d) => {
    const me = requirePerm(d, "content:submit");
    assertCanPublish(d, me);
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.creatorId !== me.id)
      throw new Error("Contenido no encontrado.");
    if (c.status !== "DRAFT" && c.status !== "REJECTED")
      throw new Error("Este contenido no se puede enviar a revisión.");
    if (c.type === "VIDEO" && !c.videoPath)
      throw new Error("Sube el video antes de enviar a revisión.");
    c.status = "PROCESSING";
    c.rejectionReason = undefined;
    c.updatedAt = nowIso();
  });
}
function finishProcessing(id, result) {
  mutate((d) => {
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.status !== "PROCESSING")
      return;
    c.updatedAt = nowIso();
    if (result.ok) {
      c.status = "PENDING_REVIEW";
      notify(d, c.creatorId, "CONTENT_PROCESSED", "Contenido procesado", `"${c.title}" está en revisión.`);
    } else {
      c.status = "REJECTED";
      c.rejectionReason = result.error ?? "No se pudo procesar el video.";
      notify(d, c.creatorId, "CONTENT_FAILED", "No se pudo procesar tu contenido", c.rejectionReason);
    }
  });
}
function editableOwnContent(id) {
  const db = getState();
  const me = sessionUser(db);
  if (!me)
    throw new Error("Debes iniciar sesión para hacer esto.");
  assertCanPublish(db, me);
  const c = db.contents.find((x) => x.id === id);
  if (!c || c.creatorId !== me.id)
    throw new Error("Contenido no encontrado.");
  if (c.status !== "DRAFT" && c.status !== "REJECTED")
    throw new Error("Solo se edita en borrador o rechazado.");
  return c;
}
function attachVideo(id, video) {
  mutate((d) => {
    const me = requirePerm(d, "content:create");
    const c = d.contents.find((x) => x.id === id && x.creatorId === me.id);
    if (!c)
      throw new Error("Contenido no encontrado.");
    if (c.status !== "DRAFT" && c.status !== "REJECTED")
      throw new Error("Solo se edita en borrador o rechazado.");
    c.videoPath = video.path;
    c.videoMime = video.mime;
    c.videoSizeBytes = video.sizeBytes;
    c.updatedAt = nowIso();
  });
}
function attachThumbnail(id, thumb) {
  mutate((d) => {
    const me = requirePerm(d, "content:create");
    const c = d.contents.find((x) => x.id === id && x.creatorId === me.id);
    if (!c)
      throw new Error("Contenido no encontrado.");
    if (c.status !== "DRAFT" && c.status !== "REJECTED")
      throw new Error("Solo se edita en borrador o rechazado.");
    c.thumbnailPath = thumb.path;
    c.thumbnailUrl = thumb.url;
    c.updatedAt = nowIso();
  });
}
function moderateContent(id, decision, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:content");
    const c = d.contents.find((x) => x.id === id);
    if (!c)
      throw new Error("Contenido no encontrado.");
    if (c.creatorId === actor.id)
      throw new Error("No puedes moderar tu propio contenido.");
    if ((decision === "APPROVED" || decision === "REJECTED") && c.status !== "PENDING_REVIEW") {
      throw new Error("Solo se aprueba o rechaza contenido en revisión.");
    }
    if (decision === "REJECTED" || decision === "REMOVED")
      mustHaveReason(reason);
    const before = c.status;
    c.status = decision;
    c.rejectionReason = decision === "REJECTED" || decision === "REMOVED" ? reason?.trim() : undefined;
    c.updatedAt = nowIso();
    const message = {
      APPROVED: `"${c.title}" fue aprobado. Ya puedes publicarlo.`,
      REJECTED: `"${c.title}" fue rechazado. Motivo: ${reason?.trim()}`,
      ARCHIVED: `"${c.title}" fue archivado por moderación.`,
      REMOVED: `"${c.title}" fue retirado. Motivo: ${reason?.trim()}`
    };
    notify(d, c.creatorId, "MODERATION", "Decisión de moderación", message[decision]);
    audit(d, actor, `CONTENT_${decision}`, "Content", c.id, before, decision, reason ?? "");
  });
}
function publishContent(id) {
  mutate((d) => {
    const me = requireUser(d);
    assertCanPublish(d, me);
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.creatorId !== me.id)
      throw new Error("Contenido no encontrado.");
    if (c.status !== "APPROVED")
      throw new Error("Solo el contenido aprobado puede publicarse.");
    c.status = "PUBLISHED";
    c.publishedAt = nowIso();
    c.updatedAt = nowIso();
    d.follows.filter((f) => f.followingId === me.id).forEach((f) => notify(d, f.followerId, "CONTENT", "Nuevo contenido", `${me.name} publicó "${c.title}".`));
  });
}
function archiveOwnContent(id) {
  mutate((d) => {
    const me = requireUser(d);
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.creatorId !== me.id)
      throw new Error("Contenido no encontrado.");
    if (c.status !== "PUBLISHED" && c.status !== "APPROVED")
      throw new Error("No se puede archivar en este estado.");
    c.status = "ARCHIVED";
    c.updatedAt = nowIso();
  });
}
function recordView(contentId) {
  const db = getState();
  const c = db.contents.find((x) => x.id === contentId);
  const viewer = sessionUser(db);
  if (!c || c.status !== "PUBLISHED" || !contentAccess(db, c, viewer).ok)
    return;
  if (viewer && viewer.id === c.creatorId)
    return;
  mutate((d) => {
    const content = d.contents.find((x) => x.id === contentId);
    content.views += 1;
    if (viewer && !d.views.some((v) => v.userId === viewer.id && v.contentId === contentId)) {
      d.views.push({ userId: viewer.id, contentId, creatorId: content.creatorId, at: nowIso() });
    }
  });
}
function upsertRating(creatorId, stars, sub, comment) {
  mutate((d) => {
    const me = requirePerm(d, "rating:create");
    const eligibility = ratingEligibility(d, me, creatorId);
    if (!eligibility.ok)
      throw new Error(eligibility.reason);
    const valid = (n) => Number.isInteger(n) && n >= 1 && n <= 5;
    if (!valid(stars))
      throw new Error("La calificación debe ser de 1 a 5 estrellas.");
    Object.keys(sub).forEach((k) => {
      if (sub[k] !== undefined && !valid(sub[k]))
        throw new Error("Las subcalificaciones deben ser de 1 a 5.");
    });
    const existing = d.ratings.find((r) => r.viewerId === me.id && r.creatorId === creatorId);
    if (existing) {
      existing.stars = stars;
      existing.sub = sub;
      existing.comment = comment?.trim() || undefined;
      existing.updatedAt = nowIso();
    } else {
      d.ratings.push({
        id: uid("r"),
        viewerId: me.id,
        creatorId,
        stars,
        sub,
        comment: comment?.trim() || undefined,
        hidden: false,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      notify(d, creatorId, "RATING", "Nueva calificación", `${me.name} te calificó con ${stars} estrella(s).`);
    }
  });
}
function deleteMyRating(creatorId) {
  mutate((d) => {
    const me = requirePerm(d, "rating:create");
    d.ratings = d.ratings.filter((r) => !(r.viewerId === me.id && r.creatorId === creatorId));
  });
}
function setRatingHidden(ratingId, hidden, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:hide_rating");
    const r = d.ratings.find((x) => x.id === ratingId);
    if (!r)
      throw new Error("Calificación no encontrada.");
    const why = mustHaveReason(reason);
    const before = r.hidden ? "HIDDEN" : "VISIBLE";
    r.hidden = hidden;
    audit(d, actor, hidden ? "RATING_HIDDEN" : "RATING_RESTORED", "Rating", r.id, before, hidden ? "HIDDEN" : "VISIBLE", why);
  });
}
function createReport(targetType, targetId, reason) {
  mutate((d) => {
    const me = requirePerm(d, "report:create");
    if (reason.trim().length < 10)
      throw new Error("Describe el motivo con al menos 10 caracteres.");
    if (targetType === "USER") {
      if (targetId === me.id)
        throw new Error("No puedes reportarte a ti mismo.");
      if (!userById(d, targetId))
        throw new Error("Usuario no encontrado.");
    } else {
      const c = d.contents.find((x) => x.id === targetId);
      if (!c)
        throw new Error("Contenido no encontrado.");
      if (c.creatorId === me.id)
        throw new Error("No puedes reportar tu propio contenido.");
      c.reportsCount += 1;
    }
    if (d.reports.some((r) => r.reporterId === me.id && r.targetId === targetId && r.status === "OPEN")) {
      throw new Error("Ya reportaste este elemento.");
    }
    d.reports.unshift({
      id: uid("rep"),
      reporterId: me.id,
      targetType,
      targetId,
      reason: reason.trim(),
      status: "OPEN",
      createdAt: nowIso()
    });
  });
}
function resolveReport(id, status, resolution) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:reports");
    const r = d.reports.find((x) => x.id === id);
    if (!r)
      throw new Error("Reporte no encontrado.");
    if (r.status !== "OPEN")
      throw new Error("El reporte ya fue resuelto.");
    const why = mustHaveReason(resolution);
    r.status = status;
    r.resolution = why;
    notify(d, r.reporterId, "REPORT", "Tu reporte fue revisado", why);
    audit(d, actor, `REPORT_${status}`, "Report", r.id, "OPEN", status, why);
  });
}
function markNotificationRead(id) {
  mutate((d) => {
    const me = requirePerm(d, "notification:read");
    const n = d.notifications.find((x) => x.id === id && x.userId === me.id);
    if (n)
      n.read = true;
  });
}
function markAllNotificationsRead() {
  mutate((d) => {
    const me = requirePerm(d, "notification:read");
    d.notifications.forEach((n) => {
      if (n.userId === me.id)
        n.read = true;
    });
  });
}
function setAccountStatus(userId, status, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "moderation:suspend_user");
    const target = userById(d, userId);
    if (!target)
      throw new Error("Usuario no encontrado.");
    if (target.id === actor.id)
      throw new Error("No puedes cambiar el estado de tu propia cuenta.");
    const isAdmin = hasRole(actor, "ADMIN");
    const targetIsStaff = hasRole(target, "MODERATOR") || hasRole(target, "ADMIN");
    if (targetIsStaff && !isAdmin)
      throw new Error("Solo un administrador puede modificar cuentas de moderación.");
    if ((status === "BANNED" || target.status === "BANNED") && !isAdmin) {
      throw new Error("Solo un administrador puede banear o reactivar cuentas baneadas.");
    }
    const why = mustHaveReason(reason);
    const before = target.status;
    target.status = status;
    target.statusReason = status === "ACTIVE" ? undefined : why;
    notify(d, userId, "ACCOUNT", "Estado de tu cuenta", status === "ACTIVE" ? "Tu cuenta fue reactivada." : `Tu cuenta quedó ${status}. Motivo: ${why}`);
    audit(d, actor, "ACCOUNT_STATUS_CHANGED", "User", userId, before, status, why);
  });
}
function setUserRole(userId, role, grant, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "admin:roles");
    const target = userById(d, userId);
    if (!target)
      throw new Error("Usuario no encontrado.");
    const why = mustHaveReason(reason);
    if (!grant && target.id === actor.id && role === "ADMIN")
      throw new Error("No puedes quitarte el rol de administrador.");
    const before = target.roles.join(",");
    if (grant && !target.roles.includes(role))
      target.roles.push(role);
    if (!grant)
      target.roles = target.roles.filter((r) => r !== role);
    audit(d, actor, grant ? "ROLE_GRANTED" : "ROLE_REVOKED", "User", userId, before, target.roles.join(","), `${role}: ${why}`);
  });
}
function setVerification(userId, value, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "admin:verification");
    const target = userById(d, userId);
    if (!target)
      throw new Error("Usuario no encontrado.");
    const why = mustHaveReason(reason);
    const before = String(target.verifiedOverride);
    target.verifiedOverride = value;
    audit(d, actor, "VERIFICATION_CHANGED", "User", userId, before, String(value), why);
  });
}
function updateSettings(patch) {
  mutate((d) => {
    const actor = requirePerm(d, "admin:settings");
    if (!Number.isInteger(patch.verificationThreshold) || patch.verificationThreshold < 1) {
      throw new Error("El umbral de verificación debe ser un entero positivo.");
    }
    if (!Number.isInteger(patch.minFollowDaysToRate) || patch.minFollowDaysToRate < 0) {
      throw new Error("Los días mínimos deben ser un entero mayor o igual a 0.");
    }
    const before = JSON.stringify(d.settings);
    d.settings = { ...patch };
    audit(d, actor, "SETTINGS_UPDATED", "Settings", "global", before, JSON.stringify(d.settings), "Cambio de configuración");
  });
}
function softDeleteUser(userId, reason) {
  mutate((d) => {
    const actor = requirePerm(d, "admin:users");
    const target = userById(d, userId);
    if (!target)
      throw new Error("Usuario no encontrado.");
    if (target.id === actor.id)
      throw new Error("No puedes eliminar tu propia cuenta.");
    const why = mustHaveReason(reason);
    target.deletedAt = nowIso();
    audit(d, actor, "USER_SOFT_DELETED", "User", userId, "ACTIVE", "DELETED", why);
  });
}
var DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;
function createInstitution(input) {
  return mutate((d) => {
    const actor = requirePerm(d, "admin:catalog");
    const name = input.name.trim();
    if (name.length < 3)
      throw new Error("Escribe el nombre de la institución.");
    if (!input.city.trim() || !input.country.trim())
      throw new Error("Indica país y ciudad.");
    const domains = Array.from(new Set(input.domains.map((x) => x.trim().toLowerCase()).filter(Boolean)));
    if (domains.length === 0)
      throw new Error("Agrega al menos un dominio institucional.");
    for (const domain of domains) {
      if (!DOMAIN_RE.test(domain))
        throw new Error(`Dominio inválido: ${domain}`);
      if (findInstitutionByDomain(d, domain))
        throw new Error(`El dominio ${domain} ya pertenece a otra institución.`);
    }
    const inst = { id: uid("inst"), name, city: input.city.trim(), country: input.country.trim(), domains };
    d.institutions.push(inst);
    audit(d, actor, "INSTITUTION_CREATED", "Institution", inst.id, "-", name);
    return inst.id;
  });
}
function createFaculty(input) {
  return mutate((d) => {
    const actor = requirePerm(d, "admin:catalog");
    if (!d.institutions.some((i) => i.id === input.institutionId))
      throw new Error("Institución no encontrada.");
    const name = input.name.trim();
    if (name.length < 3)
      throw new Error("Escribe el nombre de la facultad.");
    if (d.faculties.some((f) => f.institutionId === input.institutionId && f.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ya existe una facultad con ese nombre.");
    }
    const fac = { id: uid("fac"), institutionId: input.institutionId, name };
    d.faculties.push(fac);
    audit(d, actor, "FACULTY_CREATED", "Faculty", fac.id, "-", name);
    return fac.id;
  });
}
function createDegree(input) {
  return mutate((d) => {
    const actor = requirePerm(d, "admin:catalog");
    const faculty = d.faculties.find((f) => f.id === input.facultyId);
    if (!faculty)
      throw new Error("Facultad no encontrada.");
    const name = input.name.trim();
    if (name.length < 3)
      throw new Error("Escribe el nombre de la carrera.");
    if (!Number.isInteger(input.semesters) || input.semesters < 1 || input.semesters > 20) {
      throw new Error("Los semestres deben ser un entero entre 1 y 20.");
    }
    if (d.degrees.some((x) => x.facultyId === faculty.id && x.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ya existe una carrera con ese nombre en la facultad.");
    }
    const institution = d.institutions.find((i) => i.id === faculty.institutionId);
    const degree = {
      id: uid("deg"),
      institutionId: faculty.institutionId,
      facultyId: faculty.id,
      name,
      description: input.description.trim(),
      semesters: input.semesters
    };
    d.degrees.push(degree);
    d.communities.push({
      id: `com_${degree.id}`,
      institutionId: faculty.institutionId,
      facultyId: faculty.id,
      degreeId: degree.id,
      name: `${name} · ${institution.name}`
    });
    audit(d, actor, "DEGREE_CREATED", "Degree", degree.id, "-", name);
    return degree.id;
  });
}
function createSubject(input) {
  return mutate((d) => {
    const actor = requirePerm(d, "admin:catalog");
    const degree = d.degrees.find((x) => x.id === input.degreeId);
    if (!degree)
      throw new Error("Carrera no encontrada.");
    if (!Number.isInteger(input.semester) || input.semester < 1 || input.semester > degree.semesters) {
      throw new Error(`El semestre debe estar entre 1 y ${degree.semesters}.`);
    }
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (code.length < 2)
      throw new Error("Escribe el código de la materia.");
    if (name.length < 3)
      throw new Error("Escribe el nombre de la materia.");
    if (d.subjects.some((s) => s.degreeId === degree.id && s.code === code)) {
      throw new Error("Ya existe una materia con ese código en la carrera.");
    }
    const credits = input.credits === undefined || Number.isNaN(input.credits) ? undefined : input.credits;
    if (credits !== undefined && (!Number.isInteger(credits) || credits < 0 || credits > 30)) {
      throw new Error("Los créditos deben ser un entero entre 0 y 30.");
    }
    const subject = {
      id: uid("sub"),
      degreeId: degree.id,
      semester: input.semester,
      code,
      name,
      description: input.description.trim(),
      credits,
      active: true
    };
    d.subjects.push(subject);
    audit(d, actor, "SUBJECT_CREATED", "Subject", subject.id, "-", `${code} ${name}`);
    return subject.id;
  });
}
function deleteCatalogItem(kind, id) {
  mutate((d) => {
    const actor = requirePerm(d, "admin:catalog");
    if (kind === "institution") {
      const inst = d.institutions.find((i) => i.id === id);
      if (!inst)
        throw new Error("Institución no encontrada.");
      if (d.faculties.some((f) => f.institutionId === id) || d.users.some((u) => u.institutionId === id)) {
        throw new Error("La institución tiene facultades o usuarios: no se puede eliminar.");
      }
      d.institutions = d.institutions.filter((i) => i.id !== id);
      audit(d, actor, "INSTITUTION_DELETED", "Institution", id, inst.name, "-");
    } else if (kind === "faculty") {
      const fac = d.faculties.find((f) => f.id === id);
      if (!fac)
        throw new Error("Facultad no encontrada.");
      if (d.degrees.some((x) => x.facultyId === id))
        throw new Error("La facultad tiene carreras: no se puede eliminar.");
      d.faculties = d.faculties.filter((f) => f.id !== id);
      audit(d, actor, "FACULTY_DELETED", "Faculty", id, fac.name, "-");
    } else if (kind === "degree") {
      const deg = d.degrees.find((x) => x.id === id);
      if (!deg)
        throw new Error("Carrera no encontrada.");
      if (d.subjects.some((s) => s.degreeId === id))
        throw new Error("La carrera tiene materias: elimínalas primero.");
      if (d.users.some((u) => u.degreeId === id) || d.contents.some((c) => c.degreeId === id)) {
        throw new Error("La carrera tiene usuarios o contenido: no se puede eliminar.");
      }
      d.degrees = d.degrees.filter((x) => x.id !== id);
      d.communities = d.communities.filter((c) => c.degreeId !== id);
      d.users.forEach((u) => {
        u.communityIds = u.communityIds.filter((c) => c !== `com_${id}`);
      });
      audit(d, actor, "DEGREE_DELETED", "Degree", id, deg.name, "-");
    } else {
      const sub = d.subjects.find((s) => s.id === id);
      if (!sub)
        throw new Error("Materia no encontrada.");
      if (d.contents.some((c) => c.subjectId === id))
        throw new Error("La materia tiene contenido: no se puede eliminar.");
      d.subjects = d.subjects.filter((s) => s.id !== id);
      audit(d, actor, "SUBJECT_DELETED", "Subject", id, `${sub.code} ${sub.name}`, "-");
    }
  });
}

// supabase/fn-src/tokens.ts
import { Buffer } from "node:buffer";
import { createHash, createHmac as createHmac2, timingSafeEqual } from "node:crypto";
var b64 = (input) => Buffer.from(input).toString("base64url");
function signToken(payload, ttlSeconds, secret) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = createHmac2("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyToken(token, secret) {
  const [body, sig] = token.split(".");
  if (!body || !sig)
    return null;
  const expected = createHmac2("sha256", secret).update(body).digest();
  let given;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000))
      return null;
    return payload;
  } catch {
    return null;
  }
}
var hashToken = (token) => createHash("sha256").update(token).digest("hex");

// supabase/fn-src/microsoft.ts
var PERSONAL_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";
var JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys";
var NONCE_TTL_SECONDS = 10 * 60;
var MAX_TOKEN_AGE_SECONDS = 15 * 60;
var CLOCK_SKEW_SECONDS = 120;
var msDeps = { fetch: (url) => fetch(url) };
function secret() {
  const value = env("JWT_SECRET");
  if (!value || value.length < 16)
    throw new HttpError(500, "Falta el secreto JWT_SECRET en la función.");
  return value;
}
function clientId() {
  return env("MS_CLIENT_ID");
}
function microsoftConfig() {
  const id = clientId();
  return {
    enabled: !!id,
    clientId: id ?? "",
    authorizeUrl: "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
    nonce: signToken({ typ: "nonce" }, NONCE_TTL_SECONDS, secret())
  };
}
var b64urlJson = (part) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
var b64urlBytes = (part) => Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
var jwks = null;
async function signingKey(kid) {
  const find = () => jwks?.keys.find((k) => k.kid === kid);
  if (!jwks || Date.now() - jwks.at > 60 * 60 * 1000 || !find()) {
    const res = await msDeps.fetch(JWKS_URL);
    if (!res.ok)
      throw new HttpError(502, "No se pudieron obtener las claves de Microsoft. Intenta de nuevo.");
    jwks = { keys: (await res.json()).keys ?? [], at: Date.now() };
  }
  const jwk = find();
  if (!jwk)
    throw new HttpError(401, "Token de Microsoft inválido.");
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}
async function verifyMicrosoftIdToken(idToken) {
  const audience = clientId();
  if (!audience)
    throw new HttpError(503, "El inicio de sesión con Microsoft no está configurado (falta MS_CLIENT_ID).");
  const invalid = () => new HttpError(401, "No se pudo verificar tu cuenta de Microsoft. Intenta de nuevo.");
  if (typeof idToken !== "string")
    throw invalid();
  const parts = idToken.split(".");
  if (parts.length !== 3)
    throw invalid();
  let header;
  let claims;
  try {
    header = b64urlJson(parts[0]);
    claims = b64urlJson(parts[1]);
  } catch {
    throw invalid();
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string")
    throw invalid();
  const key = await signingKey(header.kid);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid)
    throw invalid();
  const now = Math.floor(Date.now() / 1000);
  const issuer = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i.exec(String(claims.iss ?? ""));
  if (!issuer || String(claims.tid ?? "").toLowerCase() !== issuer[1].toLowerCase())
    throw invalid();
  if (claims.aud !== audience)
    throw invalid();
  if (typeof claims.exp !== "number" || claims.exp < now - CLOCK_SKEW_SECONDS)
    throw invalid();
  if (typeof claims.nbf === "number" && claims.nbf > now + CLOCK_SKEW_SECONDS)
    throw invalid();
  if (typeof claims.iat !== "number" || now - claims.iat > MAX_TOKEN_AGE_SECONDS) {
    throw new HttpError(401, "La sesión de Microsoft expiró. Intenta de nuevo.");
  }
  const nonce = verifyToken(String(claims.nonce ?? ""), secret());
  if (!nonce || nonce.typ !== "nonce")
    throw new HttpError(401, "La sesión de Microsoft expiró. Intenta de nuevo.");
  const tid = String(claims.tid).toLowerCase();
  if (tid === PERSONAL_TENANT) {
    throw new HttpError(403, "Solo se permiten cuentas institucionales de Microsoft 365 (no cuentas personales).");
  }
  if (typeof claims.oid !== "string" || !claims.oid)
    throw invalid();
  const email = String(claims.preferred_username ?? claims.email ?? claims.upn ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Tu cuenta de Microsoft no tiene un correo asociado.");
  }
  return { email, name: String(claims.name ?? "").trim(), msKey: `${tid}:${String(claims.oid).toLowerCase()}` };
}

// supabase/fn-src/auth.ts
var ACCESS_TTL_SECONDS = 15 * 60;
var REFRESH_TTL_DAYS = 30;
var REGISTRATION_TTL_SECONDS = 10 * 60;
var EMAIL_RE3 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_FAILED_LOGINS = 5;
var LOCK_MINUTES = 15;
function secret2() {
  const value = env("JWT_SECRET");
  if (!value || value.length < 16) {
    throw new HttpError(500, "Falta el secreto JWT_SECRET en la función (supabase secrets set JWT_SECRET=...).");
  }
  return value;
}
function activeUserByEmail(email) {
  return readRaw().users.find((u) => u.email === email && !u.deletedAt);
}
function assertNotBanned(status) {
  if (status === "BANNED")
    throw new HttpError(403, "Tu cuenta fue bloqueada. Contacta a un administrador.");
}
function registrationResponse(email, institutionId, ms, name) {
  const registrationToken = signToken({ typ: "registration", email, institutionId, ...ms ? { ms } : {} }, REGISTRATION_TTL_SECONDS, secret2());
  return { kind: "register", email, institutionId, registrationToken, name, method: ms ? "microsoft" : "password" };
}
async function microsoftLogin(body) {
  const identity = await verifyMicrosoftIdToken(body?.idToken);
  const users = readRaw().users;
  const linked = users.find((u) => u.msKey === identity.msKey && !u.deletedAt);
  if (linked) {
    assertNotBanned(linked.status);
    return { kind: "ok", ...issueTokens(linked.id) };
  }
  const existing = activeUserByEmail(identity.email);
  if (existing) {
    if (existing.msKey)
      throw new HttpError(403, "Este correo ya está vinculado a otra cuenta de Microsoft.");
    const plain = existing.roles.length === 1 && existing.roles[0] === "VIEWER";
    if (!plain) {
      throw new HttpError(403, "Esta cuenta tiene permisos especiales: entra con tu correo y contraseña.");
    }
    assertNotBanned(existing.status);
    mutateServer((d) => {
      const u = d.users.find((x) => x.id === existing.id);
      u.msKey = identity.msKey;
      u.authProvider = "microsoft";
      u.emailVerified = true;
      u.passwordHash = undefined;
      u.failedLogins = 0;
      u.lockedUntil = undefined;
      d.refreshTokens.forEach((t) => {
        if (t.userId === u.id && !t.revokedAt)
          t.revokedAt = new Date().toISOString();
      });
    });
    return { kind: "ok", ...issueTokens(existing.id) };
  }
  const check = checkInstitutionalEmail(identity.email);
  if (!check.institutionId)
    return { kind: "institution_request", email: check.email, domain: check.domain };
  return registrationResponse(check.email, check.institutionId, identity.msKey, identity.name || undefined);
}
async function passwordLogin(body) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!EMAIL_RE3.test(email))
    throw new HttpError(400, "Ingresa un correo válido.");
  if (!password)
    throw new HttpError(400, "Ingresa tu contraseña.");
  const generic = new HttpError(401, "Correo o contraseña incorrectos.");
  const user = activeUserByEmail(email);
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(password);
    if (user?.msKey)
      throw new HttpError(401, "Esta cuenta se creó con Microsoft 365. Usa el botón de Microsoft.");
    throw generic;
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} min.`);
  }
  if (!await verifyPassword(password, user.passwordHash)) {
    mutateServer((d) => {
      const u = d.users.find((x) => x.id === user.id);
      u.failedLogins = (u.failedLogins ?? 0) + 1;
      if (u.failedLogins >= MAX_FAILED_LOGINS) {
        u.failedLogins = 0;
        u.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      }
    });
    throw generic;
  }
  assertNotBanned(user.status);
  if (user.failedLogins || user.lockedUntil) {
    mutateServer((d) => {
      const u = d.users.find((x) => x.id === user.id);
      u.failedLogins = 0;
      u.lockedUntil = undefined;
    });
  }
  return { kind: "ok", ...issueTokens(user.id) };
}
function registerStart(body) {
  const check = checkInstitutionalEmail(String(body?.email ?? ""));
  if (activeUserByEmail(check.email)) {
    throw new HttpError(409, "Ya existe una cuenta con este correo. Inicia sesión.");
  }
  if (!check.institutionId)
    return { kind: "institution_request", email: check.email, domain: check.domain };
  return registrationResponse(check.email, check.institutionId);
}
async function register(body) {
  const payload = verifyToken(body.registrationToken ?? "", secret2());
  if (!payload || payload.typ !== "registration" || !payload.email || !payload.institutionId) {
    throw new HttpError(401, "La sesión de registro expiró. Vuelve a empezar.");
  }
  let credentials;
  if (payload.ms) {
    if (readRaw().users.some((u) => u.msKey === payload.ms))
      throw new HttpError(409, "Esta cuenta de Microsoft ya está registrada.");
    credentials = { provider: "microsoft", msKey: payload.ms };
  } else {
    const problem = passwordProblem(body.password);
    if (problem)
      throw new HttpError(400, problem);
    credentials = { provider: "password", passwordHash: await hashPassword(body.password) };
  }
  const userId = completeRegistration({
    email: payload.email,
    institutionId: payload.institutionId,
    name: body.name,
    bio: body.bio ?? "",
    degreeId: body.degreeId,
    semester: Number(body.semester),
    credentials
  });
  return issueTokens(userId);
}
function verifyAccess(token) {
  const payload = verifyToken(token, secret2());
  if (!payload || payload.typ !== "access" || !payload.sub)
    return null;
  const user = readRaw().users.find((u) => u.id === payload.sub);
  if (!user || user.deletedAt || user.status === "BANNED")
    return null;
  return user.id;
}
function refresh(refreshToken) {
  const hash = hashToken(refreshToken ?? "");
  const record = readRaw().refreshTokens.find((t) => t.hash === hash);
  if (!record)
    throw new HttpError(401, "Sesión inválida.");
  if (record.revokedAt) {
    revokeFamily(record.familyId);
    throw new HttpError(401, "Sesión inválida.");
  }
  if (new Date(record.expiresAt).getTime() < Date.now())
    throw new HttpError(401, "La sesión expiró.");
  const user = readRaw().users.find((u) => u.id === record.userId);
  if (!user || user.deletedAt || user.status === "BANNED")
    throw new HttpError(401, "Cuenta no disponible.");
  mutateServer((d) => {
    const r = d.refreshTokens.find((t) => t.id === record.id);
    if (r)
      r.revokedAt = new Date().toISOString();
  });
  return issueTokens(record.userId, record.familyId);
}
function logout(refreshToken) {
  const record = readRaw().refreshTokens.find((t) => t.hash === hashToken(refreshToken ?? ""));
  if (record)
    revokeFamily(record.familyId);
}
function me() {
  const user = readRaw().users.find((u) => u.id === currentActorId());
  return { id: user?.id, handle: user?.handle, name: user?.name, email: user?.email, roles: user?.roles, status: user?.status };
}
function revokeFamily(familyId) {
  mutateServer((d) => {
    const now = new Date().toISOString();
    d.refreshTokens.forEach((t) => {
      if (t.familyId === familyId && !t.revokedAt)
        t.revokedAt = now;
    });
  });
}
function issueTokens(userId, familyId) {
  const refreshToken = randomBytes(32).toString("base64url");
  mutateServer((d) => {
    const now = Date.now();
    d.refreshTokens = d.refreshTokens.filter((t) => new Date(t.expiresAt).getTime() > now);
    d.refreshTokens.push({
      id: randomBytes(8).toString("hex"),
      userId,
      familyId: familyId ?? randomBytes(8).toString("hex"),
      hash: hashToken(refreshToken),
      expiresAt: new Date(now + REFRESH_TTL_DAYS * 86400000).toISOString()
    });
  });
  return {
    accessToken: signToken({ typ: "access", sub: userId }, ACCESS_TTL_SECONDS, secret2()),
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS
  };
}

// supabase/fn-src/media.ts
var MB = 1024 * 1024;
var BUCKETS = {
  avatars: { maxBytes: 5 * MB, mimes: ["image/jpeg", "image/png", "image/webp"] },
  thumbnails: { maxBytes: 5 * MB, mimes: ["image/jpeg", "image/png", "image/webp"] },
  videos: { maxBytes: 50 * MB, mimes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"] }
};
var BUCKET_OF = { avatar: "avatars", thumbnail: "thumbnails", video: "videos" };
var EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp"
};
var SIGNED_URL_SECONDS = 60 * 60;
function bucketOf(kind) {
  if (kind !== "avatar" && kind !== "thumbnail" && kind !== "video")
    throw new HttpError(400, "Tipo de archivo inválido.");
  return { kind, bucket: BUCKET_OF[kind] };
}
function folderFor(kind, contentId) {
  const me = sessionUser(getState());
  if (!me)
    throw new HttpError(401, "Debes iniciar sesión para hacer esto.");
  if (kind === "avatar") {
    if (!can(me, "profile:edit_own"))
      throw new HttpError(403, "No tienes permiso para realizar esta acción.");
    return me.id;
  }
  if (!contentId)
    throw new HttpError(400, "Falta el contenido.");
  const content = editableOwnContent(contentId);
  return `${content.creatorId}/${content.id}`;
}
async function createUpload(client, input) {
  const { kind, bucket } = bucketOf(input.kind);
  const cfg = BUCKETS[bucket];
  const mime = (input.mime ?? "").split(";")[0].trim().toLowerCase();
  if (!cfg.mimes.includes(mime)) {
    throw new HttpError(400, `Formato no permitido. Usa: ${cfg.mimes.map((m) => m.split("/")[1]).join(", ")}.`);
  }
  if (typeof input.size === "number" && input.size > cfg.maxBytes) {
    throw new HttpError(413, `El archivo pesa ${(input.size / MB).toFixed(1)} MB y el máximo es ${cfg.maxBytes / MB} MB.`);
  }
  const folder = folderFor(kind, input.contentId);
  const path = `${folder}/${crypto.randomUUID()}.${EXT[mime]}`;
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data)
    throw new HttpError(502, `No se pudo preparar la subida en Supabase: ${error?.message ?? "sin respuesta"}`);
  return { uploadUrl: data.signedUrl, path, bucket, maxBytes: cfg.maxBytes };
}
async function objectInfo(client, bucket, path) {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const { data, error } = await client.storage.from(bucket).list(path.slice(0, slash), { limit: 20, search: name });
  if (error)
    throw new HttpError(502, `No se pudo consultar Supabase Storage: ${error.message}`);
  const file = data?.find((f) => f.name === name);
  if (!file)
    return null;
  const meta = file.metadata ?? {};
  return { size: Number(meta.size ?? 0), mime: String(meta.mimetype ?? "") };
}
function publicUrl(client, bucket, path) {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
async function remove(client, bucket, path) {
  if (!path)
    return;
  await client.storage.from(bucket).remove([path]).catch(() => {
    return;
  });
}
async function confirmUpload(client, input) {
  const { kind, bucket } = bucketOf(input.kind);
  const path = input.path ?? "";
  const folder = folderFor(kind, input.contentId);
  if (!path.startsWith(`${folder}/`) || path.includes(".."))
    throw new HttpError(403, "Ese archivo no te pertenece.");
  const info = await objectInfo(client, bucket, path);
  if (!info)
    throw new HttpError(400, "El archivo no llegó a Supabase. Intenta subirlo de nuevo.");
  const cfg = BUCKETS[bucket];
  if (info.size > cfg.maxBytes) {
    await remove(client, bucket, path);
    throw new HttpError(413, `El archivo pesa ${(info.size / MB).toFixed(1)} MB y el máximo es ${cfg.maxBytes / MB} MB.`);
  }
  if (info.mime && !cfg.mimes.includes(info.mime.toLowerCase())) {
    await remove(client, bucket, path);
    throw new HttpError(400, "Formato no permitido.");
  }
  const me = sessionUser(getState());
  if (kind === "avatar") {
    const previous = readRaw().users.find((u) => u.id === me.id)?.avatarPath;
    const url = publicUrl(client, bucket, path);
    setAvatar({ url, path });
    if (previous !== path)
      await remove(client, bucket, previous);
    return { avatarUrl: url };
  }
  const content = editableOwnContent(input.contentId);
  if (kind === "thumbnail") {
    const previous = content.thumbnailPath;
    const url = publicUrl(client, bucket, path);
    attachThumbnail(content.id, { path, url });
    if (previous !== path)
      await remove(client, bucket, previous);
    return { thumbnailUrl: url };
  }
  const previous = content.videoPath;
  attachVideo(content.id, { path, mime: info.mime || "video/mp4", sizeBytes: info.size });
  if (previous !== path)
    await remove(client, bucket, previous);
  return { sizeBytes: info.size };
}
async function removeAvatar(client) {
  const me = sessionUser(getState());
  if (!me)
    throw new HttpError(401, "Debes iniciar sesión para hacer esto.");
  const previous = readRaw().users.find((u) => u.id === me.id)?.avatarPath;
  setAvatar(null);
  await remove(client, "avatars", previous);
}
async function playbackUrl(client, contentId) {
  const db = getState();
  const content = db.contents.find((c) => c.id === contentId);
  if (!content || !content.videoPath)
    throw new HttpError(404, "Video no encontrado.");
  const access = contentAccess(db, content, sessionUser(db));
  if (!access.ok)
    throw new HttpError(403, access.reason ?? "Sin acceso a este contenido.");
  const { data, error } = await client.storage.from("videos").createSignedUrl(content.videoPath, SIGNED_URL_SECONDS);
  if (error || !data)
    throw new HttpError(404, "No se pudo preparar el video.");
  return { url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS };
}
async function processContent(client, contentId) {
  const content = readRaw().contents.find((c) => c.id === contentId);
  if (!content || content.status !== "PROCESSING")
    return;
  if (content.type !== "VIDEO") {
    finishProcessing(contentId, { ok: true });
    return;
  }
  const found = content.videoPath ? await objectInfo(client, "videos", content.videoPath) : null;
  finishProcessing(contentId, found ? { ok: true } : { ok: false, error: "El video no se encontró en el almacenamiento. Súbelo de nuevo." });
}

// supabase/fn-src/sync.ts
function snapshot() {
  const raw = readRaw();
  const actorId = currentActorId();
  const { refreshTokens: _omit, ...base } = raw;
  const full = { ...base, sessionUserId: actorId };
  const viewer = sessionUser(full);
  const isMod = can(viewer, "moderation:content");
  const isStaff = isMod || can(viewer, "admin:users");
  const users = full.users.filter((u) => !u.deletedAt).map((u) => {
    const {
      avatarPath: _ap,
      passwordHash: _ph,
      msKey: _mk,
      adminPwFp: _fp,
      failedLogins: _fl,
      lockedUntil: _lu,
      ...pub
    } = u;
    const visible = isStaff || u.id === actorId;
    return visible ? pub : { ...pub, email: "", statusReason: undefined };
  });
  const contents = full.contents.filter((c) => {
    if (isMod)
      return true;
    if (c.creatorId === actorId)
      return true;
    return c.status === "PUBLISHED" && !full.users.find((u) => u.id === c.creatorId)?.deletedAt;
  }).map((c) => {
    const { videoPath, thumbnailPath: _tp, ...visible } = c;
    if (contentAccess(full, c, viewer).ok)
      return { ...visible, hasVideo: !!videoPath };
    return { ...visible, thumbnailUrl: undefined, videoMime: undefined, videoSizeBytes: undefined, hasVideo: false };
  });
  const canHideRatings = can(viewer, "moderation:hide_rating");
  const derived = { verified: {}, creatorSuspended: {}, aggregates: {} };
  for (const u of full.users) {
    derived.verified[u.id] = isVerified(full, u.id);
    derived.creatorSuspended[u.id] = isCreatorSuspended(full, u.id);
    if (u.roles.includes("CREATOR"))
      derived.aggregates[u.id] = ratingAggregate(full, u.id);
  }
  return {
    ...full,
    users,
    contents,
    ratings: full.ratings.filter((r) => !r.hidden || canHideRatings || r.viewerId === actorId),
    saved: full.saved.filter((s) => s.userId === actorId),
    views: full.views.filter((v) => v.userId === actorId),
    reports: can(viewer, "moderation:reports") ? full.reports : [],
    notifications: full.notifications.filter((n) => n.userId === actorId),
    applications: can(viewer, "moderation:creator_apps") ? full.applications : full.applications.filter((a) => a.userId === actorId),
    institutionRequests: can(viewer, "moderation:institution_requests") ? full.institutionRequests : [],
    audit: can(viewer, "admin:audit") ? full.audit.slice(0, 200) : [],
    derived
  };
}

// supabase/fn-src/routes.ts
var routes = [];
function add(method, path, access, run) {
  const keys = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_m, k) => {
    keys.push(k);
    return "([^/]+)";
  });
  routes.push({ method, pattern: new RegExp(`^${source}$`), keys, access, run });
}
var ok = () => ({ ok: true });
var noPerm = () => [];
function findRoute(method, path) {
  let pathMatched = false;
  for (const route of routes) {
    const m = route.pattern.exec(path);
    if (!m)
      continue;
    pathMatched = true;
    if (route.method !== method)
      continue;
    const params = {};
    route.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
    return { route, params };
  }
  return pathMatched ? "method" : null;
}
function authorize(route) {
  if (!route.access)
    return;
  const user = sessionUser(getState());
  if (!user)
    throw new HttpError(401, "Debes iniciar sesión para hacer esto.");
  for (const permission of route.access) {
    if (!can(user, permission))
      throw new HttpError(403, "No tienes permiso para realizar esta acción.");
  }
}
add("GET", "/sync", undefined, () => snapshot());
add("GET", "/auth/microsoft/config", undefined, () => microsoftConfig());
add("POST", "/auth/microsoft", undefined, (c) => microsoftLogin(c.body ?? {}));
add("POST", "/auth/login", undefined, (c) => passwordLogin(c.body ?? {}));
add("POST", "/auth/register/start", undefined, (c) => registerStart(c.body ?? {}));
add("POST", "/auth/register", undefined, (c) => register(c.body ?? {}));
add("POST", "/auth/refresh", undefined, (c) => refresh(c.body?.refreshToken ?? ""));
add("POST", "/auth/logout", undefined, (c) => {
  logout(c.body?.refreshToken ?? "");
  return ok();
});
add("GET", "/auth/me", noPerm(), () => me());
add("PATCH", "/profiles/me", ["profile:edit_own"], (c) => {
  updateProfile({ ...c.body, semester: Number(c.body?.semester) });
  return ok();
});
add("POST", "/profiles/:id/follow", ["follow:manage"], (c) => (followUser(c.params.id), ok()));
add("DELETE", "/profiles/:id/follow", ["follow:manage"], (c) => (unfollowUser(c.params.id), ok()));
add("POST", "/communities/:id/toggle-membership", ["community:join"], (c) => (toggleCommunity(c.params.id), ok()));
add("POST", "/content/:id/save", ["content:save"], (c) => ({ saved: toggleSave(c.params.id) }));
var rate = (c) => {
  upsertRating(c.params.id, Number(c.body?.stars), c.body?.sub ?? {}, c.body?.comment);
  return ok();
};
add("POST", "/creators/:id/ratings", ["rating:create"], rate);
add("PATCH", "/creators/:id/ratings/me", ["rating:create"], rate);
add("DELETE", "/creators/:id/ratings/me", ["rating:create"], (c) => (deleteMyRating(c.params.id), ok()));
add("POST", "/reports", ["report:create"], (c) => {
  createReport(c.body?.targetType, c.body?.targetId, c.body?.reason ?? "");
  return ok();
});
add("PATCH", "/notifications/:id/read", ["notification:read"], (c) => (markNotificationRead(c.params.id), ok()));
add("POST", "/notifications/read-all", ["notification:read"], () => (markAllNotificationsRead(), ok()));
add("POST", "/institutions/requests", undefined, (c) => {
  const b = c.body ?? {};
  submitInstitutionRequest({
    requesterEmail: b.requesterEmail ?? "",
    requesterName: b.requesterName ?? "",
    name: b.name ?? "",
    domain: b.domain ?? "",
    country: b.country ?? "",
    city: b.city ?? "",
    evidence: b.evidence ?? ""
  });
  return ok();
});
add("POST", "/content", ["content:create"], (c) => ({ id: saveContent(c.body) }));
add("PATCH", "/content/:id", ["content:create"], (c) => ({ id: saveContent(c.body, c.params.id) }));
add("POST", "/content/:id/submit-review", ["content:submit"], async (c) => {
  submitForReview(c.params.id);
  await processContent(c.client(), c.params.id);
  return ok();
});
add("POST", "/content/:id/publish", ["content:create"], (c) => (publishContent(c.params.id), ok()));
add("POST", "/content/:id/archive", ["content:create"], (c) => (archiveOwnContent(c.params.id), ok()));
add("POST", "/content/:id/view", undefined, (c) => (recordView(c.params.id), ok()));
add("POST", "/creator-applications", ["creator:apply"], (c) => (submitCreatorApplication(c.body), ok()));
add("POST", "/media/upload-url", noPerm(), (c) => createUpload(c.client(), c.body ?? {}));
add("POST", "/media/confirm", noPerm(), (c) => confirmUpload(c.client(), c.body ?? {}));
add("DELETE", "/profiles/me/avatar", ["profile:edit_own"], async (c) => {
  await removeAvatar(c.client());
  return ok();
});
add("GET", "/content/:id/playback", undefined, (c) => playbackUrl(c.client(), c.params.id));
add("PATCH", "/moderation/content/:id", ["moderation:content"], (c) => {
  moderateContent(c.params.id, c.body?.decision, c.body?.reason);
  return ok();
});
add("PATCH", "/moderation/creator-applications/:id", ["moderation:creator_apps"], (c) => {
  reviewCreatorApplication(c.params.id, c.body?.decision, c.body?.reason);
  return ok();
});
add("POST", "/moderation/creators/:userId/suspend", ["moderation:suspend_user"], (c) => {
  suspendCreator(c.params.userId, c.body?.reason ?? "");
  return ok();
});
add("POST", "/moderation/creators/:userId/reactivate", ["moderation:suspend_user"], (c) => {
  reactivateCreator(c.params.userId, c.body?.reason ?? "");
  return ok();
});
add("PATCH", "/moderation/reports/:id", ["moderation:reports"], (c) => {
  resolveReport(c.params.id, c.body?.status, c.body?.resolution ?? "");
  return ok();
});
add("PATCH", "/moderation/institution-requests/:id", ["moderation:institution_requests"], (c) => {
  reviewInstitutionRequest(c.params.id, !!c.body?.approve, c.body?.reason);
  return ok();
});
add("PATCH", "/moderation/ratings/:id", ["moderation:hide_rating"], (c) => {
  setRatingHidden(c.params.id, !!c.body?.hidden, c.body?.reason ?? "");
  return ok();
});
add("GET", "/admin/audit-logs", ["admin:audit"], () => readRaw().audit.slice(0, 200));
add("PATCH", "/admin/users/:id/status", ["moderation:suspend_user"], (c) => {
  setAccountStatus(c.params.id, c.body?.status, c.body?.reason ?? "");
  return ok();
});
add("PUT", "/admin/users/:id/roles/:role", ["admin:roles"], (c) => {
  setUserRole(c.params.id, c.params.role, !!c.body?.grant, c.body?.reason ?? "");
  return ok();
});
add("PATCH", "/admin/users/:id/verification", ["admin:verification"], (c) => {
  setVerification(c.params.id, c.body?.value ?? null, c.body?.reason ?? "");
  return ok();
});
add("PATCH", "/admin/settings", ["admin:settings"], (c) => {
  updateSettings({
    verificationThreshold: Number(c.body?.verificationThreshold),
    minFollowDaysToRate: Number(c.body?.minFollowDaysToRate)
  });
  return ok();
});
add("DELETE", "/admin/users/:id", ["admin:users"], (c) => (softDeleteUser(c.params.id, c.body?.reason ?? ""), ok()));
add("POST", "/admin/catalog/institutions", ["admin:catalog"], (c) => ({
  id: createInstitution({ ...c.body, domains: Array.isArray(c.body?.domains) ? c.body.domains : [] })
}));
add("POST", "/admin/catalog/faculties", ["admin:catalog"], (c) => ({ id: createFaculty(c.body) }));
add("POST", "/admin/catalog/degrees", ["admin:catalog"], (c) => ({
  id: createDegree({ ...c.body, semesters: Number(c.body?.semesters) })
}));
add("POST", "/admin/catalog/subjects", ["admin:catalog"], (c) => ({
  id: createSubject({
    ...c.body,
    semester: Number(c.body?.semester),
    credits: c.body?.credits === undefined || c.body?.credits === null ? undefined : Number(c.body.credits)
  })
}));
add("DELETE", "/admin/catalog/:kind/:id", ["admin:catalog"], (c) => {
  if (!["institution", "faculty", "degree", "subject"].includes(c.params.kind)) {
    throw new Error("Tipo de catálogo inválido.");
  }
  deleteCatalogItem(c.params.kind, c.params.id);
  return ok();
});

// supabase/fn-src/handler.ts
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400"
};
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
var buckets = new Map;
function limited(key, limit, windowMs = 60000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets)
      if (v.resetAt < now)
        buckets.delete(k);
  }
  return b.count > limit;
}
function routePath(url) {
  const i = url.pathname.indexOf("/api");
  let p = i >= 0 ? url.pathname.slice(i + 4) : url.pathname;
  if (p.startsWith("/v1/"))
    p = p.slice(3);
  return p === "" ? "/" : p.replace(/\/+$/, "") || "/";
}
function createHandler(deps) {
  return async function handle(req) {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const path = routePath(url);
    if (path === "/health")
      return json(200, { status: "ok", time: new Date().toISOString() });
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
    if (limited(`${ip}:*`, 600) || path.startsWith("/auth") && limited(`${ip}:auth`, 120)) {
      return json(429, { statusCode: 429, message: "Demasiadas solicitudes. Intenta de nuevo en un momento." });
    }
    const found = findRoute(req.method, path);
    if (!found)
      return json(404, { statusCode: 404, message: "Ruta no encontrada." });
    if (found === "method")
      return json(405, { statusCode: 405, message: "Método no permitido." });
    let body = undefined;
    if (req.method !== "GET") {
      const text = await req.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return json(400, { statusCode: 400, message: "El cuerpo de la petición no es JSON válido." });
        }
      }
    }
    try {
      const result = await runRequest(deps.backend(), async (setActor) => {
        await ensureAdmin();
        const header = req.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        setActor(token ? verifyAccess(token) : null);
        authorize(found.route);
        return found.route.run({ params: found.params, body, client: deps.storage });
      });
      return json(200, result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError)
        return json(e.status, { statusCode: e.status, message: e.message });
      if (e instanceof StorageWriteError)
        return json(503, { statusCode: 503, message: e.message });
      if (e instanceof Error && e.constructor === Error) {
        const status = statusForDomainError(e.message);
        return json(status, { statusCode: status, message: e.message });
      }
      console.error(e instanceof Error ? e.stack ?? e.message : String(e));
      return json(500, { statusCode: 500, message: "Error interno del servidor." });
    }
  };
}

// supabase/fn-src/index.ts
var handler = createHandler({
  backend: () => new SupabaseBackend,
  storage: () => supabaseClient()
});
Deno.serve(handler);
