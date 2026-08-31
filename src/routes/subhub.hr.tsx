import { createFileRoute } from "@tanstack/react-router";
import { HrWorkspace } from "@/components/erp/HrWorkspace";

export const Route = createFileRoute("/subhub/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — SubHub · Float ERP" }] }),
  component: () => <HrWorkspace mode="manager" />,
});
