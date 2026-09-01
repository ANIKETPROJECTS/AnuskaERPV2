import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import type { Db } from "mongodb";
import { getMongoClient, getMongoDb } from "./mongodb.server";

const CONTROL_DATABASE = process.env["MONGODB_CONTROL_DATABASE"] ?? "float_erp_control";
const LEGACY_SESSION_COOKIE = "float_erp_session";
const SESSION_COOKIES: Record<Panel, string> = {
  admin: "float_erp_admin_session",
  subhub: "float_erp_subhub_session",
};
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const ACCESS_SECTIONS = [
  "dashboard",
  "bom",
  "raw-materials",
  "orders",
  "hubs",
  "shortages",
  "procurement",
  "production",
  "user-management",
  "inventory",
  "hub-manager",
  "hub-reports",
  "hr",
] as const;

export type AccessSection = (typeof ACCESS_SECTIONS)[number];
export type Panel = "admin" | "subhub";
export type UserRole = "master_admin" | "admin" | "subhub";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  panel: Panel;
  subhubName: string | undefined;
  role: UserRole;
  permissions: AccessSection[];
  databaseName: string;
  active: boolean;
};

export type UserDocument = {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  panel: Panel;
  subhubName: string | undefined;
  role: UserRole;
  permissions: AccessSection[];
  databaseName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SessionDocument = {
  _id?: string;
  tokenHash: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

type WorkspaceDocument = {
  _id: "metadata";
  userId: string;
  createdAt: Date;
  schemaVersion: number;
};

type ProvisioningDocument = {
  _id: string;
  userId: string;
  databaseName: string;
  status: "ready" | "archived";
  createdAt: Date;
  updatedAt: Date;
};

let controlPlanePromise: Promise<Db> | undefined;
let indexesPromise: Promise<void> | undefined;

const ADMIN_PERMISSIONS: AccessSection[] = [
  "dashboard",
  "bom",
  "raw-materials",
  "orders",
  "hubs",
  "shortages",
  "procurement",
  "production",
  "hr",
];

const SUBHUB_PERMISSIONS: AccessSection[] = ["inventory", "hub-manager", "hub-reports", "hr"];
const PANEL_PERMISSIONS: Record<Panel, readonly AccessSection[]> = {
  admin: ADMIN_PERMISSIONS,
  subhub: SUBHUB_PERMISSIONS,
};

export function getDefaultPermissions(panel: Panel): AccessSection[] {
  return panel === "admin" ? [...ADMIN_PERMISSIONS] : [...SUBHUB_PERMISSIONS];
}

export function getAllPermissions(): AccessSection[] {
  return [...ACCESS_SECTIONS];
}

async function getControlPlane(): Promise<Db> {
  controlPlanePromise ??= getMongoDb(CONTROL_DATABASE);
  return controlPlanePromise;
}

async function ensureControlPlane(): Promise<Db> {
  const db = await getControlPlane();
  indexesPromise ??= Promise.all([
    db.collection<UserDocument>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<SessionDocument>("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<SessionDocument>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<ProvisioningDocument>("provisioning").createIndex({ userId: 1 }, { unique: true }),
    db.collection("production_orders").createIndex({ subhubUserId: 1, createdAt: -1 }),
    db.collection("hub_capacities").createIndex({ updatedAt: -1 }),
    db.collection("production_order_activity").createIndex({ orderId: 1, createdAt: -1 }),
    db.collection("production_reassignments").createIndex({ createdAt: -1 }),
    db.collection<UserDocument>("users").updateMany(
      { panel: { $in: ["admin", "subhub"] } },
      { $addToSet: { permissions: "hr" } },
    ),
  ]).then(() => undefined);
  await indexesPromise;
  return db;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function createLegacyDatabaseName(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `float_erp_user_${safeId.slice(0, 22)}`;
}

function truncateDatabaseName(value: string, maxBytes = 38): string {
  const characters = Array.from(value);
  let result = value;
  while (Buffer.byteLength(result, "utf8") > maxBytes) {
    characters.pop();
    result = characters.join("");
  }
  return result;
}

function createSubhubDatabaseBaseName(subhubName: string): string {
  // MongoDB rejects spaces and several punctuation characters in database
  // names. Use the SubHub name as a readable, name-only slug.
  const safeName = normalizeName(subhubName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return truncateDatabaseName(safeName || "SubHub");
}

function createDatabaseName(userId: string): string {
  return createLegacyDatabaseName(userId);
}

function createDuplicateDatabaseName(baseName: string, number: number): string {
  const suffix = `_${number}`;
  return `${truncateDatabaseName(baseName, 38 - Buffer.byteLength(suffix, "utf8"))}${suffix}`;
}

async function allocateWorkspaceDatabaseName(
  db: Db,
  userId: string,
  panel: Panel,
  subhubName: string | undefined,
  currentDatabaseName?: string,
): Promise<string> {
  if (panel !== "subhub" || !subhubName) {
    return createLegacyDatabaseName(userId);
  }

  const baseName = createSubhubDatabaseBaseName(subhubName);
  for (let duplicateNumber = 0; duplicateNumber < 1000; duplicateNumber += 1) {
    const candidate = duplicateNumber === 0 ? baseName : createDuplicateDatabaseName(baseName, duplicateNumber + 1);
    const usedByAnotherUser = await db.collection<UserDocument>("users").findOne(
      { databaseName: candidate, _id: { $ne: userId } },
      { projection: { _id: 1 } },
    );
    if (usedByAnotherUser) continue;

    if (candidate !== currentDatabaseName) {
      const collections = await (await getMongoDb(candidate)).listCollections({}, { nameOnly: true }).toArray();
      if (collections.length > 0) continue;
    }
    return candidate;
  }

  throw new Error("Could not allocate a unique SubHub workspace database name.");
}

function sanitizePermissions(panel: Panel, permissions: AccessSection[]): AccessSection[] {
  const allowed = new Set(PANEL_PERMISSIONS[panel]);
  return permissions.filter((permission) => allowed.has(permission));
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [, n, r, p, saltHex, hashHex] = encoded.split("$");
  if (!n || !r || !p || !saltHex || !hashHex) return false;

  try {
    const derivedKey = await deriveKey(password, Buffer.from(saltHex, "hex"), hashHex.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    const expected = Buffer.from(hashHex, "hex");
    return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
  } catch {
    return false;
  }
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    panel: user.panel,
    subhubName: user.subhubName,
    role: user.role,
    permissions: user.permissions,
    databaseName: user.databaseName,
    active: user.active,
  };
}

async function provisionDatabase(
  db: Db,
  userId: string,
  databaseName: string,
): Promise<void> {
  const userDb = await getMongoDb(databaseName);
  await userDb.collection<WorkspaceDocument>("_workspace").updateOne(
    { _id: "metadata" },
    {
      $setOnInsert: {
        _id: "metadata",
        userId,
        createdAt: new Date(),
        schemaVersion: 1,
      },
    },
    { upsert: true },
  );
  await db.collection<ProvisioningDocument>("provisioning").updateOne(
    { userId },
    {
      $set: {
        userId,
        databaseName,
        status: "ready",
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: userId, createdAt: new Date() },
    },
    { upsert: true },
  );
}

async function moveWorkspaceDatabase(fromDatabaseName: string, toDatabaseName: string): Promise<void> {
  if (fromDatabaseName === toDatabaseName) return;

  const client = await getMongoClient();
  const sourceDb = client.db(fromDatabaseName);
  const targetDb = client.db(toDatabaseName);
  const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
  const targetCollections = await targetDb.listCollections({}, { nameOnly: true }).toArray();
  if (collections.length === 0) {
    if (targetCollections.length > 0) return;
    return;
  }
  if (targetCollections.length > 0) {
    throw new Error("The destination workspace database already contains data.");
  }

  for (const collectionInfo of collections) {
    if (collectionInfo.name.startsWith("system.")) continue;

    const sourceCollection = sourceDb.collection(collectionInfo.name);
    const targetCollection = targetDb.collection(collectionInfo.name);
    const documents = await sourceCollection.find({}).toArray();
    if (documents.length > 0) {
      await targetCollection.insertMany(documents, { ordered: true });
    }

    const indexes = await sourceCollection.listIndexes().toArray();
    for (const index of indexes) {
      if (index.name === "_id_") continue;
      await targetCollection.createIndex(index.key, {
        name: index.name,
        unique: index.unique,
        sparse: index.sparse,
      });
    }
  }

  await sourceDb.dropDatabase();
}

async function deleteWorkspaceDatabase(databaseName: string): Promise<void> {
  await (await getMongoDb(databaseName)).dropDatabase();
}

async function getUserForToken(token: string, panel?: Panel): Promise<UserDocument | null> {
  const db = await ensureControlPlane();
  const session = await db.collection<SessionDocument>("sessions").findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  const user = await db.collection<UserDocument>("users").findOne({ _id: session.userId });
  if (!user?.active || (panel && user.panel !== panel)) return null;
  return user;
}

async function getUserBySession(panel?: Panel): Promise<UserDocument | null> {
  if (!panel) return null;

  const panelToken = getCookie(SESSION_COOKIES[panel]);
  if (panelToken) return getUserForToken(panelToken, panel);

  // Migrate the old single-cookie session only when it belongs to the panel
  // being requested. It must never authenticate the other panel.
  const legacyToken = getCookie(LEGACY_SESSION_COOKIE);
  if (!legacyToken) return null;
  const user = await getUserForToken(legacyToken, panel);
  if (user) {
    setCookie(SESSION_COOKIES[panel], legacyToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  return user;
}

export async function getCurrentUserRecord(panel: Panel): Promise<UserDocument | null> {
  return getUserBySession(panel);
}

export async function getControlPlaneDatabase(): Promise<Db> {
  return ensureControlPlane();
}

async function createSession(userId: string, panel: Panel): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const db = await ensureControlPlane();
  await db.collection<SessionDocument>("sessions").insertOne({
    tokenHash: hashSessionToken(token),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
  });
  setCookie(SESSION_COOKIES[panel], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getAuthState(panel?: Panel): Promise<{ setupRequired: boolean; user: PublicUser | null }> {
  const db = await ensureControlPlane();
  const [masterAdminCount, user] = await Promise.all([
    db.collection<UserDocument>("users").countDocuments({ role: "master_admin" }),
    getUserBySession(panel),
  ]);
  return {
    setupRequired: masterAdminCount === 0,
    user: user ? toPublicUser(user) : null,
  };
}

export async function loginUser(email: string, password: string, requestedPanel?: Panel): Promise<
  { ok: true; user: PublicUser } | { ok: false; message: string }
> {
  const db = await ensureControlPlane();
  const user = await db.collection<UserDocument>("users").findOne({
    email: normalizeEmail(email),
  });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "The email or password is incorrect." };
  }
  if (requestedPanel && user.panel !== requestedPanel) {
    return {
      ok: false,
      message: `These credentials belong to the ${user.panel === "admin" ? "Master Admin" : "SubHub Manager"} login.`,
    };
  }

  await createSession(user._id, user.panel);
  return { ok: true, user: toPublicUser(user) };
}

export async function logoutUser(panel: Panel): Promise<{ ok: true }> {
  const panelToken = getCookie(SESSION_COOKIES[panel]);
  const legacyToken = getCookie(LEGACY_SESSION_COOKIE);
  const db = await ensureControlPlane();

  if (panelToken) {
    await db.collection<SessionDocument>("sessions").deleteOne({ tokenHash: hashSessionToken(panelToken) });
  }

  let shouldClearLegacyCookie = legacyToken !== undefined && legacyToken === panelToken;
  if (legacyToken && legacyToken !== panelToken) {
    const legacyUser = await getUserForToken(legacyToken);
    shouldClearLegacyCookie = legacyUser?.panel === panel;
    if (shouldClearLegacyCookie) {
      await db.collection<SessionDocument>("sessions").deleteOne({ tokenHash: hashSessionToken(legacyToken) });
    }
  }

  deleteCookie(SESSION_COOKIES[panel], { httpOnly: true, sameSite: "lax", path: "/" });
  if (shouldClearLegacyCookie) {
    deleteCookie(LEGACY_SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  return { ok: true };
}

export async function bootstrapMasterAdmin(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; message: string }> {
  const db = await ensureControlPlane();
  if (await db.collection<UserDocument>("users").countDocuments({ role: "master_admin" })) {
    return { ok: false, message: "Master Admin setup is already complete. Please sign in." };
  }

  const id = randomUUID().replace(/-/g, "");
  const databaseName = createDatabaseName(id);
  const now = new Date();
  const user: UserDocument = {
    _id: id,
    name: normalizeName(name),
    email: normalizeEmail(email),
    passwordHash: await hashPassword(password),
    panel: "admin",
    role: "master_admin",
    subhubName: undefined,
    permissions: getAllPermissions(),
    databaseName,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  if (user.name.length < 2 || user.email.length < 5 || password.length < 8) {
    return { ok: false, message: "Enter a name, valid email, and password of at least 8 characters." };
  }

  try {
    await db.collection<UserDocument>("users").insertOne(user);
    await provisionDatabase(db, id, databaseName);
  } catch (error) {
    await db.collection<UserDocument>("users").deleteOne({ _id: id });
    if (error instanceof Error && error.message.includes("E11000")) {
      return { ok: false, message: "That email is already registered." };
    }
    throw error;
  }

  await createSession(id, "admin");
  return { ok: true, user: toPublicUser(user) };
}

export async function listUsers(): Promise<
  { ok: true; users: PublicUser[] } | { ok: false; users: PublicUser[]; message: string }
> {
  const current = await getUserBySession("admin");
  if (current?.role !== "master_admin") {
    return { ok: false, users: [], message: "Only the Master Admin can manage users." };
  }
  const db = await ensureControlPlane();
  const users = await db.collection<UserDocument>("users").find().sort({ createdAt: -1 }).toArray();
  return { ok: true, users: users.map(toPublicUser) };
}

export async function createManagedUser(input: {
  name: string;
  email: string;
  password: string;
  panel: Panel;
  subhubName: string | undefined;
  permissions: AccessSection[];
}): Promise<{ ok: true; user: PublicUser } | { ok: false; message: string }> {
  const current = await getUserBySession("admin");
  if (current?.role !== "master_admin") {
    return { ok: false, message: "Only the Master Admin can create users." };
  }

  if (input.password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  const normalizedSubhubName = normalizeName(input.subhubName ?? "");
  if (input.panel === "subhub" && normalizedSubhubName.length < 2) {
    return { ok: false, message: "Enter the SubHub name or factory name." };
  }

  const db = await ensureControlPlane();
  const id = randomUUID().replace(/-/g, "");
  const databaseName = await allocateWorkspaceDatabaseName(db, id, input.panel, normalizedSubhubName);
  const now = new Date();
  const user: UserDocument = {
    _id: id,
    name: normalizeName(input.name),
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    panel: input.panel,
    subhubName: input.panel === "subhub" ? normalizedSubhubName : undefined,
    role: input.panel === "admin" ? "admin" : "subhub",
    permissions: sanitizePermissions(input.panel, input.permissions),
    databaseName,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  if (user.name.length < 2 || user.email.length < 5) {
    return { ok: false, message: "Enter a valid name and email address." };
  }

  try {
    await db.collection<UserDocument>("users").insertOne(user);
    await provisionDatabase(db, id, databaseName);
  } catch (error) {
    await db.collection<UserDocument>("users").deleteOne({ _id: id });
    if (error instanceof Error && error.message.includes("E11000")) {
      return { ok: false, message: "That email is already registered." };
    }
    throw error;
  }

  return { ok: true, user: toPublicUser(user) };
}

export async function updateManagedUser(input: {
  id: string;
  name: string;
  email: string;
  panel: Panel;
  subhubName: string | undefined;
  permissions: AccessSection[];
  active: boolean;
  password?: string | undefined;
}): Promise<{ ok: true; user: PublicUser } | { ok: false; message: string }> {
  const current = await getUserBySession("admin");
  if (current?.role !== "master_admin") {
    return { ok: false, message: "Only the Master Admin can edit users." };
  }
  if (input.id === current._id && !input.active) {
    return { ok: false, message: "You cannot deactivate your own Master Admin account." };
  }
  if (input.password !== undefined && input.password.length > 0 && input.password.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  const normalizedSubhubName = normalizeName(input.subhubName ?? "");
  if (input.panel === "subhub" && normalizedSubhubName.length < 2) {
    return { ok: false, message: "Enter the SubHub name or factory name." };
  }

  const db = await ensureControlPlane();
  const existing = await db.collection<UserDocument>("users").findOne({ _id: input.id });
  if (!existing || existing.role === "master_admin") {
    return { ok: false, message: "The selected user cannot be edited here." };
  }
  const normalizedEmail = normalizeEmail(input.email);
  const emailOwner = await db.collection<UserDocument>("users").findOne({
    email: normalizedEmail,
    _id: { $ne: input.id },
  });
  if (emailOwner) {
    return { ok: false, message: "That email is already registered." };
  }
  const update: Record<string, unknown> = {
    name: normalizeName(input.name),
    email: normalizedEmail,
    panel: input.panel,
    role: input.panel === "admin" ? "admin" : "subhub",
    permissions: sanitizePermissions(input.panel, input.permissions),
    active: input.active,
    updatedAt: new Date(),
  };
  const databaseName = await allocateWorkspaceDatabaseName(
    db,
    input.id,
    input.panel,
    normalizedSubhubName,
    existing.databaseName,
  );
  if (input.panel === "subhub") update["subhubName"] = normalizedSubhubName;
  update["databaseName"] = databaseName;
  if (input.password) update["passwordHash"] = await hashPassword(input.password);
  const updateDocument: { $set: Record<string, unknown>; $unset?: Record<string, ""> } = { $set: update };
  if (input.panel === "admin") updateDocument.$unset = { subhubName: "" };

  try {
    await moveWorkspaceDatabase(existing.databaseName, databaseName);
    await db.collection<UserDocument>("users").updateOne({ _id: input.id }, updateDocument);
    if (input.panel === "subhub") {
      await db.collection("production_orders").updateMany(
        { subhubUserId: input.id },
        { $set: { subhubName: normalizedSubhubName, updatedAt: new Date() } },
      );
    }
    await provisionDatabase(db, input.id, databaseName);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return { ok: false, message: "That email is already registered." };
    }
    throw error;
  }
  const updated = await db.collection<UserDocument>("users").findOne({ _id: input.id });
  return updated ? { ok: true, user: toPublicUser(updated) } : { ok: false, message: "User update failed." };
}

export async function deleteManagedUser(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await getUserBySession("admin");
  if (current?.role !== "master_admin") {
    return { ok: false, message: "Only the Master Admin can delete users." };
  }
  if (id === current._id) {
    return { ok: false, message: "You cannot delete your own Master Admin account." };
  }

  const db = await ensureControlPlane();
  const user = await db.collection<UserDocument>("users").findOne({ _id: id });
  if (!user || user.role === "master_admin") {
    return { ok: false, message: "The selected user cannot be deleted." };
  }
  await deleteWorkspaceDatabase(user.databaseName);
  await Promise.all([
    db.collection<UserDocument>("users").deleteOne({ _id: id }),
    db.collection<SessionDocument>("sessions").deleteMany({ userId: id }),
    db.collection<ProvisioningDocument>("provisioning").deleteOne({ userId: id }),
    db.collection("production_orders").deleteMany({ subhubUserId: id }),
  ]);
  return { ok: true };
}