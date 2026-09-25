import { createHash, randomUUID } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import { getCurrentUserRecord, getControlPlaneDatabase, type UserDocument } from "./auth.server";
import { bomCatalog } from "./lib/bom-catalog";
import { getMongoClient, getMongoDb } from "./mongodb.server";
import { subparts } from "./lib/erp-data";

export type InventoryCategory = "Float" | "Raw Material";
export type InventoryMovementType = "Stock added" | "Stock removed" | "Quality rejected";
export type QualityIssue = "Faulty" | "Damaged" | "Rejected" | "Expired" | "Other";
export type BatchMovementType = "IN" | "OUT" | "QUALITY" | "ADJUSTMENT" | "PRODUCTION";

export type InventoryBatch = {
  id: string; batchCode: string; itemCode: string; itemName: string; category: InventoryCategory;
  source: string; sourceReference: string; sourceMetadata: Record<string, string>;
  receivedQuantity: number; producedQuantity: number; consumedQuantity: number; defectiveQuantity: number;
  availableQuantity: number; status: "Available" | "Depleted"; loggedAt: string;
};
export type BatchMovement = {
  id: string; batchId: string; batchCode: string; itemCode: string; type: BatchMovementType;
  quantityDelta: number; balance: number; actor: string; reason: string; reference: string; createdAt: string;
};
export type BatchLineage = {
  id: string; parentBatchId: string; childBatchId: string; parentBatchCode: string; parentItemCode: string; parentItemName: string;
  childBatchCode: string; childItemCode: string; childItemName: string; quantity: number; reference: string; createdAt: string;
};
export type ProductionManualAllocation = { itemCode: string; batchId: string; quantity: number };
export type ProductionAllocationPreview = {
  reportId: string;
  requirements: Array<{ itemCode: string; itemName: string; requiredQuantity: number }>;
  batches: Array<{ id: string; batchCode: string; itemCode: string; itemName: string; availableQuantity: number; reservedByCurrentReport: number }>;
  currentAllocations: Array<{ itemCode: string; batchId: string; batchCode: string; quantity: number }>;
  allocationMode: "fifo" | "hybrid";
  manualAllocations: ProductionManualAllocation[];
  sufficient: boolean;
};

export type InventoryItem = {
  code: string;
  name: string;
  category: InventoryCategory;
  unit: "pcs";
  quantity: number;
  price: number;
  loggedAt: string | null;
};

export type InventoryItemDetail = {
  item: InventoryItem;
  batches: InventoryBatch[];
  batchMovements: BatchMovement[];
  movements: InventoryMovement[];
  qualityLogs: QualityLog[];
};

export type BatchTraceabilityData = {
  batch: InventoryBatch;
  movements: BatchMovement[];
  parents: BatchLineage[];
  children: BatchLineage[];
  qualityLogs: QualityLog[];
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
  batchCode?: string;
  /** Exact FIFO attribution; quantity remains the logical issue total. */
  allocations?: Array<{ batchId: string; batchCode: string; quantity: number }>;
};

export type SubhubInventoryData = {
  items: InventoryItem[];
  movements: InventoryMovement[];
  qualityLogs: QualityLog[];
  qualitySummary: {
    records: number;
    rejectedUnits: number;
  };
  batches: InventoryBatch[];
  batchMovements: BatchMovement[];
  consistencyWarnings: string[];
};
export type InventoryDataView = "inventory" | "history" | "quality" | "quality-history" | "adjustment" | "batches" | "all";

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
  category?: InventoryCategory | "Molded" | "Purchased";
  unit?: "pcs";
  quantity: number;
  price?: number;
  createdAt?: Date;
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
  sourceType?: "manual" | "procurement" | "production" | "float-production" | "quality";
  sourceId?: string;
  createdAt: Date;
};

type InventorySourceDocument = {
  _id: string;
  sourceType: "procurement" | "production" | "float-production";
  sourceId: string;
  code: string;
  product: string;
  category: InventoryCategory;
  price: number;
  quantityApplied: number;
  revision?: number;
  createdAt: Date;
  updatedAt: Date;
};

type QualityLogDocument = {
  _id: string;
  subhubUserId: string;
  subhubName: string;
  code: string;
  product: string;
  category: InventoryCategory | "Molded" | "Purchased";
  issue: QualityIssue;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  notes: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: Date;
  batchId?: string | undefined;
  batchCode?: string | undefined;
  allocations?: Array<{ batchId: string; batchCode: string; quantity: number }> | undefined;
};

type InventoryBatchDocument = {
  _id: string; batchCode: string; itemCode: string; itemName: string; category: InventoryCategory;
  sourceType: "procurement" | "production" | "float-production" | "manual" | "legacy";
  sourceId: string; sourceMetadata: Record<string, string>; receivedQuantity: number; producedQuantity: number;
  consumedQuantity: number; defectiveQuantity: number; availableQuantity: number; batchSequence?: number; createdAt: Date; updatedAt: Date;
};
type BatchSequenceDocument = { _id: string; itemCode: string; batchDate: string; nextSequence: number };
type BatchMovementDocument = {
  _id: string; sourceEventId: string; batchId: string; batchCode: string; itemCode: string;
  type: BatchMovementType; quantityDelta: number; balance: number; actor: string; reason: string; reference: string; createdAt: Date;
};
type BatchLineageDocument = {
  _id: string; sourceEventId: string; parentBatchId: string; childBatchId: string; quantity: number;
  reference: string; createdAt: Date; active?: boolean; revision?: number; supersededAt?: Date;
};

const batchIndexesPromises = new Map<string, Promise<void>>();
async function ensureBatchIndexes(db: Db) {
  let promise = batchIndexesPromises.get(db.databaseName);
  if (!promise) {
    promise = Promise.all([
    db.collection<InventoryBatchDocument>("inventory_batches").createIndex({ sourceId: 1 }, { unique: true }),
    db.collection<InventoryBatchDocument>("inventory_batches").createIndex({ itemCode: 1, availableQuantity: 1, createdAt: 1 }),
    db.collection<InventoryBatchDocument>("inventory_batches").createIndex({ batchCode: 1 }, { unique: true }),
    db.collection<BatchMovementDocument>("inventory_batch_movements").createIndex({ sourceEventId: 1 }, { unique: true }),
    db.collection<BatchMovementDocument>("inventory_batch_movements").createIndex({ batchId: 1, createdAt: -1 }),
    db.collection<BatchLineageDocument>("inventory_batch_lineage").createIndex({ sourceEventId: 1 }, { unique: true }),
    ]).then(() => undefined);
    batchIndexesPromises.set(db.databaseName, promise);
  }
  await promise;
}

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
  items?: Array<{
    lineId?: string;
    materialCode: string;
    materialName: string;
    quantity: number;
    unitPrice: number;
  }>;
};

function emptyData(): SubhubInventoryData {
  return { items: [], movements: [], qualityLogs: [], qualitySummary: { records: 0, rejectedUnits: 0 }, batches: [], batchMovements: [], consistencyWarnings: [] };
}

function restrictSubhubInventory(data: SubhubInventoryData): SubhubInventoryData {
  return {
    ...data,
    items: data.items.map((item) => ({ ...item, price: 0 })),
    movements: [],
    qualityLogs: data.qualityLogs.map(({ batchCode: _batchCode, allocations: _allocations, ...log }) => log),
    batches: [],
    batchMovements: [],
  };
}

function emptyMasterQualityData(): MasterQualityData {
  return { logs: [], bySubhub: [], byReason: [], summary: { records: 0, rejectedUnits: 0, subhubsWithIssues: 0 } };
}

function masterPart(code: string) {
  return subparts.find((part) => part.code === code);
}

function normalizeInventoryCategory(category: InventoryItemDocument["category"] | QualityLogDocument["category"] | undefined): InventoryCategory {
  return category === "Float" ? "Float" : "Raw Material";
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}
function sessionOptions(session: ClientSession | undefined) {
  return session ? { session } : {};
}

function batchDate(createdAt: Date) {
  return createdAt.toISOString().slice(0, 10).replace(/-/g, "");
}
function itemInitials(itemName: string, itemCode: string) {
  const words = (itemName || itemCode).normalize("NFKD").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const initials = (words.length ? words.map((word) => word[0]).join("") : itemCode.replace(/[^A-Za-z0-9]/g, ""))
    .slice(0, 8)
    .toUpperCase()
    .padEnd(1, "X");
  return initials;
}
function batchCode(itemName: string, itemCode: string, createdAt: Date, sequence: number) {
  return `${itemInitials(itemName, itemCode)}-${batchDate(createdAt)}-${sequence}`;
}
async function reserveBatchSequence(db: Db, itemCode: string, createdAt: Date, session?: ClientSession) {
  const date = batchDate(createdAt);
  const result = await db.collection<BatchSequenceDocument>("inventory_batch_sequences").findOneAndUpdate(
    { _id: `${itemCode}:${date}` },
    { $inc: { nextSequence: 1 }, $setOnInsert: { itemCode, batchDate: date } },
    { upsert: true, returnDocument: "after", ...sessionOptions(session) },
  );
  if (!result) throw new Error(`Could not reserve a batch number for ${itemCode}.`);
  return result.nextSequence;
}
async function ensureBatchSequenceAtLeast(db: Db, itemCode: string, createdAt: Date, sequence: number, session?: ClientSession) {
  const date = batchDate(createdAt);
  await db.collection<BatchSequenceDocument>("inventory_batch_sequences").updateOne(
    { _id: `${itemCode}:${date}` },
    { $max: { nextSequence: sequence }, $setOnInsert: { itemCode, batchDate: date } },
    { upsert: true, ...sessionOptions(session) },
  );
}
function serializeBatch(batch: InventoryBatchDocument): InventoryBatch {
  return {
    id: batch._id, batchCode: batch.batchCode, itemCode: batch.itemCode, itemName: batch.itemName, category: batch.category,
    source: batch.sourceType, sourceReference: batch.sourceId, sourceMetadata: batch.sourceMetadata,
    receivedQuantity: batch.receivedQuantity, producedQuantity: batch.producedQuantity, consumedQuantity: batch.consumedQuantity,
    defectiveQuantity: batch.defectiveQuantity, availableQuantity: batch.availableQuantity,
    status: batch.availableQuantity > 0 ? "Available" : "Depleted", loggedAt: batch.createdAt.toISOString(),
  };
}
function serializeBatchMovement(movement: BatchMovementDocument): BatchMovement {
  return { id: movement._id, batchId: movement.batchId, batchCode: movement.batchCode, itemCode: movement.itemCode, type: movement.type, quantityDelta: movement.quantityDelta, balance: movement.balance, actor: movement.actor, reason: movement.reason, reference: movement.reference, createdAt: movement.createdAt.toISOString() };
}

