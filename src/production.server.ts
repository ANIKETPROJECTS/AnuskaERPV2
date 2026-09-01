import { randomUUID } from "node:crypto";
import { getControlPlaneDatabase, getCurrentUserRecord, type UserDocument } from "./auth.server";
import { bomCatalog } from "./lib/bom-catalog";
import { getMongoDb } from "./mongodb.server";
import { subparts } from "./lib/erp-data";

export type AssignableSubhub = {
  id: string;
  name: string;
  subhubName: string;
};

export type ProductionOrder = {
  id: string;
  orderNumber: string;
  subhubUserId: string;
  subhubName: string;
  productCode: string;
  productName: string;
  variantCode: string;
  variantName: string;
  target: number;
  dueDate: string;
  notes: string;
  produced: number;
  remaining: number;
  lastProductionDate: string | null;
  status: "Unstarted" | "In progress" | "Complete" | "Over target";
  createdAt: string;
};

export type ProductionReport = {
  id: string;
  orderId: string;
  date: string;
  quantity: number;
  notes: string;
  updatedAt: string;
};

export type ManagerProductionData = {
  subhubName: string;
  orders: ProductionOrder[];
  reports: ProductionReport[];
};

export type HubSummary = {
  userId: string;
  name: string;
  subhubName: string;
  orderCount: number;
  target: number;
  produced: number;
  remaining: number;
  completion: number;
  reportCount: number;
  stockUnits: number;
  stockValue: number;
  lastProductionDate: string | null;
  status: "No assignments" | "Awaiting update" | "In progress" | "Complete" | "Over target";
};

export type AdminProductionDashboard = {
  hubs: HubSummary[];
  orders: ProductionOrder[];
  totalTarget: number;
  totalProduced: number;
  totalRemaining: number;
  completion: number;
  reportsToday: number;
  latestReportDate: string | null;
};

type ProductionOrderDocument = {
  _id: string;
  orderNumber: string;
  subhubUserId: string;
  subhubName: string;
  productCode: string;
  productName: string;
  variantCode: string;
  variantName: string;
  target: number;
  dueDate: string;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProductionReportDocument = {
  _id: string;
  orderId: string;
  date: string;
  quantity: number;
  notes: string;
  reportedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryItemDocument = {
  _id: string;
  quantity: number;
  updatedAt: Date;
};

function isAdmin(user: UserDocument | null): user is UserDocument {
  return user?.panel === "admin" && (user.role === "master_admin" || user.role === "admin");
}

function isSubhub(user: UserDocument | null): user is UserDocument {
  return user?.panel === "subhub" && user.role === "subhub";
}

function normalizeDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function statusFor(target: number, produced: number): ProductionOrder["status"] {
  if (produced > target) return "Over target";
  if (produced === target) return "Complete";
  if (produced > 0) return "In progress";
  return "Unstarted";
}

async function reportsForDatabase(databaseName: string): Promise<ProductionReportDocument[]> {
  return getMongoDb(databaseName)
    .then((db) => db.collection<ProductionReportDocument>("production_reports").find().sort({ date: -1 }).toArray());
}

function summarizeOrder(order: ProductionOrderDocument, reports: ProductionReportDocument[]): ProductionOrder {
  const orderReports = reports.filter((report) => report.orderId === order._id);
  const produced = orderReports.reduce((sum, report) => sum + report.quantity, 0);
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    subhubUserId: order.subhubUserId,
    subhubName: order.subhubName,
    productCode: order.productCode,
    productName: order.productName,
    variantCode: order.variantCode,
    variantName: order.variantName,
    target: order.target,
    dueDate: order.dueDate,
    notes: order.notes,
    produced,
    remaining: Math.max(0, order.target - produced),
    lastProductionDate: orderReports[0]?.date ?? null,
    status: statusFor(order.target, produced),
    createdAt: order.createdAt.toISOString(),
  };
}

function serializeReport(report: ProductionReportDocument): ProductionReport {
  return {
    id: report._id,
    orderId: report.orderId,
    date: report.date,
    quantity: report.quantity,
    notes: report.notes,
    updatedAt: report.updatedAt.toISOString(),
  };
}

async function allSubhubUsers() {
  const db = await getControlPlaneDatabase();
  return db
    .collection<UserDocument>("users")
    .find({ panel: "subhub", role: "subhub" })
    .sort({ subhubName: 1, name: 1 })
    .toArray();
}

export async function listAssignableSubhubs(): Promise<
  { ok: true; subhubs: AssignableSubhub[] } | { ok: false; subhubs: AssignableSubhub[]; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, subhubs: [], message: "Only Admin users can assign production orders." };
  const users = await allSubhubUsers();
  return {
    ok: true,
    subhubs: users
      .filter((user) => user.active && user.subhubName)
      .map((user) => ({ id: user._id, name: user.name, subhubName: user.subhubName! })),
  };
}

