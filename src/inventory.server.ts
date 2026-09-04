import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getCurrentUserRecord, getControlPlaneDatabase, type UserDocument } from "./auth.server";
import { bomCatalog } from "./lib/bom-catalog";
import { getMongoDb } from "./mongodb.server";
import { subparts } from "./lib/erp-data";

export type InventoryCategory = "Molded" | "Purchased";
export type InventoryMovementType = "Stock added" | "Stock removed" | "Quality rejected";
export type QualityIssue = "Faulty" | "Damaged" | "Rejected" | "Expired" | "Other";

export type InventoryItem = {
  code: string;
  name: string;
  category: InventoryCategory;
  unit: "pcs";
  quantity: number;
  batches: number;
  price: number;
  updatedAt: string | null;
};

export type InventoryMovement = {
  id: string;
  date: string;
  type: InventoryMovementType;
  product: string;
  code: string;
  reference: string;
  change: number;
  balance: number;
  reason: string;
  notes: string;
};

export type QualityLog = {
  id: string;
  subhubUserId: string;
  subhubName: string;
  date: string;
  code: string;
  product: string;
  category: InventoryCategory;
  issue: QualityIssue;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  notes: string;
  recordedBy: string;
  recordedByName: string;
};

export type SubhubInventoryData = {
  items: InventoryItem[];
  movements: InventoryMovement[];
  qualityLogs: QualityLog[];
  qualitySummary: {
    records: number;
    rejectedUnits: number;
  };
};

export type MasterQualityData = {
  logs: QualityLog[];
  bySubhub: Array<{ subhubUserId: string; subhubName: string; records: number; rejectedUnits: number }>;
  byReason: Array<{ issue: QualityIssue; records: number; rejectedUnits: number }>;
  summary: {
    records: number;
    rejectedUnits: number;
    subhubsWithIssues: number;
  };
};

type InventoryItemDocument = {
  _id: string;
  name?: string;
  category?: InventoryCategory;
  unit?: "pcs";
  quantity: number;
  batches: number;
  price?: number;
  updatedAt: Date;
  updatedBy: string;
};

type InventoryMovementDocument = {
  _id: string;
  code: string;
  product: string;
  type: InventoryMovementType;
  change: number;
  balance: number;
  reason: string;
  notes: string;
  sourceType?: "manual" | "procurement" | "production" | "quality";
  sourceId?: string;
  createdAt: Date;
};

type InventorySourceDocument = {
  _id: string;
  sourceType: "procurement" | "production";
  sourceId: string;
  code: string;
  product: string;
  category: InventoryCategory;
  price: number;
  quantityApplied: number;
  createdAt: Date;
  updatedAt: Date;
};

type QualityLogDocument = {
  _id: string;
  subhubUserId: string;
  subhubName: string;
  code: string;
  product: string;
  category: InventoryCategory;
  issue: QualityIssue;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  notes: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: Date;
};

type ProductionReportDocument = {
  _id: string;
  orderId: string;
  date: string;
  quantity: number;
};

type ProductionOrderDocument = {
  _id: string;
  productCode: string;
  variantCode: string;
};

type DeliveredProcurementDocument = {
  _id: string;
  orderNumber: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
};

function emptyData(): SubhubInventoryData {
  return { items: [], movements: [], qualityLogs: [], qualitySummary: { records: 0, rejectedUnits: 0 } };
}

function emptyMasterQualityData(): MasterQualityData {
  return { logs: [], bySubhub: [], byReason: [], summary: { records: 0, rejectedUnits: 0, subhubsWithIssues: 0 } };
}

