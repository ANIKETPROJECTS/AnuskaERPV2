import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Database, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserCog, X } from "lucide-react";
import {
  createManagedUserFn,
  deleteManagedUserFn,
  listUsersFn,
  updateManagedUserFn,
} from "@/auth";
import type { AccessSection, Panel, PublicUser } from "@/auth.server";
import { useAuth } from "@/components/auth/AuthContext";
import { Shell } from "@/components/erp/Shell";

const permissionGroups: Array<{ label: string; panel: Panel; items: Array<{ value: AccessSection; label: string }> }> = [
  {
    label: "Admin Panel",
    panel: "admin",
    items: [
      { value: "dashboard", label: "Dashboard" },
      { value: "bom", label: "Bill of Materials" },
      { value: "raw-materials", label: "Raw Materials" },
      { value: "orders", label: "Orders & Targets" },
      { value: "hubs", label: "Hubs & Stock" },
      { value: "shortages", label: "Shortages" },
      { value: "procurement", label: "Procurement" },
      { value: "production", label: "Production & Workforce" },
    ],
  },
  {
    label: "SubHub Panel",
    panel: "subhub",
    items: [
      { value: "inventory", label: "Inventory Management" },
      { value: "hub-manager", label: "Hub Manager" },
      { value: "hub-reports", label: "Hub Reports" },
    ],
  },
];

const adminDefaults: AccessSection[] = permissionGroups[0]?.items.map((item) => item.value) ?? [];
const subhubDefaults: AccessSection[] = permissionGroups[1]?.items.map((item) => item.value) ?? [];

export const Route = createFileRoute("/admin/users")({
  loader: () => listUsersFn(),
  head: () => ({
    meta: [
      { title: "User Management — Float ERP" },
      { name: "description", content: "Manage Float ERP panel users and section permissions." },
    ],
  }),
  component: UserManagement,
});

type UserFormState = {
  name: string;
  email: string;
  password: string;
  panel: Panel;
  subhubName: string;
  permissions: AccessSection[];
  active: boolean;
};

type PanelFilter = "all" | Panel;
type StatusFilter = "all" | "active" | "inactive";
type UserSort = "name-asc" | "name-desc" | "panel" | "status";

function emptyForm(): UserFormState {
  return { name: "", email: "", password: "", panel: "subhub", subhubName: "", permissions: subhubDefaults, active: true };
}

