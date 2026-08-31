import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adjustSubhubInventory, getSubhubInventory } from "./inventory.server";

const adjustmentSchema = z.object({
  code: z.string().min(1),
  action: z.enum(["add", "remove"]),
  quantity: z.number().int().positive(),
  reason: z.string().min(2).max(120),
  notes: z.string().max(500),
});

export const getSubhubInventoryFn = createServerFn({ method: "GET" }).handler(() => getSubhubInventory());
export const adjustSubhubInventoryFn = createServerFn({ method: "POST" }).validator(adjustmentSchema).handler(({ data }) => adjustSubhubInventory(data));