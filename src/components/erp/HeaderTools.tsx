import { Bell, ClipboardList, Factory, FileText, Package, Search, X } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderNotificationsFn, searchWorkspaceFn, type OrderNotification, type WorkspaceSearchResult, type WorkspaceSearchScope } from "@/production";

const notificationStorageKey = (panel: "admin" | "subhub") => `gadsons-order-notifications-seen:${panel}`;

function resultIcon(kind: WorkspaceSearchResult["kind"]) {
  if (kind === "order") return ClipboardList;
  if (kind === "hub") return Factory;
  if (kind === "part") return Package;
  return FileText;
}

const searchLabels: Record<WorkspaceSearchScope, { placeholder: string; ariaLabel: string; empty: string }> = {
  dashboard: { placeholder: "Search this section…", ariaLabel: "Search dashboard", empty: "No searchable records on the dashboard." },
  bom: { placeholder: "Search BOM products…", ariaLabel: "Search BOM products and variants", empty: "No matching BOM products or variants." },
  "raw-materials": { placeholder: "Search raw materials…", ariaLabel: "Search raw materials", empty: "No matching raw materials." },
  orders: { placeholder: "Search orders…", ariaLabel: "Search orders", empty: "No matching orders." },
  hubs: { placeholder: "Search hubs…", ariaLabel: "Search hubs", empty: "No matching hubs." },
  shortages: { placeholder: "Search shortages…", ariaLabel: "Search shortages", empty: "No matching shortage parts." },
  procurement: { placeholder: "Search procurement…", ariaLabel: "Search procurement actions", empty: "No matching procurement actions." },
  production: { placeholder: "Search production…", ariaLabel: "Search production records", empty: "No matching production records." },
  "user-management": { placeholder: "Search users…", ariaLabel: "Search users", empty: "No matching users." },
  hr: { placeholder: "Search HR records…", ariaLabel: "Search HR records", empty: "No matching HR records." },
};

export function GlobalSearch({ panel, scope }: { panel: "admin" | "subhub"; scope: WorkspaceSearchScope }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await searchWorkspaceFn({ data: { query: trimmed, panel, scope } });
        if (!cancelled) setResults(response.ok ? response.results : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [panel, query, scope]);

  async function openResult(result: WorkspaceSearchResult) {
    setOpen(false);
    setQuery("");
    await router.navigate({ to: result.href });
  }

  return (
    <div ref={containerRef} className="relative hidden min-w-0 md:block">
      <div className="flex w-[min(22rem,30vw)] items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={searchLabels[scope].placeholder}
          aria-label={searchLabels[scope].ariaLabel}
          aria-expanded={open}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="tabular rounded border border-border px-1.5 text-[10px] text-muted-foreground">⌘K</kbd>
        )}
      </div>
      {open && query.trim().length >= 2 ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,80vw)] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          {loading ? <p className="px-4 py-3 text-sm text-muted-foreground">Searching workspace…</p> : null}
          {!loading && !results.length ? <p className="px-4 py-3 text-sm text-muted-foreground">{searchLabels[scope].empty}</p> : null}
          {!loading && results.length ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((result) => {
                const Icon = resultIcon(result.kind);
                return (
                  <button
                    type="button"
                    key={`${result.kind}-${result.id}`}
                    onClick={() => void openResult(result)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted"
                  >
                    <span className="mt-0.5 rounded-md bg-secondary p-1.5 text-muted-foreground"><Icon className="size-3.5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{result.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationBell({ panel }: { panel: "admin" | "subhub" }) {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [lastSeen, setLastSeen] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshNotifications = useCallback(async () => {
    try {
      const response = await getOrderNotificationsFn({ data: panel });
      if (response.ok) setNotifications(response.notifications);
    } catch {
      // Notifications are supplementary; keep the header usable if the request fails.
    }
  }, [panel]);

  useEffect(() => {
    setLastSeen(window.localStorage.getItem(notificationStorageKey(panel)) ?? "");
    void refreshNotifications();
    const interval = window.setInterval(() => void refreshNotifications(), 30_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [panel, refreshNotifications]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const unread = notifications.filter((notification) => !lastSeen || notification.createdAt > lastSeen).length;

  function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) void refreshNotifications();
    if (nextOpen && notifications[0]) {
      const seenAt = new Date().toISOString();
      setLastSeen(seenAt);
      window.localStorage.setItem(notificationStorageKey(panel), seenAt);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Order notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={toggle}
        className="relative rounded-md border border-input bg-card p-2 text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,90vw)] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Order updates</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Assignments, reassignments, and production activity</p>
          </div>
          {notifications.length ? (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div key={notification.id} className="border-b border-border/70 px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{notification.summary}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatNotificationDate(notification.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{notification.details}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">By {notification.actorName} · {notification.actorRole}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-muted-foreground">No order updates yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}