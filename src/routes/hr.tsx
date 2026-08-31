import { createFileRoute } from "@tanstack/react-router";
import { HrWorkspace } from "@/components/erp/HrWorkspace";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — Float ERP" }] }),
  component: () => <HrWorkspace mode="admin" />,
});