async function insertBatchMovement(db: Db, input: Omit<BatchMovementDocument, "_id" | "createdAt">) {
  try {
    await db.collection<BatchMovementDocument>("inventory_batch_movements").insertOne({ ...input, _id: randomUUID().replace(/-/g, ""), createdAt: new Date() });
  } catch (error) {
    // Idempotent source reconciliation deliberately replays source events on reads.
    if (!(error instanceof Error) || !error.message.includes("duplicate key")) throw error;
  }
}

async function writeTransactionalBatchMovement(
  db: Db,
  input: Omit<BatchMovementDocument, "_id" | "createdAt">,
  session: ClientSession,
) {
  const existing = await db.collection<BatchMovementDocument>("inventory_batch_movements")
    .findOne({ sourceEventId: input.sourceEventId }, { session });
  if (existing) {
    if (
      existing.batchId !== input.batchId
      || existing.quantityDelta !== input.quantityDelta
      || existing.balance !== input.balance
      || existing.type !== input.type
    ) throw new Error(`Inventory event ${input.sourceEventId} conflicts with an existing movement.`);
    return;
  }
  await db.collection<BatchMovementDocument>("inventory_batch_movements").insertOne({
    ...input,
    _id: createHash("sha256").update(input.sourceEventId).digest("hex"),
    createdAt: new Date(),
  }, { session });
}

export async function applySourcedBatch(input: {
  db: Db; sourceId: string; sourceType: InventoryBatchDocument["sourceType"]; code: string; product: string; category: InventoryCategory;
  desiredQuantity: number; actor: string; reason: string; metadata?: Record<string, string>;
  session?: ClientSession | undefined;
  eventKey?: string;
  eventType?: BatchMovementType;
}) {
  await ensureBatchIndexes(input.db);
  const batches = input.db.collection<InventoryBatchDocument>("inventory_batches");
  const existing = await batches.findOne({ sourceId: input.sourceId }, sessionOptions(input.session));
  const produced = input.sourceType === "production" || input.sourceType === "float-production" ? input.desiredQuantity : 0;
  if (!existing) {
    const createdAt = new Date();
    const sequence = await reserveBatchSequence(input.db, input.code, createdAt, input.session);
    const batch: InventoryBatchDocument = { _id: input.sourceId, batchCode: batchCode(input.product, input.code, createdAt, sequence), batchSequence: sequence, itemCode: input.code, itemName: input.product, category: input.category, sourceType: input.sourceType, sourceId: input.sourceId, sourceMetadata: input.metadata ?? {}, receivedQuantity: input.sourceType === "procurement" || input.sourceType === "manual" || input.sourceType === "legacy" ? input.desiredQuantity : 0, producedQuantity: produced, consumedQuantity: 0, defectiveQuantity: 0, availableQuantity: input.desiredQuantity, createdAt, updatedAt: createdAt };
    await batches.insertOne(batch, sessionOptions(input.session));
    const event = { sourceEventId: input.eventKey ?? `${input.sourceId}:initial:${input.desiredQuantity}`, batchId: batch._id, batchCode: batch.batchCode, itemCode: batch.itemCode, type: input.eventType ?? (input.sourceType === "production" || input.sourceType === "float-production" ? "PRODUCTION" as const : "IN" as const), quantityDelta: input.desiredQuantity, balance: input.desiredQuantity, actor: input.actor, reason: input.reason, reference: input.sourceId };
    if (input.session) await writeTransactionalBatchMovement(input.db, event, input.session);
    else await insertBatchMovement(input.db, event);
    return batch;
  }
  const priorTotal = existing.receivedQuantity + existing.producedQuantity;
  const delta = input.desiredQuantity - priorTotal;
  // A source edit can never erase stock already consumed or rejected.
  if (input.desiredQuantity < existing.consumedQuantity + existing.defectiveQuantity) throw new Error(`Source ${input.sourceId} cannot be reduced below its allocated quantity.`);
  if (delta) {
    const available = existing.availableQuantity + delta;
    const received = input.sourceType === "procurement" || input.sourceType === "manual" || input.sourceType === "legacy"
      ? input.desiredQuantity
      : 0;
    const result = await batches.updateOne({ _id: existing._id, availableQuantity: { $gte: -delta } }, { $set: { receivedQuantity: received, producedQuantity: produced, availableQuantity: available, itemName: input.product, sourceMetadata: input.metadata ?? existing.sourceMetadata, updatedAt: new Date() } }, sessionOptions(input.session));
    if (!result.modifiedCount) throw new Error(`Source ${input.sourceId} changed concurrently or has insufficient unallocated stock.`);
    const event = { sourceEventId: input.eventKey ?? `${input.sourceId}:reconcile:${input.desiredQuantity}`, batchId: existing._id, batchCode: existing.batchCode, itemCode: existing.itemCode, type: input.eventType ?? "ADJUSTMENT" as const, quantityDelta: delta, balance: available, actor: input.actor, reason: input.reason, reference: input.sourceId };
    if (input.session) await writeTransactionalBatchMovement(input.db, event, input.session);
    else await insertBatchMovement(input.db, event);
  }
  return { ...existing, availableQuantity: existing.availableQuantity + delta };
}

export async function ensureLegacyBatches(db: Db, actor: string) {
  await ensureBatchIndexes(db);
  const warnings = new Set<string>();
  const itemIds = await db.collection<InventoryItemDocument>("inventory_items")
    .find({}, { projection: { _id: 1 } }).map((item) => item._id).toArray();
  const client = await getMongoClient();
  for (const itemId of itemIds) {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const item = await db.collection<InventoryItemDocument>("inventory_items").findOne({ _id: itemId }, { session });
        if (!item) return;
        const totals = await db.collection<InventoryBatchDocument>("inventory_batches").aggregate<{ total: number }>([
          { $match: { itemCode: itemId } },
          { $group: { _id: null, total: { $sum: "$availableQuantity" } } },
        ], { session }).toArray();
        const tracked = totals[0]?.total ?? 0;
        const difference = item.quantity - tracked;
        if (difference < 0) {
          warnings.add(`${item.name || itemId} (${itemId}) has ${tracked - item.quantity} more batch-tracked units than its aggregate balance. Automatic repair was skipped.`);
          return;
        }
        if (!difference) return;
        const legacySourceId = `legacy:${itemId}`;
        const legacy = await db.collection<InventoryBatchDocument>("inventory_batches")
          .findOne({ sourceId: legacySourceId }, { session });
        const priorTotal = (legacy?.receivedQuantity ?? 0) + (legacy?.producedQuantity ?? 0);
        const desiredTotal = priorTotal + difference;
        await applySourcedBatch({
          db, sourceId: legacySourceId, sourceType: "legacy", code: itemId,
          product: item.name || itemId, category: normalizeInventoryCategory(item.category),
          desiredQuantity: desiredTotal, actor, reason: "Legacy aggregate inventory opening balance",
          metadata: { note: "Untracked historical stock; exact lineage is unavailable." },
          session, eventKey: `${legacySourceId}:desired:${desiredTotal}`,
        });
      });
    } finally {
      await session.endSession();
    }
  }
  return [...warnings];
}