export async function createProductionOrder(input: {
  subhubUserId: string;
  productCode: string;
  variantCode: string;
  target: number;
  dueDate: string;
  notes: string;
}): Promise<{ ok: true; order: ProductionOrder } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("admin");
  if (!isAdmin(current)) return { ok: false, message: "Only Admin users can create production orders." };
  if (!Number.isInteger(input.target) || input.target < 1) return { ok: false, message: "Target must be a whole number greater than zero." };
  const dueDate = normalizeDate(input.dueDate);
  if (!dueDate) return { ok: false, message: "Enter a valid target date." };

  const db = await getControlPlaneDatabase();
  const [subhub, product] = await Promise.all([
    db.collection<UserDocument>("users").findOne({
      _id: input.subhubUserId,
      panel: "subhub",
      role: "subhub",
      active: true,
    }),
    Promise.resolve(bomCatalog.find((item) => item.code === input.productCode)),
  ]);
  if (!subhub?.subhubName) return { ok: false, message: "Select an active SubHub manager." };
  const variant = product?.variants.find((item) => item.code === input.variantCode);
  if (!product || !variant) return { ok: false, message: "Select a valid Float type and variant." };

  const now = new Date();
  const order: ProductionOrderDocument = {
    _id: randomUUID().replace(/-/g, ""),
    orderNumber: `ORD-${now.getTime().toString().slice(-8)}`,
    subhubUserId: subhub._id,
    subhubName: subhub.subhubName,
    productCode: product.code,
    productName: product.name,
    variantCode: variant.code,
    variantName: variant.name,
    target: input.target,
    dueDate,
    notes: input.notes.trim(),
    createdBy: current._id,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<ProductionOrderDocument>("production_orders").insertOne(order);
  return { ok: true, order: summarizeOrder(order, []) };
}

export async function listProductionOrders(): Promise<
  { ok: true; orders: ProductionOrder[] } | { ok: false; orders: ProductionOrder[]; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  if (!current || (!isAdmin(current) && !isSubhub(current))) return { ok: false, orders: [], message: "You do not have access to production orders." };
  const db = await getControlPlaneDatabase();
  const filter = isSubhub(current) ? { subhubUserId: current._id } : {};
  const orders = await db.collection<ProductionOrderDocument>("production_orders").find(filter).sort({ dueDate: 1, createdAt: -1 }).toArray();
  if (isSubhub(current)) {
    const reports = await reportsForDatabase(current.databaseName);
    return { ok: true, orders: orders.map((order) => summarizeOrder(order, reports)) };
  }
  const users = await allSubhubUsers();
  const reportsByUser = await Promise.all(users.map(async (user) => ({ userId: user._id, reports: await reportsForDatabase(user.databaseName) })));
  return {
    ok: true,
    orders: orders.map((order) => summarizeOrder(order, reportsByUser.find((item) => item.userId === order.subhubUserId)?.reports ?? [])),
  };
}

export async function getManagerProductionData(): Promise<
  { ok: true; data: ManagerProductionData } | { ok: false; data: ManagerProductionData; message: string }
> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, data: { subhubName: "", orders: [], reports: [] }, message: "Only SubHub Managers can enter production." };
  const db = await getControlPlaneDatabase();
  const [orders, reports] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").find({ subhubUserId: current._id }).sort({ dueDate: 1, createdAt: -1 }).toArray(),
    reportsForDatabase(current.databaseName),
  ]);
  return {
    ok: true,
    data: {
      subhubName: current.subhubName ?? "SubHub",
      orders: orders.map((order) => summarizeOrder(order, reports)),
      reports: reports.map(serializeReport),
    },
  };
}

