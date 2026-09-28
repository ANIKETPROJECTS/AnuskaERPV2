import type { AccessSection, Panel } from "@/auth.server";

export const permissionGroups: Array<{
  label: string;
  panel: Panel;
  items: Array<{ value: AccessSection; label: string }>;
}> = [
  {
    label: "Admin Panel",
    panel: "admin",
    items: [
      { value: "dashboard", label: "Dashboard" },
      { value: "bom", label: "Bill of Materials" },
      { value: "raw-materials", label: "Raw Materials" },
      { value: "orders", label: "Orders & Targets" },
      { value: "hubs", label: "Hubs & Stock" },
      { value: "shortages", label: "Shortages" },
      { value: "procurement", label: "Procurement" },
      { value: "production", label: "Production & Workforce" },
      { value: "hr", label: "HR & Attendance" },
    ],
  },
  {
    label: "SubHub Panel",
    panel: "subhub",
    items: [
      { value: "inventory", label: "Inventory Management" },
      { value: "hub-manager", label: "Hub Manager" },
      { value: "hub-reports", label: "Hub Reports" },
      { value: "item-requests", label: "Request items" },
      { value: "hr", label: "HR & Attendance" },
      { value: "bom", label: "Bill of Materials (view only)" },
      { value: "raw-materials", label: "Raw Materials (view only)" },
      { value: "procurement", label: "Procurement" },
    ],
  },
  {
    label: "Procurement Management Panel",
    panel: "procurement",
    items: [{ value: "procurement", label: "Procurement Management" }],
  },
];

export type ManagedUserFormState = {
  name: string;
  email: string;
  password: string;
  panel: Panel;
  subhubName: string;
  permissions: AccessSection[];
  accessMode: "standard" | "custom";
};

export function permissionsForPanel(panel: Panel): AccessSection[] {
  return permissionGroups.find((group) => group.panel === panel)?.items.map((item) => item.value) ?? [];
}

export function isStandardAccess(panel: Panel, permissions: AccessSection[]) {
  const standard = permissionsForPanel(panel);
  return standard.length === permissions.length && standard.every((item) => permissions.includes(item));
}

export function permissionLabel(permission: AccessSection): string {
  return permissionGroups
    .flatMap((group) => group.items)
    .find((item) => item.value === permission)?.label ?? permission;
}

export function emptyManagedUserForm(): ManagedUserFormState {
  return {
    name: "",
    email: "",
    password: "",
    panel: "subhub",
    subhubName: "",
    permissions: permissionsForPanel("subhub"),
    accessMode: "standard",
  };
}

export function panelLabel(panel: Panel) {
  if (panel === "admin") return "Admin";
  if (panel === "subhub") return "SubHub";
  return "Procurement";
}