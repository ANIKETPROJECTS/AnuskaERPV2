import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Mail, ShieldCheck, UserRound, Users } from "lucide-react";
import { getAdminSubhubDetailsFn } from "@/hr";
import type { AdminSubhubDetails } from "@/hr.server";
import { Shell } from "@/components/erp/Shell";
import { permissionLabel } from "@/lib/user-management";

export const Route = createFileRoute("/admin/users/$userId")({
  loader: ({ params }) => getAdminSubhubDetailsFn({ data: { userId: params.userId } }),
  head: () => ({
    meta: [
      { title: "SubHub Details — User Management · Float ERP" },
      { name: "description", content: "View a SubHub account and its current employees." },
    ],
  }),
  component: SubhubDetailsPage,
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function SubhubDetailsPage() {
  const result = Route.useLoaderData();

  if (!result.ok) {
    return (
      <Shell title="SubHub Details" subtitle="User Management">
        <div className="space-y-5">
          <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to User Management
          </Link>
          <div className="panel mx-auto max-w-2xl p-8 text-center">
            <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">SubHub details unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
          </div>
        </div>
      </Shell>
    );
  }

  return <SubhubDetailsView details={result.data} />;
}

function SubhubDetailsView({ details }: { details: AdminSubhubDetails }) {
  const { user, employees, shifts } = details;
  const assignedEmployees = new Set(shifts.flatMap((shift) => shift.assignedEmployeeIds));

  return (
    <Shell
      title={user.subhubName || "SubHub account"}
      subtitle="Account details and current employee roster."
      actions={
        <Link to="/admin/users" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
          <ArrowLeft className="size-4" /> Back to User Management
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-base">
          <Building2 className="size-4 text-primary" />
          <span>{user.subhubName || "SubHub"}</span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            user.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}>
            {user.active ? "Active account" : "Deactivated account"}
          </span>
        </div>

        <p className="text-base text-muted-foreground">
          {employees.length} employee{employees.length === 1 ? "" : "s"} · {shifts.length} shift{shifts.length === 1 ? "" : "s"} · {assignedEmployees.size} assigned to a shift
        </p>

        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">Account details</h2>
            <p className="mt-1 text-sm text-muted-foreground">The workspace and sign-in information for this SubHub.</p>
          </div>
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <Detail label="SubHub or factory" value={user.subhubName || "Not assigned"} icon={<Building2 className="size-4" />} />
            <Detail label="Manager account" value={user.name} icon={<UserRound className="size-4" />} />
            <Detail label="Sign-in email" value={user.email} icon={<Mail className="size-4" />} />
            <Detail label="Account status" value={user.active ? "Active" : "Deactivated"} icon={<CheckCircle2 className="size-4" />} />
            <Detail label="Created" value={formatDate(user.createdAt)} icon={<CalendarDays className="size-4" />} />
          </dl>
          <div className="border-t border-border px-5 py-4">
            <p className="text-sm font-semibold">Sections this account can open</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.permissions.length ? user.permissions.map((permission) => (
                <span key={permission} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {permissionLabel(permission)}
                </span>
              )) : <span className="text-sm text-muted-foreground">No sections assigned.</span>}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
                <h2 className="text-lg font-semibold">Current employees</h2>
                <p className="mt-1 text-sm text-muted-foreground">People currently registered in this SubHub workspace.</p>
            </div>
              <span className="text-sm text-muted-foreground">{employees.length} employee{employees.length === 1 ? "" : "s"}</span>
          </div>
          {employees.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-base">
                <thead className="border-b border-border bg-muted/20 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Employee</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Phone</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Assigned shift</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Joined</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const shift = shifts.find((candidate) => candidate.assignedEmployeeIds.includes(employee.id));
                    return (
                      <tr key={employee.id} className="border-b border-border/70 last:border-0">
                        <th scope="row" className="px-5 py-4 text-left font-semibold">{employee.name}</th>
                        <td className="px-5 py-4 text-muted-foreground">{employee.phoneNumber || "Not assigned"}</td>
                        <td className="px-5 py-4 text-muted-foreground">{shift?.name || "Not assigned"}</td>
                        <td className="px-5 py-4 text-muted-foreground">{formatDate(employee.createdAt)}</td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">Active</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center">
              <Users className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No current employees</p>
              <p className="mt-1 text-sm text-muted-foreground">Employees registered in this SubHub will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border px-5 py-4">
      <span className="mt-1 text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words text-base font-medium">{value}</dd>
      </div>
    </div>
  );
}