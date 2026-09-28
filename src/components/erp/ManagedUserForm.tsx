import { useEffect, type FormEvent } from "react";
import { KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import type { AccessSection, Panel, PublicUser } from "@/auth.server";
import {
  panelLabel,
  permissionGroups,
  permissionsForPanel,
  type ManagedUserFormState,
} from "@/lib/user-management";

const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ManagedUserForm({
  user,
  form,
  busy,
  error,
  onChange,
  onPanelChange,
  onAccessModeChange,
  onTogglePermission,
  onSubmit,
  onClose,
  onDelete,
}: {
  user: PublicUser | null;
  form: ManagedUserFormState;
  busy: boolean;
  error: string;
  onChange: (value: ManagedUserFormState) => void;
  onPanelChange: (panel: Panel) => void;
  onAccessModeChange: (mode: "standard" | "custom") => void;
  onTogglePermission: (permission: AccessSection) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const editing = user !== null;
  const availablePermissions = permissionGroups.find((group) => group.panel === form.panel);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="managed-user-form-title"
    >
      <form
        onSubmit={onSubmit}
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-sm font-semibold text-primary">{editing ? "Edit account" : "New account"}</p>
            <h2 id="managed-user-form-title" className="mt-1 text-2xl font-semibold">
              {editing ? user.name : "Add a user"}
            </h2>
            <p className="mt-1 text-base text-muted-foreground">
              {editing
                ? "Update this account's details and sign-in access."
                : "Set up an account for one panel and choose what it can access."}
            </p>
            {user ? (
              <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                user.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              }`}>
                {user.active
                  ? "Active · can sign in"
                  : "Deactivated · reactivate from the account list"}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account form"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        <fieldset
          disabled={busy}
          className="min-w-0 flex-1 space-y-6 border-0 p-0 px-5 py-6 sm:px-7"
        >
          <section className="space-y-4" aria-labelledby="account-details-heading">
            <div>
              <h3 id="account-details-heading" className="text-lg font-semibold">1. Account details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Enter the name and email this person will use to sign in.</p>
            </div>
            <label className="block text-base font-medium">
              Full name
              <input
                required
                autoFocus
                autoComplete="name"
                value={form.name}
                onChange={(event) => onChange({ ...form, name: event.target.value })}
                placeholder="Person's full name"
                className={fieldClass}
              />
            </label>
            <label className="block text-base font-medium">
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => onChange({ ...form, email: event.target.value })}
                placeholder="person@company.com"
                className={fieldClass}
              />
            </label>
            <label className="block text-base font-medium">
              {editing ? "Change password (optional)" : "Initial password"}
              <span className="relative mt-1.5 block">
                <KeyRound className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <input
                  required={!editing}
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={form.password}
                  onChange={(event) => onChange({ ...form, password: event.target.value })}
                  placeholder={editing ? "Leave blank to keep the current password" : "At least 8 characters"}
                  className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {editing ? "Leave this blank if no password change is needed." : "Give this password to the account holder securely."}
              </span>
            </label>
          </section>

          <section className="space-y-4 border-t border-border pt-5" aria-labelledby="panel-heading">
            <div>
              <h3 id="panel-heading" className="text-lg font-semibold">2. Choose a panel</h3>
              <p className="mt-1 text-sm text-muted-foreground">Each account signs in to one workspace.</p>
            </div>
            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="sr-only">Workspace panel</legend>
              {([
                { id: "admin", title: "Admin", description: "Company operations and administration" },
                { id: "subhub", title: "SubHub", description: "Factory inventory and daily operations" },
                { id: "procurement", title: "Procurement", description: "Purchases, vendors, and requests" },
              ] as const).map((panel) => (
                <label
                  key={panel.id}
                  className={`flex min-h-28 cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                    form.panel === panel.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-input hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="user-panel"
                    value={panel.id}
                    checked={form.panel === panel.id}
                    onChange={() => onPanelChange(panel.id)}
                    className="mt-1 size-4 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block text-base font-semibold">{panel.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{panel.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {form.panel === "subhub" ? (
              <label className="block text-base font-medium">
                SubHub or factory name
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  This name appears in the SubHub workspace and Admin reports.
                </span>
                <input
                  required
                  value={form.subhubName}
                  onChange={(event) => onChange({ ...form, subhubName: event.target.value })}
                  placeholder="Factory F8 — Rabale"
                  className={fieldClass}
                />
              </label>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-border pt-5" aria-labelledby="access-heading">
            <div>
              <h3 id="access-heading" className="text-lg font-semibold">3. Choose access</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Standard access is recommended. You can limit which sections appear in this account's menu.
              </p>
            </div>
            <fieldset className="space-y-3">
              <legend className="sr-only">Section access level</legend>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-input p-4 hover:bg-muted/40">
                <input
                  type="radio"
                  name="access-mode"
                  checked={form.accessMode === "standard"}
                  onChange={() => onAccessModeChange("standard")}
                  className="mt-1 size-4 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="block text-base font-semibold">Standard access (recommended)</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Allow the normal sections for the {panelLabel(form.panel)} panel.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-input p-4 hover:bg-muted/40">
                <input
                  type="radio"
                  name="access-mode"
                  checked={form.accessMode === "custom"}
                  onChange={() => onAccessModeChange("custom")}
                  className="mt-1 size-4 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="block text-base font-semibold">Choose sections</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Select only the sections this account needs.
                  </span>
                </span>
              </label>
            </fieldset>
            {form.accessMode === "custom" ? (
              <fieldset className="rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-semibold">{availablePermissions?.label} sections</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(availablePermissions?.items ?? []).map((item) => (
                    <label
                      key={item.value}
                      className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-base hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(item.value)}
                        onChange={() => onTogglePermission(item.value)}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                {form.permissions.length === 0 ? (
                  <p className="mt-3 text-sm text-amber-700">This account will have no operational sections.</p>
                ) : null}
              </fieldset>
            ) : null}
            {form.panel === "admin" ? (
              <p className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                User Management remains available only to the Master Admin.
              </p>
            ) : null}
          </section>

          {user && onDelete ? (
            <section className="space-y-3 border-t border-destructive/30 pt-5" aria-labelledby="danger-heading">
              <div>
                <h3 id="danger-heading" className="text-lg font-semibold text-destructive">Permanent deletion</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deleting removes this account, its workspace data, and its assigned production orders. Deactivate the account instead if you may need its data later.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onDelete}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-destructive/40 px-4 text-base font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Delete account permanently
              </button>
            </section>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive">
              {error}
            </p>
          ) : null}
        </fieldset>

        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-md border border-input px-5 text-base font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-base font-semibold disabled:opacity-60"
          >
            <ShieldCheck className="size-4" />
            {busy ? "Saving…" : editing ? "Save account" : "Create account"}
          </button>
        </footer>
      </form>
    </div>
  );
}