async function migrateBatchCodes(db: Db) {
  await ensureBatchIndexes(db);
  const batches = await db.collection<InventoryBatchDocument>("inventory_batches").find().sort({ createdAt: 1, _id: 1 }).toArray();
  const numericCode = /^([A-Z0-9]+)-(\d{8})-(\d+)$/;
  for (const batch of batches) {
    const client = await getMongoClient();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const current = await db.collection<InventoryBatchDocument>("inventory_batches").findOne({ _id: batch._id }, { session });
        if (!current) return;
        const match = current.batchCode.match(numericCode);
        const expectedInitials = itemInitials(current.itemName, current.itemCode);
        const expectedDate = batchDate(current.createdAt);
        let sequence = current.batchSequence;
        if (!sequence && match?.[1] === expectedInitials && match[2] === expectedDate) sequence = Number(match[3]);
        if (sequence && match?.[1] === expectedInitials && match[2] === expectedDate && match[3] === String(sequence)) {
          await ensureBatchSequenceAtLeast(db, current.itemCode, current.createdAt, sequence, session);
          if (!current.batchSequence) {
            await db.collection<InventoryBatchDocument>("inventory_batches").updateOne(
              { _id: current._id },
              { $set: { batchSequence: sequence } },
              { session },
            );
          }
          return;
        }
        sequence = await reserveBatchSequence(db, current.itemCode, current.createdAt, session);
        let desiredCode = batchCode(current.itemName, current.itemCode, current.createdAt, sequence);
        while (await db.collection<InventoryBatchDocument>("inventory_batches").findOne({ _id: { $ne: current._id }, batchCode: desiredCode }, { session })) {
          sequence = await reserveBatchSequence(db, current.itemCode, current.createdAt, session);
          desiredCode = batchCode(current.itemName, current.itemCode, current.createdAt, sequence);
        }
        const changed = await db.collection<InventoryBatchDocument>("inventory_batches").updateOne(
          { _id: current._id, batchCode: current.batchCode },
          { $set: { batchCode: desiredCode, batchSequence: sequence, updatedAt: new Date() } },
          { session },
        );
        if (!changed.modifiedCount) return;
        await db.collection<BatchMovementDocument>("inventory_batch_movements").updateMany(
          { batchId: current._id },
          { $set: { batchCode: desiredCode } },
          { session },
        );
        const qualityLogs = await db.collection<QualityLogDocument>("quality_logs").find({
          $or: [{ batchId: current._id }, { "allocations.batchId": current._id }],
        }, { session }).toArray();
        for (const log of qualityLogs) {
          const allocations = log.allocations?.map((allocation) => allocation.batchId === current._id ? { ...allocation, batchCode: desiredCode } : allocation);
          const batchCodes = allocations?.map((allocation) => allocation.batchCode).join(", ");
          await db.collection<QualityLogDocument>("quality_logs").updateOne(
            { _id: log._id },
            {
              $set: {
                ...(log.batchId === current._id ? { batchCode: desiredCode } : {}),
                ...(allocations ? { allocations, ...(batchCodes ? { batchCode: batchCodes } : {}) } : {}),
              },
            },
            { session },
          );
        }
        await db.collection("inventory_production_allocations").updateMany(
          { "allocations.batchId": current._id },
          { $set: { "allocations.$[allocation].batchCode": desiredCode } },
          { arrayFilters: [{ "allocation.batchId": current._id }], session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
}

const batchCodeMigrationPromises = new Map<string, Promise<void>>();
async function migrateBatchCodesOnce(db: Db) {
  const markerCollection = db.collection<{ _id: string; completedAt: Date }>("inventory_maintenance");
  if (await markerCollection.findOne({ _id: "batch-codes-v1" })) return;
  let promise = batchCodeMigrationPromises.get(db.databaseName);
  if (!promise) {
    promise = (async () => {
      if (await markerCollection.findOne({ _id: "batch-codes-v1" })) return;
      await migrateBatchCodes(db);
      await markerCollection.updateOne(
        { _id: "batch-codes-v1" },
        { $set: { completedAt: new Date() } },
        { upsert: true },
      );
    })();
    batchCodeMigrationPromises.set(db.databaseName, promise);
  }
  try {
    await promise;
  } catch (error) {
    batchCodeMigrationPromises.delete(db.databaseName);
    throw error;
  }
}

export async function allocateBatches(input: { db: Db; code: string; quantity: number; batchId?: string; type: "OUT" | "QUALITY"; actor: string; reason: string; reference: string; session?: ClientSession | undefined }) {
  await ensureBatchIndexes(input.db);
  const batches = input.db.collection<InventoryBatchDocument>("inventory_batches");
  const candidates = input.batchId
    ? await batches.find({ _id: input.batchId, itemCode: input.code, availableQuantity: { $gt: 0 } }, sessionOptions(input.session)).toArray()
    : await batches.find({ itemCode: input.code, availableQuantity: { $gt: 0 } }, sessionOptions(input.session)).sort({ createdAt: 1, _id: 1 }).toArray();
  let remaining = input.quantity;
  const plan = candidates.map((batch) => {
    const quantity = Math.min(batch.availableQuantity, remaining); remaining -= quantity;
    return { batch, quantity };
  }).filter((entry) => entry.quantity);
  if (remaining) throw new Error(`Only ${input.quantity - remaining} batch-tracked units are available for ${input.code}.`);
  for (const { batch, quantity } of plan) {
    const result = await batches.updateOne({ _id: batch._id, availableQuantity: { $gte: quantity } }, { $inc: { availableQuantity: -quantity, ...(input.type === "QUALITY" ? { defectiveQuantity: quantity } : { consumedQuantity: quantity }) }, $set: { updatedAt: new Date() } }, sessionOptions(input.session));
    if (!result.modifiedCount) throw new Error(`Batch ${batch.batchCode} changed before allocation; refresh and try again.`);
    const event = { sourceEventId: `${input.reference}:${batch._id}`, batchId: batch._id, batchCode: batch.batchCode, itemCode: batch.itemCode, type: input.type, quantityDelta: -quantity, balance: batch.availableQuantity - quantity, actor: input.actor, reason: input.reason, reference: input.reference };
    if (input.session) await writeTransactionalBatchMovement(input.db, event, input.session);
    else await insertBatchMovement(input.db, event);
  }
  return plan.map(({ batch, quantity }) => ({ batchId: batch._id, batchCode: batch.batchCode, quantity }));
}

type ProductionAllocationDocument = {
  _id: string; revision: number; outputBatchId: string; allocations: Array<{ batchId: string; itemCode: string; quantity: number }>;
  allocationMode?: "fifo" | "hybrid"; manualAllocations?: ProductionManualAllocation[]; signature?: string; pendingSignature?: string; updatedAt: Date;
};
/** Reconciles an editable report by reversing its previous allocation before allocating its current BOM.
 * Reversals are append-only movements; the allocation document is only current-state bookkeeping. */
export async function reconcileProductionBatchAllocation(input: {
  db: Db; reportId: string; reportDate: string; outputCode: string; outputName: string; quantity: number;
  requirements: Record<string, number>; actor: string; notes: string; manualAllocations?: ProductionManualAllocation[] | undefined;
  session?: ClientSession | undefined;
}): Promise<boolean> {
  if (!input.session) await ensureLegacyBatches(input.db, input.actor);
  const states = input.db.collection<ProductionAllocationDocument>("inventory_production_allocations");
  const batches = input.db.collection<InventoryBatchDocument>("inventory_batches");
  const existing = await states.findOne({ _id: input.reportId }, sessionOptions(input.session));
  const desired = Object.entries(input.requirements).map(([itemCode, units]) => ({ itemCode, quantity: units * input.quantity })).filter((entry) => entry.quantity);
  desired.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  const desiredByCode = new Map(desired.map((row) => [row.itemCode, row.quantity]));
  const manualAllocations = input.manualAllocations ?? [];
  const manualByCode = new Map<string, ProductionManualAllocation[]>();
  const seenBatches = new Set<string>();
  for (const allocation of manualAllocations) {
    if (!Number.isInteger(allocation.quantity) || allocation.quantity < 1) throw new Error("Manual batch allocations must use positive whole quantities.");
    if (!desiredByCode.has(allocation.itemCode)) throw new Error(`Manual allocation item ${allocation.itemCode} is not required by this BOM.`);
    if (seenBatches.has(allocation.batchId)) throw new Error("A batch can only be selected once in a production allocation.");
    seenBatches.add(allocation.batchId);
    const rows = manualByCode.get(allocation.itemCode) ?? [];
    rows.push(allocation);
    manualByCode.set(allocation.itemCode, rows);
  }
  for (const [itemCode, rows] of manualByCode) {
    if (rows.reduce((sum, row) => sum + row.quantity, 0) !== desiredByCode.get(itemCode)) {
      throw new Error(`Manual allocations for ${itemCode} must exactly equal its BOM requirement.`);
    }
  }
  const normalizedManual = [...manualAllocations].sort((a, b) => a.itemCode.localeCompare(b.itemCode) || a.batchId.localeCompare(b.batchId));
  const allocationMode: "fifo" | "hybrid" = normalizedManual.length ? "hybrid" : "fifo";
  const signature = JSON.stringify({ desired, allocationMode, manualAllocations: normalizedManual });
  const existingTotals = new Map<string, number>();
  existing?.allocations.forEach((allocation) => existingTotals.set(allocation.itemCode, (existingTotals.get(allocation.itemCode) ?? 0) + allocation.quantity));
  const currentSignature = existing ? JSON.stringify({
    desired: [...existingTotals.entries()]
      .map(([itemCode, quantity]) => ({ itemCode, quantity })).sort((a, b) => a.itemCode.localeCompare(b.itemCode)),
    allocationMode: existing.allocationMode ?? "fifo",
    manualAllocations: [...(existing.manualAllocations ?? [])].sort((a, b) => a.itemCode.localeCompare(b.itemCode) || a.batchId.localeCompare(b.batchId)),
  }) : "";
  const signatureUnchanged = Boolean(existing && signature === (existing.signature ?? currentSignature));
  const outputBatch = existing
    ? await batches.findOne({ _id: existing.outputBatchId || `float-production:${input.reportId}` }, sessionOptions(input.session))
    : null;
  if (signatureUnchanged) {
    if (outputBatch) {
      await batches.updateOne(
        { _id: outputBatch._id },
        { $set: { sourceMetadata: { ...outputBatch.sourceMetadata, reportDate: input.reportDate, notes: input.notes }, updatedAt: new Date() } },
        sessionOptions(input.session),
      );
    }
    return false;
  }
  const derivedBatches = await batches.find({
    $or: [
      { _id: `float-production:${input.reportId}` },
      { sourceId: `float-production:${input.reportId}` },
      { _id: { $regex: `^production:${input.reportId}:` } },
      { sourceId: { $regex: `^production:${input.reportId}:` } },
    ],
  }, sessionOptions(input.session)).toArray();
  const lockedBatch = derivedBatches.find((batch) => batch.consumedQuantity > 0 || batch.defectiveQuantity > 0);
  if (lockedBatch) {
    throw new Error(`Production materials cannot be changed because batch ${lockedBatch.batchCode} (${lockedBatch.itemCode}) has already been consumed or quality-rejected. Notes may still be edited.`);
  }
  const revision = (existing?.revision ?? 0) + 1;
  if (existing) {
    const lock = await states.updateOne(
      { _id: input.reportId, revision: existing.revision, pendingSignature: { $exists: false } },
      { $set: { pendingSignature: signature, updatedAt: new Date() } },
      sessionOptions(input.session),
    );
    if (!lock.modifiedCount) throw new Error("Production report changed concurrently; retry the save.");
  } else {
    await states.insertOne({
      _id: input.reportId, revision: 0, outputBatchId: `float-production:${input.reportId}`,
      allocations: [], allocationMode, manualAllocations: normalizedManual,
      pendingSignature: signature, updatedAt: new Date(),
    }, sessionOptions(input.session));
  }
  const priorByCode = new Map<string, number>();
  existing?.allocations.forEach((allocation) => priorByCode.set(allocation.itemCode, (priorByCode.get(allocation.itemCode) ?? 0) + allocation.quantity));
  const priorByBatch = new Map<string, number>();
  existing?.allocations.forEach((allocation) => priorByBatch.set(allocation.batchId, (priorByBatch.get(allocation.batchId) ?? 0) + allocation.quantity));
  if (normalizedManual.length) {
    const selected = await batches.find({ _id: { $in: normalizedManual.map((row) => row.batchId) } }, sessionOptions(input.session)).toArray();
    const selectedById = new Map(selected.map((batch) => [batch._id, batch]));
    for (const allocation of normalizedManual) {
      const batch = selectedById.get(allocation.batchId);
      if (!batch || batch.itemCode !== allocation.itemCode) throw new Error(`Selected batch does not match BOM item ${allocation.itemCode}.`);
      if (batch.availableQuantity + (priorByBatch.get(batch._id) ?? 0) < allocation.quantity) throw new Error(`Only ${batch.availableQuantity + (priorByBatch.get(batch._id) ?? 0)} units are available in selected batch ${batch.batchCode}.`);
    }
  }
  for (const requirement of desired) {
    const available = await batches.aggregate<{ total: number }>([{ $match: { itemCode: requirement.itemCode } }, { $group: { _id: null, total: { $sum: "$availableQuantity" } } }], sessionOptions(input.session)).toArray();
    if ((available[0]?.total ?? 0) + (priorByCode.get(requirement.itemCode) ?? 0) < requirement.quantity) throw new Error(`Insufficient batch stock for production requirement ${requirement.itemCode}.`);
  }
  // Return previously consumed stock before testing/reapplying the changed report.
  if (existing) {
    for (const allocation of existing.allocations) {
      const batch = await batches.findOne({ _id: allocation.batchId }, sessionOptions(input.session));
      if (!batch) throw new Error("A previously allocated production batch no longer exists.");
      const reversed = await batches.updateOne({ _id: batch._id, consumedQuantity: { $gte: allocation.quantity } }, { $inc: { availableQuantity: allocation.quantity, consumedQuantity: -allocation.quantity }, $set: { updatedAt: new Date() } }, sessionOptions(input.session));
      if (!reversed.modifiedCount) throw new Error(`Previously allocated batch ${batch.batchCode} cannot be safely reversed.`);
      const aggregate = await input.db.collection<InventoryItemDocument>("inventory_items").updateOne({ _id: allocation.itemCode }, { $inc: { quantity: allocation.quantity }, $set: { updatedAt: new Date(), updatedBy: input.actor } }, sessionOptions(input.session));
      if (!aggregate.modifiedCount) throw new Error(`Aggregate inventory ${allocation.itemCode} is missing.`);
      const event = { sourceEventId: `${input.reportId}:reversal:${revision}:${batch._id}`, batchId: batch._id, batchCode: batch.batchCode, itemCode: allocation.itemCode, type: "ADJUSTMENT" as const, quantityDelta: allocation.quantity, balance: batch.availableQuantity + allocation.quantity, actor: input.actor, reason: "Production report allocation reversal", reference: input.reportId };
      if (input.session) await writeTransactionalBatchMovement(input.db, event, input.session); else await insertBatchMovement(input.db, event);
    }
  }
  const allocations: ProductionAllocationDocument["allocations"] = [];
  try {
    for (const requirement of desired) {
      const manualRows = manualByCode.get(requirement.itemCode);
      let allocated: Array<{ batchId: string; batchCode: string; quantity: number }>;
      if (manualRows) {
        const manualPlans = await Promise.all(manualRows.map((row) => allocateBatches({ db: input.db, code: requirement.itemCode, quantity: row.quantity, batchId: row.batchId, type: "OUT", actor: input.actor, reason: `Production consumption · ${input.outputCode}`, reference: `${input.reportId}:allocation:${revision}:${requirement.itemCode}:${row.batchId}`, session: input.session })));
        allocated = manualPlans.flat();
      } else {
        allocated = await allocateBatches({ db: input.db, code: requirement.itemCode, quantity: requirement.quantity, type: "OUT", actor: input.actor, reason: `Production consumption · ${input.outputCode}`, reference: `${input.reportId}:allocation:${revision}:${requirement.itemCode}`, session: input.session });
      }
      for (const row of allocated) {
        allocations.push({ batchId: row.batchId, itemCode: requirement.itemCode, quantity: row.quantity });
        const aggregate = await input.db.collection<InventoryItemDocument>("inventory_items").updateOne({ _id: requirement.itemCode, quantity: { $gte: row.quantity } }, { $inc: { quantity: -row.quantity }, $set: { updatedAt: new Date(), updatedBy: input.actor } }, sessionOptions(input.session));
        if (!aggregate.modifiedCount) throw new Error(`Insufficient aggregate stock for production requirement ${requirement.itemCode}.`);
      }
    }
  } catch (error) {
    if (input.session) throw error;
    // Compensate this attempted revision so a rejected edit never leaves stock consumed.
    for (const allocation of allocations) {
      await batches.updateOne({ _id: allocation.batchId }, { $inc: { availableQuantity: allocation.quantity, consumedQuantity: -allocation.quantity } });
      await input.db.collection<InventoryItemDocument>("inventory_items").updateOne({ _id: allocation.itemCode }, { $inc: { quantity: allocation.quantity } });
    }
    // Reinstate the old state as a compensating action; no immutable movement is removed.
    for (const allocation of existing?.allocations ?? []) {
      await batches.updateOne({ _id: allocation.batchId }, { $inc: { availableQuantity: -allocation.quantity, consumedQuantity: allocation.quantity } });
      await input.db.collection<InventoryItemDocument>("inventory_items").updateOne({ _id: allocation.itemCode }, { $inc: { quantity: -allocation.quantity } });
    }
    throw error;
  }
  const outputSourceId = `float-production:${input.reportId}`;
  await applySourcedQuantity({ db: input.db, sourceId: outputSourceId, sourceType: "float-production", code: input.outputCode, product: input.outputName, category: "Float", price: 0, desiredQuantity: input.quantity, reason: `Final product production · ${input.reportDate}`, notes: input.notes, updatedBy: input.actor, batchMetadata: { reportDate: input.reportDate, notes: input.notes }, session: input.session, eventKey: `${input.reportId}:output:${revision}` });
  const desiredMoldedSourceIds = new Set<string>();
  for (const [code, unitsPerAssembly] of Object.entries(input.requirements)) {
    const part = masterPart(code);
    if (!part || part.source !== "Molded") continue;
    const sourceId = `production:${input.reportId}:${code}`;
    desiredMoldedSourceIds.add(sourceId);
    await applySourcedQuantity({
      db: input.db, sourceId, sourceType: "production", code, product: part.name,
      category: "Raw Material", price: part.rate, desiredQuantity: input.quantity * unitsPerAssembly,
      reason: `Molding output · ${input.outputCode} · ${input.reportDate}`,
      notes: input.notes, updatedBy: input.actor, session: input.session,
      eventKey: `${input.reportId}:molded:${revision}:${code}`,
    });
  }
  const priorMoldedSources = await input.db.collection<InventorySourceDocument>("inventory_sources")
    .find({ sourceType: "production", _id: { $regex: `^production:${input.reportId}:` } }, sessionOptions(input.session))
    .toArray();
  for (const source of priorMoldedSources) {
    if (desiredMoldedSourceIds.has(source._id)) continue;
    await applySourcedQuantity({
      db: input.db, sourceId: source._id, sourceType: "production", code: source.code,
      product: source.product, category: source.category, price: source.price, desiredQuantity: 0,
      reason: "Production report source reconciliation", notes: input.notes,
      updatedBy: input.actor, session: input.session,
      eventKey: `${input.reportId}:molded:${revision}:${source.code}:removed`,
    });
  }
  await input.db.collection<BatchLineageDocument>("inventory_batch_lineage").updateMany(
    { reference: input.reportId, active: { $ne: false } },
    { $set: { active: false, supersededAt: new Date() } },
    sessionOptions(input.session),
  );
  for (const allocation of allocations) {
    const sourceEventId = `${input.reportId}:lineage:${revision}:${allocation.batchId}`;
    await input.db.collection<BatchLineageDocument>("inventory_batch_lineage").updateOne(
      { sourceEventId },
      { $setOnInsert: { _id: createHash("sha256").update(sourceEventId).digest("hex"), sourceEventId, parentBatchId: allocation.batchId, childBatchId: outputSourceId, quantity: allocation.quantity, reference: input.reportId, createdAt: new Date(), active: true, revision } },
      { upsert: true, ...sessionOptions(input.session) },
    );
  }
  const finalized = await states.replaceOne(
    { _id: input.reportId, revision: existing?.revision ?? 0, pendingSignature: signature },
    { revision, outputBatchId: outputSourceId, allocations, allocationMode, manualAllocations: normalizedManual, signature, updatedAt: new Date() },
    sessionOptions(input.session),
  );
  if (!finalized.modifiedCount) throw new Error("Production allocation lock was lost before commit.");
  return true;
}

export async function getProductionBatchAllocationPreview(input: {
  db: Db; reportId: string; requirements: Record<string, number>; quantity: number; actor: string;
}): Promise<ProductionAllocationPreview> {
  await ensureLegacyBatches(input.db, input.actor);
  const desired = Object.entries(input.requirements)
    .map(([itemCode, units]) => ({ itemCode, requiredQuantity: units * input.quantity }))
    .filter((row) => row.requiredQuantity)
    .sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  const state = await input.db.collection<ProductionAllocationDocument>("inventory_production_allocations").findOne({ _id: input.reportId });
  const reservedByBatch = new Map<string, number>();
  state?.allocations.forEach((row) => reservedByBatch.set(row.batchId, (reservedByBatch.get(row.batchId) ?? 0) + row.quantity));
  const codes = desired.map((row) => row.itemCode);
  const batches = await input.db.collection<InventoryBatchDocument>("inventory_batches")
    .find({ itemCode: { $in: codes } }).sort({ createdAt: 1, _id: 1 }).toArray();
  const batchesById = new Map(batches.map((batch) => [batch._id, batch]));
  const visibleBatches = batches
    .map((batch) => ({
      id: batch._id, batchCode: batch.batchCode, itemCode: batch.itemCode, itemName: batch.itemName,
      availableQuantity: batch.availableQuantity + (reservedByBatch.get(batch._id) ?? 0),
      reservedByCurrentReport: reservedByBatch.get(batch._id) ?? 0,
    }))
    .filter((batch) => batch.availableQuantity > 0);
  const availableByCode = new Map<string, number>();
  visibleBatches.forEach((batch) => availableByCode.set(batch.itemCode, (availableByCode.get(batch.itemCode) ?? 0) + batch.availableQuantity));
  return {
    reportId: input.reportId,
    requirements: desired.map((row) => ({ ...row, itemName: batches.find((batch) => batch.itemCode === row.itemCode)?.itemName ?? masterPart(row.itemCode)?.name ?? row.itemCode })),
    batches: visibleBatches,
    currentAllocations: (state?.allocations ?? []).map((row) => ({ itemCode: row.itemCode, batchId: row.batchId, batchCode: batchesById.get(row.batchId)?.batchCode ?? row.batchId, quantity: row.quantity })),
    allocationMode: state?.allocationMode ?? "fifo",
    manualAllocations: state?.manualAllocations ?? [],
    sufficient: desired.every((row) => (availableByCode.get(row.itemCode) ?? 0) >= row.requiredQuantity),
  };
}

export async function getProductionBatchAllocationState(db: Db, reportId: string) {
  const state = await db.collection<ProductionAllocationDocument>("inventory_production_allocations").findOne({ _id: reportId });
  if (!state) return undefined;
  const batches = await db.collection<InventoryBatchDocument>("inventory_batches").find({ _id: { $in: state.allocations.map((row) => row.batchId) } }).toArray();
  const batchById = new Map(batches.map((batch) => [batch._id, batch]));
  return {
    allocationMode: state.allocationMode ?? "fifo" as const,
    manualAllocations: state.manualAllocations ?? [],
    allocations: state.allocations.map((row) => ({ itemCode: row.itemCode, batchId: row.batchId, batchCode: batchById.get(row.batchId)?.batchCode ?? row.batchId, quantity: row.quantity })),
  };
}

function serializeQualityLog(log: QualityLogDocument): QualityLog {
  return {
    id: log._id,
    subhubUserId: log.subhubUserId,
    subhubName: log.subhubName,
    date: log.createdAt.toISOString(),
    code: log.code,
    product: log.product,
    category: normalizeInventoryCategory(log.category),
    issue: log.issue,
    quantity: log.quantity,
    beforeQuantity: log.beforeQuantity,
    afterQuantity: log.afterQuantity,
    notes: log.notes,
    recordedBy: log.recordedBy,
    recordedByName: log.recordedByName,
    ...(log.batchCode ? { batchCode: log.batchCode } : {}),
    ...(log.allocations ? { allocations: log.allocations } : {}),
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
  session?: ClientSession | undefined;
  movementId?: string;
}) {
  const collection = input.db.collection<InventoryItemDocument>("inventory_items");
  const now = new Date();
  // Do not calculate a replacement quantity from a stale read.  The $gte
  // predicate and $inc are one atomic operation, so simultaneous removals
  // cannot overdraw (or overwrite) an item balance.
  const item = await collection.findOneAndUpdate(
    input.change < 0
      ? { _id: input.code, quantity: { $gte: -input.change } }
      : { _id: input.code },
    {
      $set: {
        name: input.product,
        category: input.category,
        unit: "pcs",
        price: input.price,
        updatedAt: now,
        updatedBy: input.updatedBy,
      },
      $inc: { quantity: input.change },
      $setOnInsert: { createdAt: now },
    },
    { upsert: input.change >= 0, returnDocument: "after", ...sessionOptions(input.session) },
  );
  if (!item) throw new Error(`Cannot remove more stock than is available for ${input.product}.`);
  const nextQuantity = item.quantity;
  const currentQuantity = nextQuantity - input.change;

  await input.db.collection<InventoryMovementDocument>("inventory_movements").insertOne({
    _id: input.movementId ?? randomUUID().replace(/-/g, ""),
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
  }, sessionOptions(input.session));
  return { currentQuantity, nextQuantity };
}

async function applySourcedQuantity(input: {
  db: Db;
  sourceId: string;
  sourceType: "procurement" | "production" | "float-production";
  code: string;
  product: string;
  category: InventoryCategory;
  price: number;
  desiredQuantity: number;
  reason: string;
  notes: string;
  updatedBy: string;
  batchMetadata?: Record<string, string>;
  session?: ClientSession | undefined;
  eventKey?: string;
}) {
  await ensureBatchIndexes(input.db);
  if (!input.session) {
    const client = await getMongoClient();
    const session = client.startSession();
    try {
      let warnings: string[] = [];
      await session.withTransaction(async () => {
        warnings = await applySourcedQuantity({ ...input, session });
      });
      return warnings;
    } catch (error) {
      throw new Error(error instanceof Error
        ? `Source ${input.sourceId} was not synchronized: ${error.message}`
        : `Source ${input.sourceId} transaction could not be committed.`);
    } finally {
      await session.endSession();
    }
  }
  const sources = input.db.collection<InventorySourceDocument>("inventory_sources");
  const existing = await sources.findOne({ _id: input.sourceId }, { session: input.session });
  if (existing?.quantityApplied === input.desiredQuantity) {
    const sourcedBatch = await input.db.collection<InventoryBatchDocument>("inventory_batches")
      .findOne({ sourceId: input.sourceId }, { session: input.session });
    const sourcedTotal = (sourcedBatch?.receivedQuantity ?? 0) + (sourcedBatch?.producedQuantity ?? 0);
    const missing = Math.max(0, input.desiredQuantity - sourcedTotal);
    if (!missing) return [];
    const legacySourceId = `legacy:${input.code}`;
    const legacy = await input.db.collection<InventoryBatchDocument>("inventory_batches")
      .findOne({ sourceId: legacySourceId }, { session: input.session });
    const transferable = Math.min(missing, legacy?.availableQuantity ?? 0, legacy?.receivedQuantity ?? 0);
    if (transferable > 0 && legacy) {
      const reduced = await input.db.collection<InventoryBatchDocument>("inventory_batches").updateOne(
        { _id: legacy._id, availableQuantity: { $gte: transferable }, receivedQuantity: { $gte: transferable } },
        { $inc: { availableQuantity: -transferable, receivedQuantity: -transferable }, $set: { updatedAt: new Date() } },
        { session: input.session },
      );
      if (!reduced.modifiedCount) throw new Error(`Legacy batch ${legacy.batchCode} changed during source migration.`);
      await writeTransactionalBatchMovement(input.db, {
        sourceEventId: `${input.sourceId}:migration:legacy:${sourcedTotal + transferable}`,
        batchId: legacy._id, batchCode: legacy.batchCode, itemCode: input.code, type: "ADJUSTMENT",
        quantityDelta: -transferable, balance: legacy.availableQuantity - transferable,
        actor: input.updatedBy, reason: `Legacy attribution migrated to ${input.sourceId}`, reference: input.sourceId,
      }, input.session);
      await applySourcedBatch({
        db: input.db, sourceId: input.sourceId, sourceType: input.sourceType, code: input.code,
        product: input.product, category: input.category, desiredQuantity: sourcedTotal + transferable,
        actor: input.updatedBy, reason: `Source attribution backfill · ${input.reason}`,
        ...(input.batchMetadata ? { metadata: input.batchMetadata } : {}),
        session: input.session,
        eventKey: `${input.sourceId}:migration:sourced:${sourcedTotal + transferable}`,
        eventType: "ADJUSTMENT",
      });
    }
    if (transferable < missing) {
      return [`Source ${input.sourceId} is missing ${missing - transferable} batch-attributed units; available legacy stock was insufficient for a safe backfill.`];
    }
    return [];
  }
  const revision = (existing?.revision ?? 0) + 1;
  const eventKey = input.eventKey ?? `${input.sourceId}:desired:${input.desiredQuantity}:revision:${revision}`;
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
      session: input.session,
      movementId: createHash("sha256").update(`${eventKey}:aggregate`).digest("hex"),
    });
  }
  const now = new Date();
  const sourceResult = await sources.updateOne(
    existing
      ? { _id: input.sourceId, quantityApplied: existing.quantityApplied }
      : { _id: input.sourceId, quantityApplied: { $exists: false } },
    {
      $set: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        code: input.code,
        product: input.product,
        category: input.category,
        price: input.price,
        quantityApplied: input.desiredQuantity,
        revision,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: !existing, session: input.session },
  );
  if (!sourceResult.modifiedCount && !sourceResult.upsertedCount) {
    throw new Error(`Source ${input.sourceId} changed concurrently.`);
  }
  await applySourcedBatch({
    db: input.db, sourceId: input.sourceId, sourceType: input.sourceType, code: input.code, product: input.product,
    category: input.category, desiredQuantity: input.desiredQuantity, actor: input.updatedBy, reason: input.reason,
    ...(input.batchMetadata ? { metadata: input.batchMetadata } : {}),
    session: input.session,
    eventKey: `${eventKey}:batch`,
  });
  return [];
}

