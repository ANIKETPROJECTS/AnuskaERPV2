import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { canAccess, useAuth } from "@/components/auth/AuthContext";

export const Route = createFileRoute("/subhub")({
  head: () => ({
    meta: [
      { title: "SubHub Panel — Gadsons ERP" },
      { name: "description", content: "SubHub workspace for hub operations, inventory, and reports." },
    ],
  }),
  component: SubHub,
});

function SubHub() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();

  if (pathname !== "/subhub") {
    return <Outlet />;
  }

  const defaultRoutes = [
    { permission: "inventory", to: "/inventory" },
    { permission: "hub-manager", to: "/subhub/production" },
    { permission: "item-requests", to: "/subhub/request-items" },
    { permission: "hr", to: "/subhub/hr" },
    { permission: "procurement", to: "/procurement" },
    { permission: "bom", to: "/subhub/bom" },
    { permission: "raw-materials", to: "/subhub/raw-materials" },
  ] as const;
  const destination = defaultRoutes.find((route) => canAccess(user, route.permission))?.to;
  if (destination === "/procurement") {
    return <Navigate to="/procurement" search={{ panel: "subhub" }} replace />;
  }
  if (destination) return <Navigate to={destination} replace />;

  return (
    <SubHubShell title="No sections assigned" subtitle="Contact the Master Admin to request SubHub access.">
      <div className="p-6">
        <div className="panel p-10 text-center">
          <h1 className="font-semibold">No sections assigned</h1>
          <p className="mt-2 text-sm text-muted-foreground">Contact the Master Admin to request SubHub access.</p>
        </div>
      </div>
    </SubHubShell>
  );
}