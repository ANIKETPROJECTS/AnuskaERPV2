import { Link } from "@tanstack/react-router";

export function AdminHrNavigation({
  active,
  subhubId = "all",
}: {
  active: "attendance" | "reports";
  subhubId?: string;
}) {
  const linkClass = (selected: boolean) =>
    `inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold transition-colors ${
      selected
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <nav
      aria-label="HR & Attendance sections"
      className="inline-flex rounded-lg border border-border bg-white p-1"
    >
      <Link
        to="/hr"
        aria-current={active === "attendance" ? "page" : undefined}
        className={linkClass(active === "attendance")}
      >
        Attendance
      </Link>
      <Link
        to="/hr/reports"
        search={{ subhubId }}
        aria-current={active === "reports" ? "page" : undefined}
        className={linkClass(active === "reports")}
      >
        Reports
      </Link>
    </nav>
  );
}
