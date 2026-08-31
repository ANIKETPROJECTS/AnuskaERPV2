import { randomUUID } from "node:crypto";
import { getCurrentUserRecord } from "./auth.server";
import { getMongoDb } from "./mongodb.server";
import { subparts } from "./lib/erp-data";

export type InventoryItem = {
  code: string;
  name: string;
  category: "Molded" | "Purchased";
  unit: "pcs";
  quantity: number;
  batches: number;
  price: number;
  updatedAt: string | null;
};

export type InventoryMovement = {
  id: string;
  date: string;
  type: "Stock added" | "Stock removed";
  product: string;
  code: string;
  reference: string;
  change: number;
  balance: number;
  reason: string;
  notes: string;
};

export type SubhubInventoryData = {
  items: InventoryItem[];
  movements: InventoryMovement[];
};

type InventoryItemDocument = {
  _id: string;
  quantity: number;
  batches: number;
  updatedAt: Date;
  updatedBy: string;
};

type InventoryMovementDocument = {
  _id: string;
  code: string;
  product: string;
  type: InventoryMovement["type"];
  change: number;
  balance: number;
  reason: string;
  notes: string;
  createdAt: Date;
};

function emptyData(): SubhubInventoryData {
  return { items: [], movements: [] };
}

export async function getSubhubInventory(): Promise<
  { ok: true; data: SubhubInventoryData } | { ok: false; data: SubhubInventoryData; message: string }
> {
  const user = await getCurrentUserRecord();
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, data: emptyData(), message: "Only SubHub Managers can view workspace inventory." };
  const db = await getMongoDb(user.databaseName);
  const records = await db.collection<InventoryItemDocument>("inventory_items").find().toArray();
  const recordByCode = new Map(records.map((record) => [record._id, record]));
  const items = subparts.map((part) => {
    const record = recordByCode.get(part.code);
    return {
      code: part.code,
      name: part.name,
      category: part.source,
      unit: "pcs" as const,
      quantity: record?.quantity ?? 0,
      batches: record?.batches ?? 0,
      price: part.rate,
      updatedAt: record?.updatedAt.toISOString() ?? null,
    };
  });
  const movements = (await db.collection<InventoryMovementDocument>("inventory_movements").find().sort({ createdAt: -1 }).limit(100).toArray()).map((movement) => ({
    id: movement._id,
    date: movement.createdAt.toISOString(),
    type: movement.type,
    product: movement.product,
    code: movement.code,
    reference: `ADJ-${movement._id.slice(0, 8).toUpperCase()}`,
    change: movement.change,
    balance: movement.balance,
    reason: movement.reason,
    notes: movement.notes,
  }));
  return { ok: true, data: { items, movements } };
}

export async function adjustSubhubInventory(input: {
  code: string;
  action: "add" | "remove";
  quantity: number;
  reason: string;
  notes: string;
}): Promise<{ ok: true; data: SubhubInventoryData } | { ok: false; message: string }> {
  const user = await getCurrentUserRecord();
  if (user?.panel !== "subhub" || user.role !== "subhub") return { ok: false, message: "Only SubHub Managers can adjust workspace inventory." };
  const part = subparts.find((item) => item.code === input.code);
  if (!part) return { ok: false, message: "Select a valid raw material." };
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, message: "Quantity must be a whole number greater than zero." };
  if (input.reason.trim().length < 2) return { ok: false, message: "Enter a reason for the stock adjustment." };

  const db = await getMongoDb(user.databaseName);
  const existing = await db.collection<InventoryItemDocument>("inventory_items").findOne({ _id: part.code });
  const currentQuantity = existing?.quantity ?? 0;
  const change = input.action === "add" ? input.quantity : -input.quantity;
  const nextQuantity = currentQuantity + change;
  if (nextQuantity < 0) return { ok: false, message: `Cannot remove ${input.quantity.toLocaleString("en-IN")} units; only ${currentQuantity.toLocaleString("en-IN")} are available.` };
  const now = new Date();
  await db.collection<InventoryItemDocument>("inventory_items").updateOne(
    { _id: part.code },
    { $set: { quantity: nextQuantity, updatedAt: now, updatedBy: user._id, batches: input.action === "add" ? (existing?.batches ?? 0) + 1 : existing?.batches ?? 0 } },
    { upsert: true },
  );
  await db.collection<InventoryMovementDocument>("inventory_movements").insertOne({
    _id: randomUUID().replace(/-/g, ""),
    code: part.code,
    product: part.name,
    type: input.action === "add" ? "Stock added" : "Stock removed",
    change,
    balance: nextQuantity,
    reason: input.reason.trim(),
    notes: input.notes.trim(),
    createdAt: now,
  });
  const result = await getSubhubInventory();
  return result.ok ? result : { ok: false, message: "Inventory was saved but could not be reloaded." };
}