async function syncDeliveredProcurementOrders(user: UserDocument, workspaceDb: Db) {
  const warnings: string[] = [];
  const controlDb = await getControlPlaneDatabase();
  const orders = await controlDb.collection<DeliveredProcurementDocument & { subhubUserId: string; status: string }>("procurement_orders")
    .find({ subhubUserId: user._id, status: "Delivery done" })
    .toArray();

  for (const order of orders) {
    const items = order.items?.length
      ? order.items.map((item, index) => ({
          ...item,
          sourceId: `procurement:${order._id}:${item.lineId ?? `${index}-${item.materialCode}`}`,
        }))
      : [{
          materialCode: order.materialCode,
          materialName: order.materialName,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          sourceId: `procurement:${order._id}`,
        }];
    for (const item of items) {
      const part = masterPart(item.materialCode);
      warnings.push(...await applySourcedQuantity({
        db: workspaceDb,
        sourceId: item.sourceId,
        sourceType: "procurement",
        code: item.materialCode,
        product: item.materialName || part?.name || item.materialCode,
        category: "Raw Material",
        price: item.unitPrice || part?.rate || 0,
        desiredQuantity: item.quantity,
        reason: `Procurement receipt · ${order.orderNumber}`,
        notes: "Added automatically when the procurement order reached Delivery done.",
        updatedBy: user._id,
        batchMetadata: { poNumber: order.orderNumber, vendor: (order as DeliveredProcurementDocument & { vendorName?: string }).vendorName ?? "", orderDate: (order as DeliveredProcurementDocument & { orderDate?: Date }).orderDate?.toISOString() ?? "" },
      }));
    }
  }
  return warnings;
}