function UserManagement() {
  const auth = useAuth();
  const router = useRouter();
  const result = Route.useLoaderData();
  const [users, setUsers] = useState<PublicUser[]>(result.users);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [panelFilter, setPanelFilter] = useState<PanelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<UserSort>("name-asc");

  useEffect(() => setUsers(result.users), [result.users]);

  const activeUsers = useMemo(() => users.filter((user) => user.active).length, [users]);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users
      .filter((user) => {
        const searchable = [user.name, user.email, user.subhubName ?? "", user.databaseName].join(" ").toLowerCase();
        const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
        const matchesPanel = panelFilter === "all" || user.panel === panelFilter;
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.active : !user.active);
        return matchesQuery && matchesPanel && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "panel") return a.panel.localeCompare(b.panel) || a.name.localeCompare(b.name);
        if (sortBy === "status") return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
        const comparison = a.name.localeCompare(b.name);
        return sortBy === "name-desc" ? -comparison : comparison;
      });
  }, [panelFilter, query, sortBy, statusFilter, users]);

  const hasFilters = Boolean(query.trim()) || panelFilter !== "all" || statusFilter !== "all" || sortBy !== "name-asc";

  if (auth.user?.role !== "master_admin") {
    return (
      <Shell title="User Management" subtitle="Admin Panel access control">
        <div className="panel mx-auto max-w-2xl p-8 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Master Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">User Management is reserved for the Master Admin.</p>
        </div>
      </Shell>
    );
  }

  function openCreate() {
    setMessage("");
    setEditingUser(null);
    setForm(emptyForm());
    setShowCreator(true);
  }

  function openEdit(user: PublicUser) {
    setMessage("");
    setShowCreator(false);
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      panel: user.panel,
      subhubName: user.subhubName ?? "",
      permissions: user.permissions,
      active: user.active,
    });
  }

  function changePanel(panel: Panel) {
    setForm((current) => ({
      ...current,
      panel,
      subhubName: panel === "subhub" ? current.subhubName : "",
      permissions: panel === "admin" ? adminDefaults : subhubDefaults,
    }));
  }

  function togglePermission(permission: AccessSection) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = editingUser
        ? await updateManagedUserFn({
            data: {
              id: editingUser.id,
              name: form.name,
              email: form.email,
              panel: form.panel,
              subhubName: form.panel === "subhub" ? form.subhubName : undefined,
              permissions: form.permissions,
              active: form.active,
              password: form.password || undefined,
            },
          })
        : await createManagedUserFn({
            data: {
              name: form.name,
              email: form.email,
              password: form.password,
              panel: form.panel,
              subhubName: form.panel === "subhub" ? form.subhubName : undefined,
              permissions: form.permissions,
            },
          });
      if (!response.ok) {
        setMessage(response.message);
        return;
      }
      setUsers((current) =>
        editingUser
          ? current.map((user) => (user.id === response.user.id ? response.user : user))
          : [response.user, ...current],
      );
      setEditingUser(null);
      setShowCreator(false);
      setForm(emptyForm());
      await router.invalidate();
    } catch {
      setMessage("The user could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: PublicUser) {
    if (!window.confirm(`Delete ${user.name}? This permanently deletes their MongoDB workspace database and cannot be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await deleteManagedUserFn({ data: { id: user.id } });
      if (!response.ok) {
        setMessage(response.message);
        return;
      }
      setUsers((current) => current.filter((item) => item.id !== user.id));
      if (editingUser?.id === user.id) setEditingUser(null);
      await router.invalidate();
    } catch {
      setMessage("The user could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="User Management"
      subtitle="Control who can enter each panel and which operational sections they can use."
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
        >
          <Plus className="size-4" /> Add user
        </button>
      }
    >
      <div className="space-y-6">

      {message ? (
        <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Total users" value={users.length.toString()} icon={<UserCog className="size-4" />} />
        <Summary label="Active accounts" value={activeUsers.toString()} icon={<Check className="size-4" />} />
        <Summary
          label="Isolated workspaces"
          value={users.length.toString()}
          icon={<Database className="size-4" />}
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Panel users</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every account is provisioned with an isolated MongoDB workspace.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {filteredUsers.length} of {users.length}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/10 px-5 py-4">
          <label className="min-w-[220px] flex-1 text-xs font-medium">
            Search users
            <span className="relative mt-1.5 block">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, factory, or workspace"
                aria-label="Search users"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </span>
          </label>
          <label className="text-xs font-medium">
            Panel
            <select
              value={panelFilter}
              onChange={(event) => setPanelFilter(event.target.value as PanelFilter)}
              aria-label="Filter by panel"
              className="mt-1.5 h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary"
            >
              <option value="all">All panels</option>
              <option value="admin">Admin Panel</option>
              <option value="subhub">SubHub Panel</option>
            </select>
          </label>
          <label className="text-xs font-medium">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter by account status"
              className="mt-1.5 h-9 min-w-32 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </select>
          </label>
          <label className="text-xs font-medium">
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as UserSort)}
              aria-label="Sort users"
              className="mt-1.5 h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary"
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="panel">Panel</option>
              <option value="status">Account status</option>
            </select>
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPanelFilter("all");
                setStatusFilter("all");
                setSortBy("name-asc");
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Panel</th>
                <th className="px-5 py-3 font-medium">Access sections</th>
                <th className="px-5 py-3 font-medium">Workspace</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-medium">{user.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                    {user.panel === "subhub" && user.subhubName ? (
                      <p className="mt-1 text-xs text-primary">Factory: {user.subhubName}</p>
                    ) : null}
                    {user.role === "master_admin" ? (
                      <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Master Admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize">{user.panel}</span>
                    <p className={`mt-2 text-xs ${user.active ? "text-success" : "text-muted-foreground"}`}>
                      {user.active ? "Active" : "Deactivated"}
                    </p>
                  </td>
                  <td className="max-w-[240px] px-5 py-4 text-xs leading-5 text-muted-foreground">
                    {user.role === "master_admin" ? "All sections" : user.permissions.map((item) => labelFor(item)).join(" · ")}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Database className="size-3.5" />
                      {user.databaseName}
                    </span>
                    <p className="mt-1 text-[11px] text-success">Provisioned</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {user.role === "master_admin" ? (
                      <span className="text-xs text-muted-foreground">Protected</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Edit ${user.name}`}
                          title="Edit user"
                        >
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeUser(user)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${user.name}`}
                          title="Delete user"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <p className="font-medium">No users match these filters</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try a different search or clear the filters.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showCreator || editingUser ? (
        <UserForm
          editing={Boolean(editingUser)}
          form={form}
          busy={busy}
          onChange={setForm}
          onPanelChange={changePanel}
          onTogglePermission={togglePermission}
          onSubmit={submit}
          onClose={() => {
            setShowCreator(false);
            setEditingUser(null);
            setMessage("");
          }}
        />
      ) : null}
      </div>
    </Shell>
  );
}

function labelFor(value: AccessSection): string {
  return permissionGroups.flatMap((group) => group.items).find((item) => item.value === value)?.label ?? value;
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

function UserForm({
  editing,
  form,
  busy,
  onChange,
  onPanelChange,
  onTogglePermission,
  onSubmit,
  onClose,
}: {
  editing: boolean;
  form: UserFormState;
  busy: boolean;
  onChange: (value: UserFormState) => void;
  onPanelChange: (panel: Panel) => void;
  onTogglePermission: (permission: AccessSection) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
      <form onSubmit={onSubmit} className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Access control</p>
            <h2 id="user-form-title" className="mt-2 text-xl font-semibold">{editing ? "Edit user" : "Add panel user"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {editing ? "Update identity, access, status, or credentials." : "Provision a panel account and isolated workspace."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <input
              required
              autoComplete="name"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder="Hub manager name"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              placeholder="person@company.com"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            {editing ? "New password (optional)" : "Initial password"}
            <span className="relative mt-1.5 block">
              <KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                required={!editing}
                type="password"
                autoComplete={editing ? "new-password" : "new-password"}
                minLength={editing ? undefined : 8}
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
                placeholder={editing ? "Leave blank to keep current password" : "At least 8 characters"}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </span>
          </label>
          <div>
            <p className="text-sm font-medium">Panel</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["admin", "subhub"] as const).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => onPanelChange(panel)}
                  className={`rounded-md border px-4 py-3 text-left transition ${
                    form.panel === panel ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-input hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium">{panel === "admin" ? "Admin Panel" : "SubHub Panel"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {panel === "admin" ? "Master data and administration" : "Hub operations and reporting"}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {form.panel === "subhub" ? (
            <label className="block text-sm font-medium">
              SubHub name
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                This name identifies the factory or hub shown in the SubHub workspace.
              </span>
              <input
                required
                value={form.subhubName}
                onChange={(event) => onChange({ ...form, subhubName: event.target.value })}
                placeholder="Factory F8 — Rabale"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          ) : null}
          <div>
            <p className="text-sm font-medium">Section access</p>
            <p className="mt-1 text-xs text-muted-foreground">Only selected sections will appear in this user’s navigation.</p>
            <div className="mt-3 space-y-4">
              {permissionGroups
                .filter((group) => group.panel === form.panel)
                .map((group) => (
                  <div key={group.panel} className="rounded-md border border-border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <label key={item.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
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
                  </div>
                ))}
            </div>
          </div>
          {editing ? (
            <label className="flex items-center gap-3 rounded-md border border-border px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => onChange({ ...form, active: event.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
              Account is active and can sign in
            </label>
          ) : null}
        </div>

        <div className="mt-auto flex justify-end gap-3 border-t border-border pt-5">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
            <ShieldCheck className="size-4" /> {busy ? "Saving…" : editing ? "Save changes" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}