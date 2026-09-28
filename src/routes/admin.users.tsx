import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, Power, PowerOff, Plus, Search, ShieldCheck } from "lucide-react";
import {
  createManagedUserFn,
  deleteManagedUserFn,
  listUsersFn,
  updateManagedUserFn,
} from "@/auth";
import type { AccessSection, Panel, PublicUser } from "@/auth.server";
import { useAuth } from "@/components/auth/AuthContext";
import { HubModuleNav } from "@/components/erp/HubModuleNav";
import { ManagedUserForm } from "@/components/erp/ManagedUserForm";
import { Shell } from "@/components/erp/Shell";
import {
  emptyManagedUserForm,
  isStandardAccess,
  panelLabel,
  permissionsForPanel,
  type ManagedUserFormState,
} from "@/lib/user-management";

export const Route = createFileRoute("/admin/users")({
  loader: () => listUsersFn(),
  head: () => ({
    meta: [
      { title: "User Management — Float ERP" },
      { name: "description", content: "Manage account access for Admin, SubHub, and Procurement workspaces." },
    ],
  }),
  component: UserManagement,
});

type PanelFilter = "all" | Panel;
type StatusFilter = "all" | "active" | "inactive";
const pageSize = 20;

function UserManagement() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/users") return <Outlet />;
  return <UserManagementPage />;
}