async function syncMoldedProduction(user: UserDocument, workspaceDb: Db, excludedReportId?: string) {
  const warnings: string[] = [];
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
      if (report._id === excludedReportId) continue;
      warnings.push(...await applySourcedQuantity({
        db: workspaceDb,
        sourceId,
        sourceType: "production",
        code,
        product: part.name,
        category: "Raw Material",
        price: part.rate,
        desiredQuantity: report.quantity * unitsPerAssembly,
        reason: `Molding output · ${order.variantCode} · ${report.date}`,
        notes: report.quantity ? "Added automatically from the saved daily production report." : "Production report was updated to zero.",
        updatedBy: user._id,
      }));
    }
  }

  const staleSources = await workspaceDb.collection<InventorySourceDocument>("inventory_sources")
    .find({ sourceType: "production" })
    .toArray();
  for (const source of staleSources) {
    if (desiredSourceIds.has(source._id)) continue;
    warnings.push(...await applySourcedQuantity({
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
    }));
  }
  return warnings;
}

async function syncFloatProduction(user: UserDocument, workspaceDb: Db, excludedReportId?: string) {
  const warnings: string[] = [];
  const reports = await workspaceDb.collection<ProductionReportDocument>("production_reports").find().toArray();
  const controlDb = await getControlPlaneDatabase();
  const orders = await controlDb.collection<ProductionOrderDocument>("production_orders")
    .find({ _id: { $in: reports.map((report) => report.orderId) } })
    .toArray();
  const orderById = new Map(orders.map((order) => [order._id, order]));
  const desiredSourceIds = new Set<string>();

  for (const report of reports) {
    const order = orderById.get(report.orderId);
    const product = order ? bomCatalog.find((candidate) => candidate.code === order.productCode) : undefined;
    const variant = product?.variants.find((candidate) => candidate.code === order?.variantCode);
    if (!order || !product || !variant) continue;
    const sourceId = `float-production:${report._id}`;
    const floatCode = `${product.code}-${variant.code}`;
    desiredSourceIds.add(sourceId);
    if (report._id === excludedReportId) continue;
    warnings.push(...await applySourcedQuantity({
      db: workspaceDb,
      sourceId,
      sourceType: "float-production",
      code: floatCode,
      product: `${product.name} · ${variant.name}`,
      category: "Float",
      price: 0,
      desiredQuantity: report.quantity,
      reason: `Float production · ${variant.code} · ${report.date}`,
      notes: report.quantity ? "Added automatically from the saved daily production report." : "Production report was updated to zero.",
      updatedBy: user._id,
    }));
  }

  const staleSources = await workspaceDb.collection<InventorySourceDocument>("inventory_sources")
    .find({ sourceType: "float-production" })
    .toArray();
  for (const source of staleSources) {
    if (desiredSourceIds.has(source._id)) continue;
    warnings.push(...await applySourcedQuantity({
      db: workspaceDb,
      sourceId: source._id,
      sourceType: "float-production",
      code: source.code,
      product: source.product,
      category: "Float",
      price: 0,
      desiredQuantity: 0,
      reason: "Float production reconciliation",
      notes: "Removed because the source report or BOM variant no longer exists.",
      updatedBy: user._id,
    }));
  }
  return warnings;
}

