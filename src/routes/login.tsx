import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Boxes, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { bootstrapMasterAdminFn, loginFn } from "@/auth";
import { useAuth } from "@/components/auth/AuthContext";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Float ERP" },
      { name: "description", content: "Secure access to the Float ERP workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "setup">(auth.setupRequired ? "setup" : "login");
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
        mode === "setup"
          ? await bootstrapMasterAdminFn({ data: { name, email, password } })
          : await loginFn({ data: { email, password } });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await router.invalidate();
      await router.navigate({ to: result.user.panel === "subhub" ? "/subhub" : "/" });
    } catch {
      setMessage("Unable to reach the authentication service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section
          className="hidden p-10 text-primary-foreground lg:flex lg:flex-col"
          style={{ backgroundImage: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-white/15 font-mono font-bold">FA</div>
            <div>
              <p className="font-semibold">Float ERP</p>
              <p className="text-xs text-primary-foreground/70">Airavata Technologies</p>
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
            <div className="rule-header flex size-9 items-center justify-center rounded-md font-mono text-sm font-bold">FA</div>
            <div>
              <p className="text-sm font-semibold">Float ERP</p>
              <p className="text-xs text-muted-foreground">Airavata Technologies</p>
            </div>
          </div>
          <div className="mt-8 max-w-md lg:mt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {mode === "setup" ? "First-run setup" : "Secure sign in"}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {mode === "setup" ? "Create the Master Admin" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === "setup"
                ? "Set the first control-plane account. This setup is available only once."
                : "Use your Float ERP credentials to continue to the right workspace."}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "setup" ? (
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
                     autoComplete={mode === "setup" ? "new-password" : "current-password"}
                    minLength={mode === "setup" ? 8 : 1}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "setup" ? "At least 8 characters" : "Enter your password"}
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
                {busy ? "Please wait…" : mode === "setup" ? "Create Master Admin" : "Sign in"}
                <ArrowRight className="size-4" />
              </button>
            </form>

            {!auth.setupRequired ? (
              <button
                type="button"
                onClick={() => {
                  setMode((current) => (current === "login" ? "setup" : "login"));
                  setMessage("");
                }}
                className="mt-5 text-sm font-medium text-primary hover:underline"
              >
                {mode === "login" ? "First time here? Create the Master Admin" : "Return to sign in"}
              </button>
            ) : null}
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