function UserManagementPage() {
  const auth = useAuth();
  const router = useRouter();
  const result = Route.useLoaderData();
  const [users, setUsers] = useState<PublicUser[]>(result.users);
  const [query, setQuery] = useState("");
  const [panelFilter, setPanelFilter] = useState<PanelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [formUser, setFormUser] = useState<PublicUser | null>(null);
  const [form, setForm] = useState<ManagedUserFormState>(emptyManagedUserForm);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUsers(result.users);
    setPage(0);
    if (!result.ok) setMessage(result.message);
  }, [result]);

  useEffect(() => setPage(0), [query, panelFilter, statusFilter]);

  const activeCount = users.filter((user) => user.active).length;
  const inactiveCount = users.length - activeCount;
  const panelCounts = useMemo(() => ({
    admin: users.filter((user) => user.panel === "admin").length,
    subhub: users.filter((user) => user.panel === "subhub").length,
    procurement: users.filter((user) => user.panel === "procurement").length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users
      .filter((user) => {
        const matchesPanel = panelFilter === "all" || user.panel === panelFilter;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" ? user.active : !user.active);
        const searchable = [user.name, user.email, user.subhubName ?? ""].join(" ").toLowerCase();
        return matchesPanel && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [users, query, panelFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice(page * pageSize, (page + 1) * pageSize);
  const panelItems: Array<{ id: PanelFilter; label: string }> = [
    { id: "all", label: `All accounts (${users.length})` },
    { id: "admin", label: `Admin (${panelCounts.admin})` },
    { id: "subhub", label: `SubHub (${panelCounts.subhub})` },
    { id: "procurement", label: `Procurement (${panelCounts.procurement})` },
  ];
  const statusCounts = users.filter((user) => panelFilter === "all" || user.panel === panelFilter);
  const selectedActiveCount = statusCounts.filter((user) => user.active).length;
  const selectedInactiveCount = statusCounts.length - selectedActiveCount;
  const hasFilters = Boolean(query.trim()) || panelFilter !== "all" || statusFilter !== "all";

  if (auth.user?.role !== "master_admin") {
    return (
      <Shell title="User Management" subtitle="Manage account access">
        <div className="panel mx-auto max-w-2xl p-8 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Master Admin access required</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Only the Master Admin can add accounts or change access.
          </p>
        </div>
      </Shell>
    );
  }

  function openCreate() {
    setMessage("");
    setNotice("");
    setFormUser(null);
    setForm(emptyManagedUserForm());
    setFormOpen(true);
  }

  function openEdit(user: PublicUser) {
    setMessage("");
    setNotice("");
    setFormUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      panel: user.panel,
      subhubName: user.subhubName ?? "",
      permissions: user.permissions,
      accessMode: isStandardAccess(user.panel, user.permissions) ? "standard" : "custom",
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    setFormUser(null);
    setMessage("");
  }

  function changePanel(panel: Panel) {
    if (
      formUser &&
      form.panel !== panel &&
      formUser.panel !== panel &&
      !window.confirm(`Change ${formUser.name}'s panel from ${panelLabel(formUser.panel)} to ${panelLabel(panel)}? This changes their sign-in workspace and available menu.`)
    ) return;
    setForm((current) => ({
      ...current,
      panel,
      subhubName: panel === "subhub" ? current.subhubName : "",
      permissions: permissionsForPanel(panel),
      accessMode: "standard",
    }));
  }

  function changeAccessMode(accessMode: "standard" | "custom") {
    setForm((current) => ({
      ...current,
      accessMode,
      permissions: accessMode === "standard" ? permissionsForPanel(current.panel) : current.permissions,
    }));
  }

  function togglePermission(permission: AccessSection) {
    setForm((current) => ({
      ...current,
      accessMode: "custom",
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.accessMode === "custom" && form.permissions.length === 0) {
      setMessage("Choose at least one section, or use standard access.");
      return;
    }
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      const response = formUser
        ? await updateManagedUserFn({
            data: {
              id: formUser.id,
              name: form.name,
              email: form.email,
              panel: form.panel,
              subhubName: form.panel === "subhub" ? form.subhubName : undefined,
              permissions: form.permissions,
              active: formUser.active,
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
      setUsers((current) => formUser
        ? current.map((user) => user.id === response.user.id ? response.user : user)
        : [response.user, ...current]);
      setPage(0);
      setNotice(formUser ? `${response.user.name}'s account was updated.` : `${response.user.name}'s account was created.`);
      setFormOpen(false);
      setFormUser(null);
      await router.invalidate();
    } catch {
      setMessage("The account could not be saved. Check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: PublicUser) {
    if (!window.confirm(
      `Permanently delete ${user.name}?\n\nThis removes their account, workspace data, and assigned production orders. It cannot be undone.\n\nChoose Cancel to keep the data and deactivate the account instead.`,
    )) return;
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      const response = await deleteManagedUserFn({ data: { id: user.id } });
      if (!response.ok) {
        setMessage(response.message);
        return;
      }
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setPage(0);
      setFormOpen(false);
      setFormUser(null);
      setNotice(`${user.name}'s account was permanently deleted.`);
      await router.invalidate();
    } catch {
      setMessage("The account could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setUserActive(user: PublicUser, active: boolean) {
    if (!active && !window.confirm(
      `Deactivate ${user.name}?\n\nThey will no longer be able to sign in. Their workspace and records will be kept, and you can reactivate them later.`,
    )) return;
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      const response = await updateManagedUserFn({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          panel: user.panel,
          subhubName: user.subhubName,
          permissions: user.permissions,
          active,
        },
      });
      if (!response.ok) {
        setMessage(response.message);
        return;
      }
      setUsers((current) => current.map((item) => item.id === user.id ? response.user : item));
      setNotice(active
        ? `${user.name} can sign in again.`
        : `${user.name} is deactivated. Their workspace and records are kept.`);
      await router.invalidate();
    } catch {
      setMessage(`The status for ${user.name}'s account could not be changed. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="User Management"
      subtitle="Add people, choose their workspace, and control account access."
      actions={
        <button
          type="button"
          onClick={openCreate}
          disabled={busy}
          className="rule-header inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-base font-semibold"
        >
          <Plus className="size-4" />
          Add account
        </button>
      }
      headerNav={
        <HubModuleNav<PanelFilter>
          active={panelFilter}
          ariaLabel="Filter accounts by workspace"
          idPrefix="user-management"
          items={panelItems}
          onSelect={setPanelFilter}
        />
      }
    >
      <div className="space-y-5">
        <p className="text-base text-muted-foreground">
          {users.length} accounts · {activeCount} active · {inactiveCount} deactivated
          <span className="ml-2">Choose standard access unless someone needs fewer sections.</span>
        </p>

        {message && !formOpen ? (
          <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive">
            {message}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-base text-success">
            {notice}
          </p>
        ) : null}

        <section className="panel overflow-hidden" aria-label="Accounts">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">
                {panelFilter === "all" ? "All accounts" : `${panelLabel(panelFilter)} accounts`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing {filteredUsers.length} account{filteredUsers.length === 1 ? "" : "s"}.
                Deactivating keeps the account's data; deletion permanently removes it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by account status">
              {([
                { id: "all", label: `All (${statusCounts.length})` },
                { id: "active", label: `Active (${selectedActiveCount})` },
                { id: "inactive", label: `Deactivated (${selectedInactiveCount})` },
              ] as const).map((status) => (
                <button
                  key={status.id}
                  type="button"
                  aria-pressed={statusFilter === status.id}
                  onClick={() => setStatusFilter(status.id)}
                  className={`min-h-10 rounded-md border px-3 text-sm font-medium ${
                    statusFilter === status.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/10 px-5 py-4">
            <label className="min-w-[240px] flex-1 text-sm font-medium">
              Search accounts
              <span className="relative mt-1.5 block">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, email, or SubHub"
                  aria-label="Search accounts by name, email, or SubHub"
                  className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </span>
            </label>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPanelFilter("all");
                  setStatusFilter("all");
                }}
                className="min-h-11 rounded-md border border-input bg-background px-4 text-base font-medium hover:bg-muted"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-base">
              <thead className="border-b border-border bg-muted/20 text-left text-sm uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Workspace</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Section access</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleUsers.map((user) => (
                  <tr key={user.id} className={user.active ? "hover:bg-muted/20" : "bg-muted/20"}>
                    <th scope="row" className="px-5 py-4 text-left font-semibold">
                      <span className="block">{user.name}</span>
                      <span className="mt-1 block text-sm font-normal text-muted-foreground">{user.email}</span>
                      {user.panel === "subhub" && user.subhubName ? (
                        <span className="mt-1 block text-sm font-normal text-muted-foreground">{user.subhubName}</span>
                      ) : null}
                    </th>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                        {panelLabel(user.panel)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {user.role === "master_admin"
                        ? "Master Admin"
                        : isStandardAccess(user.panel, user.permissions)
                          ? "Standard access"
                          : `Custom · ${user.permissions.length} sections`}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        user.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {user.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {user.role === "master_admin" ? (
                        <span className="text-sm text-muted-foreground">Protected account</span>
                      ) : (
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                          >
                            Edit
                          </button>
                          {user.panel === "subhub" ? (
                            <Link
                              to="/admin/users/$userId"
                              params={{ userId: user.id }}
                              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
                            >
                              <Eye className="size-4" />
                              Details
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void setUserActive(user, !user.active)}
                            disabled={busy}
                            className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:opacity-50 ${
                              user.active
                                ? "border-input text-muted-foreground hover:bg-muted"
                                : "border-success/30 text-success hover:bg-success/5"
                            }`}
                          >
                            {user.active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                            {user.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <p className="text-base font-semibold">
                        {users.length === 0 ? "No accounts yet" : "No accounts match these filters"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {users.length === 0
                          ? "Add an account to give someone access to a workspace."
                          : "Try another search or clear the filters."}
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min(filteredUsers.length, (page + 1) * pageSize)} of {filteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  className="min-h-10 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="min-w-24 text-center text-sm text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  className="min-h-10 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {formOpen ? (
        <ManagedUserForm
          user={formUser}
          form={form}
          busy={busy}
          error={message}
          onChange={setForm}
          onPanelChange={changePanel}
          onAccessModeChange={changeAccessMode}
          onTogglePermission={togglePermission}
          onSubmit={submit}
          onClose={closeForm}
          onDelete={formUser ? () => void removeUser(formUser) : () => undefined}
        />
      ) : null}
    </Shell>
  );
}