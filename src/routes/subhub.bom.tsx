import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { BomPage } from "./bom";

export const Route = createFileRoute("/subhub/bom")({
  component: SubHubBom,
});

function SubHubBom() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/subhub/bom" ? <BomPage readOnly /> : <Outlet />;
}