const inventorySyncStates = new Map<string, { completedAt: number; warnings: string[]; inFlight?: Promise<string[]> }>();
const INVENTORY_SYNC_CACHE_MS = 15_000;
export async function syncWorkspaceInventoryForUser(user: UserDocument, workspaceDb: Db, excludedReportId?: string, options: { force?: boolean } = {}) {
  const key = workspaceDb.databaseName;
  const state = inventorySyncStates.get(key);
  if (state?.inFlight) {
    const warnings = await state.inFlight;
    if (!options.force) return warnings;
  }
  const latestState = inventorySyncStates.get(key);
  if (!options.force && latestState && Date.now() - latestState.completedAt < INVENTORY_SYNC_CACHE_MS) return latestState.warnings;
  const promise = (async () => {
    const warnings = [
      ...await syncDeliveredProcurementOrders(user, workspaceDb),
      ...await syncMoldedProduction(user, workspaceDb, excludedReportId),
      ...await syncFloatProduction(user, workspaceDb, excludedReportId),
      ...await ensureLegacyBatches(workspaceDb, user._id),
    ];
    await migrateBatchCodesOnce(workspaceDb);
    return [...new Set(warnings)];
  })();
  inventorySyncStates.set(key, { completedAt: 0, warnings: [], inFlight: promise });
  try {
    const warnings = await promise;
    inventorySyncStates.set(key, { completedAt: Date.now(), warnings });
    return warnings;
  } catch (error) {
    inventorySyncStates.delete(key);
    throw error;
  }
}

async function syncWorkspaceInventory(user: UserDocument, workspaceDb: Db) {
  return syncWorkspaceInventoryForUser(user, workspaceDb, undefined, { force: true });
}

function serializeInventoryItem(record: InventoryItemDocument): InventoryItem {
  const part = masterPart(record._id);
  return {
    code: record._id,
    name: record.name || part?.name || record._id,
    category: normalizeInventoryCategory(record.category),
    unit: record.unit ?? "pcs",
    quantity: record.quantity,
    price: record.price ?? part?.rate ?? 0,
    loggedAt: record.createdAt?.toISOString() ?? record.updatedAt?.toISOString() ?? null,
  };
}

function masterInventoryItems(): Array<{
  _id: string;
  name: string;
  category: InventoryCategory;
  unit: "pcs";
  quantity: number;
  price: number;
}> {
  const rawMaterials = subparts.map((part) => ({
    _id: part.code,
    name: part.name,
    category: "Raw Material" as const,
    unit: "pcs" as const,
    quantity: 0,
    price: part.rate,
  }));
  const finalProducts = bomCatalog.flatMap((product) =>
    product.variants.map((variant) => ({
      _id: `${product.code}-${variant.code}`,
      name: `${product.name} · ${variant.name}`,
      category: "Float" as const,
      unit: "pcs" as const,
      quantity: 0,
      price: 0,
    })),
  );
  return [...rawMaterials, ...finalProducts];
}

async function ensureMasterInventoryItems(user: UserDocument, workspaceDb: Db): Promise<void> {
  const catalog = masterInventoryItems();
  const existing = await workspaceDb.collection<InventoryItemDocument>("inventory_items")
    .find({ _id: { $in: catalog.map((item) => item._id) } }, { projection: { _id: 1 } })
    .toArray();
  const existingCodes = new Set(existing.map((item) => item._id));
  const missing = catalog.filter((item) => !existingCodes.has(item._id));
  if (!missing.length) return;

  const timestamp = new Date();
  await workspaceDb.collection<InventoryItemDocument>("inventory_items").bulkWrite(
    missing.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: {
          $setOnInsert: {
            ...item,
            createdAt: timestamp,
            updatedAt: timestamp,
            updatedBy: user._id,
          },
        },
        upsert: true,
      },
    })),
  );
}