export async function saveDailyProduction(input: {
  orderId: string;
  date: string;
  quantity: number;
  notes: string;
}): Promise<{ ok: true; report: ProductionReport } | { ok: false; message: string }> {
  const current = await getCurrentUserRecord("subhub");
  if (!isSubhub(current)) return { ok: false, message: "Only SubHub Managers can enter production." };
  if (!Number.isInteger(input.quantity) || input.quantity < 0) return { ok: false, message: "Production must be a whole number of zero or more." };
  const date = normalizeDate(input.date);
  if (!date) return { ok: false, message: "Enter a valid production date." };

  const controlDb = await getControlPlaneDatabase();
  const order = await controlDb.collection<ProductionOrderDocument>("production_orders").findOne({
    _id: input.orderId,
    subhubUserId: current._id,
  });
  if (!order) return { ok: false, message: "That production order is not assigned to this SubHub." };

  const now = new Date();
  const reportId = `${order._id}_${date}`;
  const workspaceDb = await getMongoDb(current.databaseName);
  await workspaceDb.collection<ProductionReportDocument>("production_reports").updateOne(
    { _id: reportId },
    {
      $set: {
        orderId: order._id,
        date,
        quantity: input.quantity,
        notes: input.notes.trim(),
        reportedBy: current._id,
        updatedAt: now,
      },
      $setOnInsert: { _id: reportId, createdAt: now },
    },
    { upsert: true },
  );
  const saved: ProductionReportDocument = {
    _id: reportId,
    orderId: order._id,
    date,
    quantity: input.quantity,
    notes: input.notes.trim(),
    reportedBy: current._id,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, report: serializeReport(saved) };
}

export async function getAdminProductionDashboard(): Promise<
  { ok: true; data: AdminProductionDashboard } | { ok: false; data: AdminProductionDashboard; message: string }
> {
  const current = await getCurrentUserRecord("admin");
  const empty: AdminProductionDashboard = { hubs: [], orders: [], totalTarget: 0, totalProduced: 0, totalRemaining: 0, completion: 0, reportsToday: 0, latestReportDate: null };
  if (!isAdmin(current)) return { ok: false, data: empty, message: "Only Admin users can view all hub performance." };

  const db = await getControlPlaneDatabase();
  const [orders, users] = await Promise.all([
    db.collection<ProductionOrderDocument>("production_orders").find().sort({ dueDate: 1, createdAt: -1 }).toArray(),
    allSubhubUsers(),
  ]);
  const workspaceData = await Promise.all(
    users.map(async (user) => ({
      user,
      reports: await reportsForDatabase(user.databaseName),
      inventory: await getMongoDb(user.databaseName)
        .then((workspaceDb) => workspaceDb.collection<InventoryItemDocument>("inventory_items").find().toArray()),
    })),
  );
  const reportsByUser = workspaceData.map(({ user, reports }) => ({ user, reports }));
  const orderReports = new Map<string, ProductionReportDocument[]>();
  reportsByUser.forEach(({ user, reports }) => {
    const relevant = new Set(orders.filter((order) => order.subhubUserId === user._id).map((order) => order._id));
    reports.forEach((report) => {
      if (relevant.has(report.orderId)) {
        const currentReports = orderReports.get(report.orderId) ?? [];
        orderReports.set(report.orderId, [...currentReports, report]);
      }
    });
  });
  const serializedOrders = orders.map((order) => summarizeOrder(order, orderReports.get(order._id) ?? []));
  const today = new Date().toISOString().slice(0, 10);
  const hubs = users.filter((user) => user.active && user.subhubName).map((user) => {
    const hubOrders = serializedOrders.filter((order) => order.subhubUserId === user._id);
    const target = hubOrders.reduce((sum, order) => sum + order.target, 0);
    const produced = hubOrders.reduce((sum, order) => sum + order.produced, 0);
    const workspace = workspaceData.find(({ user: candidate }) => candidate._id === user._id);
    const hubReports = workspace?.reports ?? [];
    const stockUnits = workspace?.inventory.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const stockValue = workspace?.inventory.reduce((sum, item) => sum + item.quantity * (subparts.find((part) => part.code === item._id)?.rate ?? 0), 0) ?? 0;
    const lastProductionDate = hubReports[0]?.date ?? null;
    const completion = target ? Math.round((produced / target) * 100) : 0;
    let status: HubSummary["status"] = "No assignments";
    if (target && completion > 100) status = "Over target";
    else if (target && completion >= 100) status = "Complete";
    else if (target && lastProductionDate && lastProductionDate < today) status = "Awaiting update";
    else if (target) status = "In progress";
    return { userId: user._id, name: user.name, subhubName: user.subhubName!, orderCount: hubOrders.length, target, produced, remaining: Math.max(0, target - produced), completion, reportCount: hubReports.length, stockUnits, stockValue, lastProductionDate, status };
  });
  const totalTarget = serializedOrders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = serializedOrders.reduce((sum, order) => sum + order.produced, 0);
  const allReports = reportsByUser.flatMap(({ reports }) => reports);
  const latestReportDate = allReports[0]?.date ?? null;
  return {
    ok: true,
    data: {
      hubs,
      orders: serializedOrders,
      totalTarget,
      totalProduced,
      totalRemaining: Math.max(0, totalTarget - totalProduced),
      completion: totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0,
      reportsToday: allReports.filter((report) => report.date === today).length,
      latestReportDate,
    },
  };
}