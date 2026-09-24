import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Boxes, LockKeyhole, ShieldCheck, ShoppingCart, UserRound } from "lucide-react";
import { bootstrapMasterAdminFn, loginFn } from "@/auth";
import { useAuth } from "@/components/auth/AuthContext";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Gadsons ERP" },
      { name: "description", content: "Secure access to the Gadsons water purifier parts ERP workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const [flow, setFlow] = useState<"selection" | "login" | "setup">(auth.setupRequired ? "setup" : "selection");
  const [panel, setPanel] = useState<"admin" | "subhub" | "procurement" | null>(auth.setupRequired ? "admin" : null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (auth.user) {
    return <Navigate to={auth.user.panel === "subhub" ? "/subhub" : "/"} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const result =
        flow === "setup"
          ? await bootstrapMasterAdminFn({ data: { name, email, password } })
          : await loginFn({ data: { email, password, panel: panel ?? "admin" } });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
    window.location.assign(result.user.panel === "subhub" ? "/subhub" : result.user.panel === "procurement" ? "/procurement-management" : "/");
    } catch {
      setMessage("Unable to reach the authentication service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function choosePanel(nextPanel: "admin" | "subhub" | "procurement") {
    setPanel(nextPanel);
    setFlow("login");
    setMessage("");
    setEmail("");
    setPassword("");
  }

  function returnToPanelSelection() {
    setPanel(null);
    setFlow("selection");
    setMessage("");
    setEmail("");
    setPassword("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section
          className="hidden p-10 text-primary-foreground lg:flex lg:flex-col"
          style={{ backgroundImage: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-3">
            <img src="/gadsons-mark.svg" alt="Gadsons" className="size-10 rounded-md" />
            <div>
              <p className="font-semibold">Gadsons</p>
              <p className="text-xs text-primary-foreground/70">Water Purifier Parts ERP</p>
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-sm font-medium text-primary-foreground/70">Operations control plane</p>
            <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight">
              One secure workspace for every hub.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/70">
              Manage product structures, inventory, production, and user access from a single operational system.
            </p>
            <div className="mt-8 flex items-center gap-3 text-sm text-primary-foreground/80">
              <ShieldCheck className="size-5" />
              Server-managed access and isolated workspaces
            </div>
          </div>
        </section>

        <section className="p-7 sm:p-10">
          <div className="flex items-center gap-3 lg:hidden">
            <img src="/gadsons-mark.svg" alt="Gadsons" className="size-9 rounded-md" />
            <div>
              <p className="text-sm font-semibold">Gadsons</p>
              <p className="text-xs text-muted-foreground">Water Purifier Parts ERP</p>
            </div>
          </div>
          <div className="mt-8 max-w-md lg:mt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {flow === "setup" ? "First-run setup" : flow === "selection" ? "Secure sign in" : "Panel sign in"}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {flow === "setup"
                ? "Create the Master Admin"
                : flow === "selection"
                  ? "Choose your workspace"
                    : panel === "admin"
                      ? "Master Admin login"
                      : panel === "procurement"
                        ? "Procurement Management login"
                        : "SubHub Manager login"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {flow === "setup"
                ? "Set the first control-plane account. This setup is available only once."
                : flow === "selection"
                  ? "Select the panel you want to access, then continue with the matching credentials."
                  : panel === "admin"
                    ? "Sign in to manage master data, hubs, and panel access."
                    : panel === "procurement"
                      ? "Sign in to review hub material needs, manage vendors, and assign procurement orders."
                      : "Sign in to manage hub inventory, production, and reports."}
            </p>

            {flow === "selection" ? (
              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={() => choosePanel("admin")}
                  className="group flex w-full items-start gap-4 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">Master Admin</span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      Master data, BOM, raw materials, hubs, and user access.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => choosePanel("subhub")}
                  className="group flex w-full items-start gap-4 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Boxes className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">SubHub Manager</span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      Inventory, hub production, and operational reports.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => choosePanel("procurement")}
                  className="group flex w-full items-start gap-4 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShoppingCart className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">Procurement Management</span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      Review hub stock needs, assign purchases, and manage vendors.
                    </span>
                  </span>
                </button>
              </div>
            ) : (
              <>
                {flow === "login" ? (
                  <button
                    type="button"
                    onClick={returnToPanelSelection}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <ArrowLeft className="size-4" /> Choose a different login
                  </button>
                ) : null}
                <form onSubmit={submit} className={`${flow === "login" ? "mt-5" : "mt-8"} space-y-4`}>
                  {flow === "setup" ? (
                    <label className="block text-sm font-medium">
                      Full name
                      <span className="relative mt-1.5 block">
                        <UserRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                        <input
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Aniket Rane"
                          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </span>
                    </label>
                  ) : null}
                  <label className="block text-sm font-medium">
                    Email address
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Password
                    <span className="relative mt-1.5 block">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                      <input
                        required
                        type="password"
                        autoComplete={flow === "setup" ? "new-password" : "current-password"}
                        minLength={flow === "setup" ? 8 : 1}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={flow === "setup" ? "At least 8 characters" : "Enter your password"}
                        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </span>
                  </label>
                  {message ? (
                    <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {message}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className="rule-header inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-wait disabled:opacity-60"
                  >
                    {busy ? "Please wait…" : flow === "setup" ? "Create Master Admin" : `Sign in as ${panel === "admin" ? "Master Admin" : panel === "procurement" ? "Procurement Management" : "SubHub Manager"}`}
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              </>
            )}
            <div className="mt-8 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
              <Boxes className="size-4" />
              Access is scoped by panel and section permissions.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}