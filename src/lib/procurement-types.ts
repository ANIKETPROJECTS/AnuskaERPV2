export const PROCUREMENT_STATUSES = ["Order placed", "Payment done", "Dispatch done", "Delivery done"] as const;
export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];
export const MISCELLANEOUS_VENDOR_ID = "__miscellaneous__";
export const ONE_OFF_MATERIAL_CODE = "__one_off_material__";