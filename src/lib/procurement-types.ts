export const PROCUREMENT_STATUSES = ["Order placed", "Payment done", "Dispatch done", "Delivery done"] as const;
export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];