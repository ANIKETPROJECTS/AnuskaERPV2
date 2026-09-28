import { Link } from "@tanstack/react-router";

export function ProductionTargetsNav({ active }: { active: "orders" | "assign" | "capacity" }) {
  return (
    <nav
      aria-label="Production target pages"
      className="flex min-h-11 items-stretch gap-6 border-b border-border"
    >
      <Link
        to="/orders"
        aria-current={active === "orders" ? "page" : undefined}
        className={`inline-flex items-center border-b-2 px-1 text-sm font-medium transition-colors ${
          active === "orders"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        Orders
      </Link>
      <Link
        to="/production-targets"
        aria-current={active === "assign" ? "page" : undefined}
        className={`inline-flex items-center border-b-2 px-1 text-sm font-medium transition-colors ${
          active === "assign"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        Assign targets
      </Link>
      <Link
        to="/production-capacity"
        aria-current={active === "capacity" ? "page" : undefined}
        className={`inline-flex items-center border-b-2 px-1 text-sm font-medium transition-colors ${
          active === "capacity"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        SubHub capacity
      </Link>
    </nav>
  );
}
