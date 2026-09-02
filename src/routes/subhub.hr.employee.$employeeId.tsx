import { createFileRoute } from "@tanstack/react-router";
import { EmployeeAttendanceDetails } from "@/components/erp/EmployeeAttendanceDetails";

export const Route = createFileRoute("/subhub/hr/employee/$employeeId")({
  head: () => ({ meta: [{ title: "Employee Details — SubHub · Gadsons ERP" }] }),
  component: SubhubEmployeeDetailsPage,
});

function SubhubEmployeeDetailsPage() {
  const { employeeId } = Route.useParams();
  return <EmployeeAttendanceDetails mode="subhub" employeeId={employeeId} />;
}