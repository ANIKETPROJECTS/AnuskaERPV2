import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  Navigate,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getAuthStateFn } from "../auth";
import { AuthProvider, canAccess } from "../components/auth/AuthContext";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ location }) => getAuthStateFn({ data: { panel: panelForPath(location.pathname, location.searchStr) } }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gadsons ERP — Production & Stock Management" },
      {
        name: "description",
        content: "Industrial ERP for Gadsons water purifier parts: BOM, orders, hub stock, shortages and workforce output.",
      },
      { name: "author", content: "Airavata Technologies" },
      { property: "og:title", content: "Gadsons ERP — Production & Stock Management" },
      {
        property: "og:description",
        content: "Industrial ERP for Gadsons water purifier parts: BOM, orders, hub stock, shortages and workforce output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/gadsons-mark.svg", type: "image/svg+xml" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const auth = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isSubHubPath =
    pathname.startsWith("/subhub") ||
    pathname.startsWith("/inventory") ||
    ((pathname.startsWith("/procurement") || pathname.startsWith("/po/")) && auth.user?.panel === "subhub");
  const isAdminPath = !isSubHubPath && pathname !== "/login";
  const isProcurementPath = pathname.startsWith("/procurement") || pathname.startsWith("/po/");
  const requiredSection = sectionForPath(pathname);

  if (!auth.user && pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }
  if (auth.user && pathname === "/login") {
    return <Navigate to={auth.user.panel === "subhub" ? "/subhub" : auth.user.panel === "procurement" ? "/procurement-management" : "/"} replace />;
  }
  if (
    auth.user?.panel === "subhub" &&
    (pathname === "/inventory/batches" ||
      pathname.startsWith("/inventory/batches/") ||
      pathname === "/inventory/history" ||
      pathname.startsWith("/inventory/items/"))
  ) {
    return <Navigate to="/inventory/raw-materials" replace />;
  }
  if (auth.user?.role === "subhub" && isAdminPath) {
    return <Navigate to="/subhub" replace />;
  }
  if (auth.user?.role === "admin" && isSubHubPath) {
    return <Navigate to="/" replace />;
  }
  if (auth.user?.role === "procurement_manager" && !isProcurementPath) {
    return <Navigate to="/procurement-management" replace />;
  }
  if (auth.user?.role !== "procurement_manager" && pathname.startsWith("/procurement-management")) {
    return <Navigate to={auth.user?.panel === "subhub" ? "/subhub" : "/"} replace />;
  }
  if (auth.user && requiredSection && !canAccess(auth.user, requiredSection)) {
    return <Navigate to={auth.user.panel === "subhub" ? "/subhub" : auth.user.panel === "procurement" ? "/procurement-management" : "/"} replace />;
  }

  return (
    <AuthProvider value={auth}>
      <QueryClientProvider client={queryClient}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </QueryClientProvider>
    </AuthProvider>
  );
}

function sectionForPath(pathname: string): string | null {
  if (pathname.startsWith("/admin/users")) return "user-management";
  if (pathname.startsWith("/raw-materials")) return "raw-materials";
  if (pathname.startsWith("/bom")) return "bom";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/production-targets")) return "orders";
  if (pathname.startsWith("/hubs")) return "hubs";
  if (pathname.startsWith("/shortages")) return "shortages";
  if (pathname.startsWith("/procurement")) return "procurement";
  if (pathname.startsWith("/po/")) return "procurement";
  if (pathname.startsWith("/production")) return "production";
  if (pathname.startsWith("/hr")) return "hr";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/quality-management")) return "quality-management";
  if (pathname.startsWith("/subhub/bom")) return "bom";
  if (pathname.startsWith("/subhub/raw-materials")) return "raw-materials";
  if (pathname.startsWith("/subhub/parent")) return "bom";
  if (pathname.startsWith("/subhub/float-parent")) return "bom";
  if (pathname.startsWith("/subhub/reports")) return "hub-reports";
  if (pathname.startsWith("/subhub/production")) return "hub-manager";
  if (pathname.startsWith("/subhub/hr")) return "hr";
  if (pathname.startsWith("/subhub/request-items")) return "item-requests";
  if (pathname.startsWith("/subhub/")) return "hub-manager";
  return null;
}

function panelForPath(pathname: string, searchStr = ""): "admin" | "subhub" | "procurement" | undefined {
  if (pathname.startsWith("/subhub") || pathname.startsWith("/inventory")) return "subhub";
  if (pathname.startsWith("/procurement-management")) return "procurement";
  if (pathname.startsWith("/procurement")) {
    const requested = new URLSearchParams(searchStr).get("panel");
    if (requested === "admin" || requested === "subhub" || requested === "procurement") return requested;
    return "procurement";
  }
  if (pathname.startsWith("/po/")) {
    const requested = new URLSearchParams(searchStr).get("panel");
    if (requested === "admin" || requested === "subhub" || requested === "procurement") return requested;
  }
  if (pathname.startsWith("/procurement") || pathname.startsWith("/po/")) return undefined;
  if (pathname === "/login") return undefined;
  return "admin";
}