async function readSubhubInventory(user: UserDocument, workspaceDb: Db, consistencyWarnings: string[] = [], view: InventoryDataView = "all"): Promise<SubhubInventoryData> {
  const includeItems = view === "inventory" || view === "quality" || view === "adjustment" || view === "all";
  const includeMovements = view === "all";
  const includeQuality = view === "quality" || view === "quality-history" || view === "all";
  const includeBatches = view === "adjustment" || view === "batches" || view === "all";
  const includeBatchMovements = view === "history" || view === "all";
  if (includeItems) await ensureMasterInventoryItems(user, workspaceDb);
  const [records, movements, qualityLogs, batches, batchMovements] = await Promise.all([
    includeItems ? workspaceDb.collection<InventoryItemDocument>("inventory_items").find({}, { projection: { _id: 1, name: 1, category: 1, unit: 1, quantity: 1, price: 1, createdAt: 1, updatedAt: 1 } }).sort({ name: 1, _id: 1 }).toArray() : Promise.resolve([]),
    includeMovements ? workspaceDb.collection<InventoryMovementDocument>("inventory_movements").find({}, { projection: { _id: 1, createdAt: 1, type: 1, product: 1, code: 1, sourceId: 1, change: 1, balance: 1, reason: 1, notes: 1 } }).sort({ createdAt: -1 }).limit(200).toArray() : Promise.resolve([]),
    includeQuality ? workspaceDb.collection<QualityLogDocument>("quality_logs").find().sort({ createdAt: -1 }).toArray() : Promise.resolve([]),
    includeBatches ? workspaceDb.collection<InventoryBatchDocument>("inventory_batches").find().sort({ createdAt: -1 }).toArray() : Promise.resolve([]),
    includeBatchMovements ? workspaceDb.collection<BatchMovementDocument>("inventory_batch_movements").find().sort({ createdAt: -1 }).limit(500).toArray() : Promise.resolve([]),
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
    batches: batches.map(serializeBatch),
    batchMovements: batchMovements.map(serializeBatchMovement),
    consistencyWarnings,
  };
}

export async function getWorkspaceInventorySnapshot(user: UserDocument, workspaceDb: Db): Promise<SubhubInventoryData> {
  const consistencyWarnings = await syncWorkspaceInventoryForUser(user, workspaceDb);
  return readSubhubInventory(user, workspaceDb, consistencyWarnings, "all");
}

type ManagedInventoryPanel = "admin" | "procurement";

type ManagedWorkspaceResult =
  | { ok: true; hub: UserDocument; workspaceDb: Db }
  | { ok: false; message: string };

async function resolveManagedWorkspace(panel: ManagedInventoryPanel, hubId: string): Promise<ManagedWorkspaceResult> {
  const staff = await getCurrentUserRecord(panel);
  const authorized = panel === "admin"
    ? staff?.panel === "admin" && (staff.role === "master_admin" || staff.role === "admin")
    : staff?.panel === "procurement" && staff.role === "procurement_manager";
  if (!authorized) {
    return { ok: false, message: "Only Master Admin and Procurement users can view hub batch inventory." };
  }

  const controlDb = await getControlPlaneDatabase();
  const hub = await controlDb.collection<UserDocument>("users").findOne({
    _id: hubId,
    panel: "subhub",
    role: "subhub",
  });
  if (!hub) return { ok: false, message: "The requested SubHub could not be found." };

  const workspaceDb = await getMongoDb(hub.databaseName);
  await syncWorkspaceInventoryForUser(hub, workspaceDb);
  return { ok: true, hub, workspaceDb };
}

export async function getManagedHubBatches(panel: ManagedInventoryPanel, hubId: string): Promise<
  { ok: true; batches: InventoryBatch[] } | { ok: false; batches: []; message: string }
> {
  const workspace = await resolveManagedWorkspace(panel, hubId);
  if (!workspace.ok) return { ok: false, batches: [], message: workspace.message };
  const data = await readSubhubInventory(workspace.hub, workspace.workspaceDb, [], "batches");
  return { ok: true, batches: data.batches };
}

export async function getManagedHubBatchDetail(panel: ManagedInventoryPanel, hubId: string, batchId: string): Promise<
  { ok: true; data: BatchTraceabilityData } | { ok: false; message: string }
> {
  const workspace = await resolveManagedWorkspace(panel, hubId);
  if (!workspace.ok) return { ok: false, message: workspace.message };
  return readBatchDetail(workspace.workspaceDb, batchId);
}

export async function getManagedHubItemDetail(panel: ManagedInventoryPanel, hubId: string, itemCode: string): Promise<
  { ok: true; data: InventoryItemDetail } | { ok: false; message: string }
> {
  const workspace = await resolveManagedWorkspace(panel, hubId);
  if (!workspace.ok) return { ok: false, message: workspace.message };
  return readInventoryItemDetail(workspace.workspaceDb, itemCode);
}

export async function getSubhubInventory(view: InventoryDataView = "inventory"): Promise<
  { ok: true; data: SubhubInventoryData } | { ok: false; data: SubhubInventoryData; message: string }
> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, data: emptyData(), message: "Only SubHub Managers can view workspace inventory." };
  if (view !== "inventory" && view !== "quality" && view !== "quality-history") {
    return { ok: false, data: emptyData(), message: "Batch registers and inventory traceability are not available in the SubHub panel." };
  }
  const workspaceDb = await getMongoDb(user.databaseName);
  const consistencyWarnings = view === "quality-history" ? [] : await syncWorkspaceInventoryForUser(user, workspaceDb);
  const data = await readSubhubInventory(user, workspaceDb, consistencyWarnings, view);
  return { ok: true, data: restrictSubhubInventory(data) };
}

export type AdjustInventoryInput = {
  code: string;
  targetQuantity: number;
  reason: string;
  notes: string;
  batchId?: string | undefined;
};

export async function adjustSubhubInventory(input: AdjustInventoryInput): Promise<{ ok: true; data: SubhubInventoryData } | { ok: false; message: string }> {
  return adjustSubhubInventoryBatch([input]);
}

export async function adjustSubhubInventoryBatch(inputs: AdjustInventoryInput[]): Promise<{ ok: true; data: SubhubInventoryData } | { ok: false; message: string }> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, message: "Only SubHub Managers can adjust workspace inventory." };
  if (!inputs.length) return { ok: false, message: "Add at least one stock adjustment before saving." };
  if (inputs.some((input) => !Number.isInteger(input.targetQuantity) || input.targetQuantity < 0)) return { ok: false, message: "Every updated count must be a whole number of zero or more." };
  if (inputs.some((input) => input.reason.trim().length < 2)) return { ok: false, message: "Enter a reason for every stock adjustment." };
  if (new Set(inputs.map((input) => input.code)).size !== inputs.length) return { ok: false, message: "Submit only one updated count for each inventory item." };

  const workspaceDb = await getMongoDb(user.databaseName);
  const operations = inputs.map(() => `adjustment:${randomUUID().replace(/-/g, "")}`);
  try {
    await syncWorkspaceInventory(user, workspaceDb);
    const client = await getMongoClient();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const codes = inputs.map((input) => input.code);
        const existingItems = await workspaceDb.collection<InventoryItemDocument>("inventory_items")
          .find({ _id: { $in: codes } }, { session }).toArray();
        const existingByCode = new Map(existingItems.map((item) => [item._id, item]));
        const changes = inputs.map((input, index) => {
          const existing = existingByCode.get(input.code);
          if (!existing && !masterPart(input.code)) throw new Error(`Select a valid inventory item: ${input.code}.`);
          return {
            input,
            existing,
            delta: input.targetQuantity - (existing?.quantity ?? 0),
            reference: operations[index]!,
          };
        });
        for (const { input, existing, delta } of changes) {
          if (delta < 0 && -delta > (existing?.quantity ?? 0)) {
            throw new Error(`Only ${existing?.quantity?.toLocaleString("en-IN") ?? "0"} units are available for ${input.code}.`);
          }
        }
        for (const { input, existing, delta, reference } of changes) {
          if (delta === 0) continue;
          const part = masterPart(input.code);
          const reason = input.reason.trim() === "Quantity increase" || input.reason.trim() === "Quantity decrease"
            ? delta > 0 ? "Quantity increase" : "Quantity decrease"
            : input.reason.trim();
          if (delta < 0) {
            await allocateBatches({
              db: workspaceDb, code: input.code, quantity: -delta,
              ...(input.batchId ? { batchId: input.batchId } : {}),
              type: "OUT", actor: user._id, reason, reference, session,
            });
          }
          await applyInventoryDelta({
            db: workspaceDb, code: input.code, product: existing?.name || part?.name || input.code,
            category: normalizeInventoryCategory(existing?.category), price: existing?.price ?? part?.rate ?? 0,
            change: delta,
            reason, notes: input.notes.trim(), updatedBy: user._id,
            sourceType: "manual", sourceId: reference, session,
            movementId: createHash("sha256").update(`${reference}:aggregate`).digest("hex"),
          });
          if (delta > 0) {
            await applySourcedBatch({
              db: workspaceDb, sourceId: reference, sourceType: "manual", code: input.code,
              product: existing?.name || part?.name || input.code,
              category: normalizeInventoryCategory(existing?.category), desiredQuantity: delta,
              actor: user._id, reason, metadata: { notes: input.notes.trim() },
              session, eventKey: `${reference}:batch`,
            });
          }
        }
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? `Stock adjustments were not saved: ${error.message}` : "Stock adjustment transaction could not be committed." };
  }
  const data = await readSubhubInventory(user, workspaceDb, [], "inventory");
  return { ok: true, data: restrictSubhubInventory(data) };
}

export type RecordQualityIssueInput = {
  code: string;
  issue: QualityIssue;
  quantity: number;
  notes: string;
  batchId?: string | undefined;
};

