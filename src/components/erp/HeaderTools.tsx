import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderNotificationsFn, type OrderNotification } from "@/production";

const notificationStorageKey = (panel: "admin" | "subhub") => `gadsons-order-notifications-seen:${panel}`;

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