function masterPart(code: string) {
  return subparts.find((part) => part.code === code);
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function serializeQualityLog(log: QualityLogDocument): QualityLog {
  return {
    id: log._id,
    subhubUserId: log.subhubUserId,
    subhubName: log.subhubName,
    date: log.createdAt.toISOString(),
    code: log.code,
    product: log.product,
    category: log.category,
    issue: log.issue,
    quantity: log.quantity,
    beforeQuantity: log.beforeQuantity,
    afterQuantity: log.afterQuantity,
    notes: log.notes,
    recordedBy: log.recordedBy,
    recordedByName: log.recordedByName,
  };
}

async function applyInventoryDelta(input: {
  db: Db;
  code: string;
  product: string;
  category: InventoryCategory;
  price: number;
  change: number;
  reason: string;
  notes: string;
  updatedBy: string;
  sourceType?: InventoryMovementDocument["sourceType"];
  sourceId?: string;
  movementType?: InventoryMovementType;
}) {
  const collection = input.db.collection<InventoryItemDocument>("inventory_items");
  const existing = await collection.findOne({ _id: input.code });
  const currentQuantity = existing?.quantity ?? 0;
  const nextQuantity = currentQuantity + input.change;
  if (nextQuantity < 0) throw new Error(`Cannot remove more stock than is available for ${input.product}.`);

  const now = new Date();
  await collection.updateOne(
    { _id: input.code },
    {
      $set: {
        name: input.product,
        category: input.category,
        unit: "pcs",
        quantity: nextQuantity,
        price: input.price,
        updatedAt: now,
        updatedBy: input.updatedBy,
      },
      $setOnInsert: { batches: 0 },
    },
    { upsert: true },
  );

  await input.db.collection<InventoryMovementDocument>("inventory_movements").insertOne({
    _id: randomUUID().replace(/-/g, ""),
    code: input.code,
    product: input.product,
    type: input.movementType ?? (input.change >= 0 ? "Stock added" : "Stock removed"),
    change: input.change,
    balance: nextQuantity,
    reason: input.reason,
    notes: input.notes,
    ...(input.sourceType ? { sourceType: input.sourceType } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    createdAt: now,
  });
  return { currentQuantity, nextQuantity };
}

async function applySourcedQuantity(input: {
  db: Db;
  sourceId: string;
  sourceType: "procurement" | "production";
  code: string;
  product: string;
  category: InventoryCategory;
  price: number;
  desiredQuantity: number;
  reason: string;
  notes: string;
  updatedBy: string;
}) {
  const sources = input.db.collection<InventorySourceDocument>("inventory_sources");
  const existing = await sources.findOne({ _id: input.sourceId });
  const delta = input.desiredQuantity - (existing?.quantityApplied ?? 0);
  if (delta !== 0) {
    await applyInventoryDelta({
      db: input.db,
      code: input.code,
      product: input.product,
      category: input.category,
      price: input.price,
      change: delta,
      reason: input.reason,
      notes: input.notes,
      updatedBy: input.updatedBy,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
  }
  const now = new Date();
  await sources.updateOne(
    { _id: input.sourceId },
    {
      $set: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        code: input.code,
        product: input.product,
        category: input.category,
        price: input.price,
        quantityApplied: input.desiredQuantity,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

async function syncDeliveredProcurementOrders(user: UserDocument, workspaceDb: Db) {
  const controlDb = await getControlPlaneDatabase();
  const orders = await controlDb.collection<DeliveredProcurementDocument & { subhubUserId: string; status: string }>("procurement_orders")
    .find({ subhubUserId: user._id, status: "Delivery done" })
    .toArray();

  for (const order of orders) {
    const part = masterPart(order.materialCode);
    await applySourcedQuantity({
      db: workspaceDb,
      sourceId: `procurement:${order._id}`,
      sourceType: "procurement",
      code: order.materialCode,
      product: order.materialName || part?.name || order.materialCode,
      category: part?.source ?? "Purchased",
      price: order.unitPrice || part?.rate || 0,
      desiredQuantity: order.quantity,
      reason: `Procurement receipt · ${order.orderNumber}`,
      notes: "Added automatically when the procurement order reached Delivery done.",
      updatedBy: user._id,
    });
  }
}

async function syncMoldedProduction(user: UserDocument, workspaceDb: Db) {
  const reports = await workspaceDb.collection<ProductionReportDocument>("production_reports").find().toArray();
  const controlDb = await getControlPlaneDatabase();
  const orders = await controlDb.collection<ProductionOrderDocument>("production_orders")
    .find({ _id: { $in: reports.map((report) => report.orderId) } })
    .toArray();
  const orderById = new Map(orders.map((order) => [order._id, order]));
  const desiredSourceIds = new Set<string>();

  for (const report of reports) {
    const order = orderById.get(report.orderId);
    const variant = order ? bomCatalog.find((product) => product.code === order.productCode)?.variants.find((candidate) => candidate.code === order.variantCode) : undefined;
    if (!order || !variant) continue;
    for (const [code, unitsPerAssembly] of Object.entries(variant.parts)) {
      const part = masterPart(code);
      if (!part || part.source !== "Molded") continue;
      const sourceId = `production:${report._id}:${code}`;
      desiredSourceIds.add(sourceId);
      await applySourcedQuantity({
        db: workspaceDb,
        sourceId,
        sourceType: "production",
        code,
        product: part.name,
        category: "Molded",
        price: part.rate,
        desiredQuantity: report.quantity * unitsPerAssembly,
        reason: `Molding output · ${order.variantCode} · ${report.date}`,
        notes: report.quantity ? "Added automatically from the saved daily production report." : "Production report was updated to zero.",
        updatedBy: user._id,
      });
    }
  }

  const staleSources = await workspaceDb.collection<InventorySourceDocument>("inventory_sources")
    .find({ sourceType: "production" })
    .toArray();
  for (const source of staleSources) {
    if (desiredSourceIds.has(source._id)) continue;
    await applySourcedQuantity({
      db: workspaceDb,
      sourceId: source._id,
      sourceType: "production",
      code: source.code,
      product: source.product,
      category: source.category,
      price: source.price,
      desiredQuantity: 0,
      reason: "Production source reconciliation",
      notes: "Removed because the source report or molded BOM component no longer exists.",
      updatedBy: user._id,
    });
  }
}

async function syncWorkspaceInventory(user: UserDocument, workspaceDb: Db) {
  await syncDeliveredProcurementOrders(user, workspaceDb);
  await syncMoldedProduction(user, workspaceDb);
}

function serializeInventoryItem(record: InventoryItemDocument): InventoryItem {
  const part = masterPart(record._id);
  return {
    code: record._id,
    name: record.name || part?.name || record._id,
    category: record.category || part?.source || "Purchased",
    unit: record.unit ?? "pcs",
    quantity: record.quantity,
    batches: record.batches ?? 0,
    price: record.price ?? part?.rate ?? 0,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

async function readSubhubInventory(user: UserDocument, workspaceDb: Db): Promise<SubhubInventoryData> {
  const [records, movements, qualityLogs] = await Promise.all([
    workspaceDb.collection<InventoryItemDocument>("inventory_items").find().sort({ name: 1, _id: 1 }).toArray(),
    workspaceDb.collection<InventoryMovementDocument>("inventory_movements").find().sort({ createdAt: -1 }).limit(200).toArray(),
    workspaceDb.collection<QualityLogDocument>("quality_logs").find().sort({ createdAt: -1 }).toArray(),
  ]);
  const serializedQualityLogs = qualityLogs.map(serializeQualityLog);
  return {
    items: records.map(serializeInventoryItem),
    movements: movements.map((movement) => ({
      id: movement._id,
      date: movement.createdAt.toISOString(),
      type: movement.type,
      product: movement.product,
      code: movement.code,
      reference: movement.sourceId ?? `ADJ-${movement._id.slice(0, 8).toUpperCase()}`,
      change: movement.change,
      balance: movement.balance,
      reason: movement.reason,
      notes: movement.notes,
    })),
    qualityLogs: serializedQualityLogs,
    qualitySummary: {
      records: serializedQualityLogs.length,
      rejectedUnits: serializedQualityLogs.reduce((sum, log) => sum + log.quantity, 0),
    },
  };
}

export async function getSubhubInventory(): Promise<
  { ok: true; data: SubhubInventoryData } | { ok: false; data: SubhubInventoryData; message: string }
> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, data: emptyData(), message: "Only SubHub Managers can view workspace inventory." };
  const workspaceDb = await getMongoDb(user.databaseName);
  await syncWorkspaceInventory(user, workspaceDb);
  return { ok: true, data: await readSubhubInventory(user, workspaceDb) };
}

export async function adjustSubhubInventory(input: {
  code: string;
  action: "add" | "remove";
  quantity: number;
  reason: string;
  notes: string;
}): Promise<{ ok: true; data: SubhubInventoryData } | { ok: false; message: string }> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, message: "Only SubHub Managers can adjust workspace inventory." };
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, message: "Quantity must be a whole number greater than zero." };
  if (input.reason.trim().length < 2) return { ok: false, message: "Enter a reason for the stock adjustment." };

  const workspaceDb = await getMongoDb(user.databaseName);
  const existing = await workspaceDb.collection<InventoryItemDocument>("inventory_items").findOne({ _id: input.code });
  const part = masterPart(input.code);
  if (!existing && !part) return { ok: false, message: "Select a valid inventory item." };
  try {
    await applyInventoryDelta({
      db: workspaceDb,
      code: input.code,
      product: existing?.name || part?.name || input.code,
      category: existing?.category || part?.source || "Purchased",
      price: existing?.price ?? part?.rate ?? 0,
      change: input.action === "add" ? input.quantity : -input.quantity,
      reason: input.reason.trim(),
      notes: input.notes.trim(),
      updatedBy: user._id,
      sourceType: "manual",
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Stock adjustment could not be saved." };
  }
  return { ok: true, data: await readSubhubInventory(user, workspaceDb) };
}

export async function recordQualityIssue(input: {
  code: string;
  issue: QualityIssue;
  quantity: number;
  notes: string;
}): Promise<{ ok: true; data: SubhubInventoryData } | { ok: false; message: string }> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, message: "Only SubHub Managers can record quality issues." };
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, message: "Quantity must be a whole number greater than zero." };

  const workspaceDb = await getMongoDb(user.databaseName);
  const existing = await workspaceDb.collection<InventoryItemDocument>("inventory_items").findOne({ _id: input.code });
  if (!existing || existing.quantity < input.quantity) {
    return { ok: false, message: `Only ${existing?.quantity?.toLocaleString("en-IN") ?? "0"} units are available for quality review.` };
  }
  const product = existing.name || masterPart(input.code)?.name || input.code;
  const beforeQuantity = existing.quantity;
  const afterQuantity = beforeQuantity - input.quantity;
  const now = new Date();
  try {
    await applyInventoryDelta({
      db: workspaceDb,
      code: input.code,
      product,
      category: existing.category || masterPart(input.code)?.source || "Purchased",
      price: existing.price ?? masterPart(input.code)?.rate ?? 0,
      change: -input.quantity,
      reason: `Quality management · ${input.issue}`,
      notes: clean(input.notes),
      updatedBy: user._id,
      sourceType: "quality",
      movementType: "Quality rejected",
    });
    await workspaceDb.collection<QualityLogDocument>("quality_logs").insertOne({
      _id: randomUUID().replace(/-/g, ""),
      subhubUserId: user._id,
      subhubName: user.subhubName ?? user.name,
      code: input.code,
      product,
      category: existing.category || masterPart(input.code)?.source || "Purchased",
      issue: input.issue,
      quantity: input.quantity,
      beforeQuantity,
      afterQuantity,
      notes: clean(input.notes),
      recordedBy: user._id,
      recordedByName: user.name,
      createdAt: now,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Quality issue could not be recorded." };
  }
  return { ok: true, data: await readSubhubInventory(user, workspaceDb) };
}

export async function getMasterQualityManagement(): Promise<
  { ok: true; data: MasterQualityData } | { ok: false; data: MasterQualityData; message: string }
> {
  const user = await getCurrentUserRecord("admin");
  if (user?.panel !== "admin" || user.role !== "master_admin") {
    return { ok: false, data: emptyMasterQualityData(), message: "Only Master Admin users can view quality management across SubHubs." };
  }
  const controlDb = await getControlPlaneDatabase();
  const users = await controlDb.collection<UserDocument>("users").find({ panel: "subhub", role: "subhub" }).sort({ subhubName: 1, name: 1 }).toArray();
  const logsByUser = await Promise.all(users.map(async (subhub) => {
    const workspaceDb = await getMongoDb(subhub.databaseName);
    const logs = await workspaceDb.collection<QualityLogDocument>("quality_logs").find().sort({ createdAt: -1 }).toArray();
    return logs.map((log) => ({
      ...log,
      subhubUserId: subhub._id,
      subhubName: subhub.subhubName ?? subhub.name,
    }));
  }));
  const logs = logsByUser.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(serializeQualityLog);
  const subhubMap = new Map(users.map((subhub) => [subhub._id, { subhubUserId: subhub._id, subhubName: subhub.subhubName ?? subhub.name, records: 0, rejectedUnits: 0 }]));
  const reasonMap = new Map<QualityIssue, { issue: QualityIssue; records: number; rejectedUnits: number }>();
  logs.forEach((log) => {
    const subhub = subhubMap.get(log.subhubUserId);
    if (subhub) {
      subhub.records += 1;
      subhub.rejectedUnits += log.quantity;
    }
    const reason = reasonMap.get(log.issue) ?? { issue: log.issue, records: 0, rejectedUnits: 0 };
    reason.records += 1;
    reason.rejectedUnits += log.quantity;
    reasonMap.set(log.issue, reason);
  });
  return {
    ok: true,
    data: {
      logs,
      bySubhub: [...subhubMap.values()].sort((a, b) => b.rejectedUnits - a.rejectedUnits || a.subhubName.localeCompare(b.subhubName)),
      byReason: [...reasonMap.values()].sort((a, b) => b.rejectedUnits - a.rejectedUnits),
      summary: {
        records: logs.length,
        rejectedUnits: logs.reduce((sum, log) => sum + log.quantity, 0),
        subhubsWithIssues: [...subhubMap.values()].filter((subhub) => subhub.records > 0).length,
      },
    },
  };
}