async function recordQualityIssueForWorkspace(
  user: UserDocument,
  workspaceDb: Db,
  input: RecordQualityIssueInput,
  operation: { reference: string; logId: string },
  session: ClientSession,
) {
  const existing = await workspaceDb.collection<InventoryItemDocument>("inventory_items")
    .findOne({ _id: input.code }, { session });
  if (!existing || existing.quantity < input.quantity) {
    throw new Error(`Only ${existing?.quantity?.toLocaleString("en-IN") ?? "0"} units are available for quality review of ${input.code}.`);
  }
  const product = existing.name || masterPart(input.code)?.name || input.code;
  const now = new Date();
  const allocations = await allocateBatches({
    db: workspaceDb, code: input.code, quantity: input.quantity,
    ...(input.batchId ? { batchId: input.batchId } : {}),
    type: "QUALITY", actor: user._id, reason: `Quality management · ${input.issue}`,
    reference: operation.reference, session,
  });
  const aggregate = await applyInventoryDelta({
    db: workspaceDb,
    code: input.code,
    product,
    category: normalizeInventoryCategory(existing.category),
    price: existing.price ?? masterPart(input.code)?.rate ?? 0,
    change: -input.quantity,
    reason: `Quality management · ${input.issue}`,
    notes: clean(input.notes),
    updatedBy: user._id,
    sourceType: "quality",
    sourceId: operation.reference,
    movementType: "Quality rejected",
    session,
    movementId: createHash("sha256").update(`${operation.reference}:aggregate`).digest("hex"),
  });
  await workspaceDb.collection<QualityLogDocument>("quality_logs").insertOne({
    _id: operation.logId,
    subhubUserId: user._id,
    subhubName: user.subhubName ?? user.name,
    code: input.code,
    product,
    category: normalizeInventoryCategory(existing.category),
    issue: input.issue,
    quantity: input.quantity,
    beforeQuantity: aggregate.currentQuantity,
    afterQuantity: aggregate.nextQuantity,
    notes: clean(input.notes),
    recordedBy: user._id,
    recordedByName: user.name,
    createdAt: now,
    batchId: allocations[0]?.batchId,
    batchCode: allocations.map((allocation) => allocation.batchCode).join(", "),
    allocations,
  }, { session });
}

export async function recordQualityIssues(inputs: RecordQualityIssueInput[]): Promise<
  { ok: true; data: SubhubInventoryData } | { ok: false; message: string }
> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, message: "Only SubHub Managers can record quality issues." };
  if (!inputs.length) return { ok: false, message: "Add at least one quality issue before saving." };
  if (inputs.some((input) => !Number.isInteger(input.quantity) || input.quantity < 1)) return { ok: false, message: "Every quality quantity must be a whole number greater than zero." };

  const workspaceDb = await getMongoDb(user.databaseName);
  const operations = inputs.map((_, index) => {
    const operationId = randomUUID().replace(/-/g, "");
    return {
      reference: `quality:${operationId}:${index}`,
      logId: createHash("sha256").update(`quality:${operationId}:${index}:log`).digest("hex"),
    };
  });
  try {
    await syncWorkspaceInventory(user, workspaceDb);
    const client = await getMongoClient();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const requestedByCode = new Map<string, number>();
        inputs.forEach((input) => requestedByCode.set(input.code, (requestedByCode.get(input.code) ?? 0) + input.quantity));
        const existingItems = await workspaceDb.collection<InventoryItemDocument>("inventory_items")
          .find({ _id: { $in: [...requestedByCode.keys()] } }, { session }).toArray();
        const existingByCode = new Map(existingItems.map((item) => [item._id, item]));
        for (const [code, quantity] of requestedByCode) {
          const existing = existingByCode.get(code);
          if (!existing || existing.quantity < quantity) {
            throw new Error(`Only ${existing?.quantity?.toLocaleString("en-IN") ?? "0"} units are available for quality review of ${code}.`);
          }
        }
        const requestedByBatch = new Map<string, number>();
        inputs.filter((input) => input.batchId).forEach((input) => requestedByBatch.set(input.batchId!, (requestedByBatch.get(input.batchId!) ?? 0) + input.quantity));
        if (requestedByBatch.size) {
          const batchRecords = await workspaceDb.collection<InventoryBatchDocument>("inventory_batches")
            .find({ _id: { $in: [...requestedByBatch.keys()] } }, { session }).toArray();
          const byId = new Map(batchRecords.map((batch) => [batch._id, batch]));
          for (const [batchId, quantity] of requestedByBatch) {
            const batch = byId.get(batchId);
            if (!batch || batch.availableQuantity < quantity) {
              throw new Error(`Only ${batch?.availableQuantity ?? 0} units are available in selected batch ${batch?.batchCode ?? batchId}.`);
            }
          }
        }
        for (const [index, input] of inputs.entries()) {
          await recordQualityIssueForWorkspace(user, workspaceDb, input, operations[index]!, session);
        }
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? `No quality issues were saved: ${error.message}` : "Quality transaction could not be committed." };
  }
  const data = await readSubhubInventory(user, workspaceDb, [], "quality");
  return { ok: true, data: restrictSubhubInventory(data) };
}

export async function recordQualityIssue(input: RecordQualityIssueInput) {
  return recordQualityIssues([input]);
}

export async function getBatchDetail(_batchId: string): Promise<{ ok: true; batch: InventoryBatch; movements: BatchMovement[]; parents: BatchLineage[]; children: BatchLineage[]; qualityLogs: QualityLog[] } | { ok: false; message: string }> {
  return { ok: false, message: "Use the protected Master Admin or Procurement batch view." };
}

async function readBatchDetail(db: Db, batchId: string): Promise<
  { ok: true; data: BatchTraceabilityData } | { ok: false; message: string }
> {
  const batch = await db.collection<InventoryBatchDocument>("inventory_batches").findOne({ _id: batchId });
  if (!batch) return { ok: false, message: "Batch not found." };
  const [movements, parents, children, qualityLogs] = await Promise.all([
    db.collection<BatchMovementDocument>("inventory_batch_movements").find({ batchId }).sort({ createdAt: -1 }).toArray(),
    db.collection<BatchLineageDocument>("inventory_batch_lineage").find({ childBatchId: batchId, active: { $ne: false } }).toArray(),
    db.collection<BatchLineageDocument>("inventory_batch_lineage").find({ parentBatchId: batchId, active: { $ne: false } }).toArray(),
    db.collection<QualityLogDocument>("quality_logs").find({
      $or: [{ batchId }, { "allocations.batchId": batchId }],
    }).sort({ createdAt: -1 }).toArray(),
  ]);
  const linkedIds = [...new Set([...parents.flatMap((row) => [row.parentBatchId, row.childBatchId]), ...children.flatMap((row) => [row.parentBatchId, row.childBatchId])])];
  const linked = await db.collection<InventoryBatchDocument>("inventory_batches").find({ _id: { $in: linkedIds } }).toArray();
  const linkedById = new Map(linked.map((row) => [row._id, row]));
  const lineage = (row: BatchLineageDocument): BatchLineage => {
    const parent = linkedById.get(row.parentBatchId);
    const child = linkedById.get(row.childBatchId);
    return { id: row._id, parentBatchId: row.parentBatchId, childBatchId: row.childBatchId, parentBatchCode: parent?.batchCode ?? row.parentBatchId, parentItemCode: parent?.itemCode ?? "", parentItemName: parent?.itemName ?? "", childBatchCode: child?.batchCode ?? row.childBatchId, childItemCode: child?.itemCode ?? "", childItemName: child?.itemName ?? "", quantity: row.quantity, reference: row.reference, createdAt: row.createdAt.toISOString() };
  };
  const batchQualityLogs = qualityLogs.map((log) => {
    const serialized = serializeQualityLog(log);
    const portion = log.allocations?.find((allocation) => allocation.batchId === batchId);
    return portion
      ? { ...serialized, quantity: portion.quantity, batchCode: portion.batchCode, allocations: [portion] }
      : serialized;
  });
  return { ok: true, data: { batch: serializeBatch(batch), movements: movements.map(serializeBatchMovement), parents: parents.map(lineage), children: children.map(lineage), qualityLogs: batchQualityLogs } };
}

export async function getInventoryItemDetail(_code: string): Promise<{ ok: true; data: InventoryItemDetail } | { ok: false; message: string }> {
  return { ok: false, message: "Use the protected Master Admin or Procurement item view." };
}

async function readInventoryItemDetail(db: Db, code: string): Promise<
  { ok: true; data: InventoryItemDetail } | { ok: false; message: string }
> {
  const item = await db.collection<InventoryItemDocument>("inventory_items").findOne({ _id: code });
  if (!item) return { ok: false, message: "Inventory item not found." };
  const [batches, batchMovements, movements, qualityLogs] = await Promise.all([
    db.collection<InventoryBatchDocument>("inventory_batches")
      .find({ itemCode: code, availableQuantity: { $gt: 0 } })
      .sort({ createdAt: 1, _id: 1 })
      .toArray(),
    db.collection<BatchMovementDocument>("inventory_batch_movements")
      .find({ itemCode: code })
      .sort({ createdAt: -1 })
      .toArray(),
    db.collection<InventoryMovementDocument>("inventory_movements")
      .find({ code })
      .sort({ createdAt: -1 })
      .toArray(),
    db.collection<QualityLogDocument>("quality_logs")
      .find({ code })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);
  return {
    ok: true,
    data: {
      item: serializeInventoryItem(item),
      batches: batches.map(serializeBatch),
      batchMovements: batchMovements.map(serializeBatchMovement),
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
      qualityLogs: qualityLogs.map(serializeQualityLog),
    },
  };
}

export async function getBatchOptions(code: string): Promise<{ ok: true; batches: InventoryBatch[] } | { ok: false; message: string }> {
  const user = await getCurrentUserRecord("subhub");
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, message: "Only SubHub Managers can view batch options." };
  const db = await getMongoDb(user.databaseName);
  await syncWorkspaceInventory(user, db);
  const batches = await db.collection<InventoryBatchDocument>("inventory_batches").find({ itemCode: code, availableQuantity: { $gt: 0 } }).sort({ createdAt: 1, _id: 1 }).toArray();
  return { ok: true, batches: batches.map(serializeBatch) };
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