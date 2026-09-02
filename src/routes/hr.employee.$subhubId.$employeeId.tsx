import { createFileRoute } from "@tanstack/react-router";
import { EmployeeAttendanceDetails } from "@/components/erp/EmployeeAttendanceDetails";

export const Route = createFileRoute("/hr/employee/$subhubId/$employeeId")({
  head: () => ({ meta: [{ title: "Employee Details — Admin · Gadsons ERP" }] }),
  component: AdminEmployeeDetailsPage,
});

function AdminEmployeeDetailsPage() {
  const { subhubId, employeeId } = Route.useParams();
  return <EmployeeAttendanceDetails mode="admin" subhubId={subhubId} employeeId={employeeId} />;
}