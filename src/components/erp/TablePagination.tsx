import { ChevronLeft, ChevronRight } from "lucide-react";

type TablePaginationProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelect?: boolean;
  size?: "sm" | "md";
};

export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelect = true,
  size = "sm",
}: TablePaginationProps) {
  if (!total) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  function changePage(nextPage: number) {
    onPageChange(Math.min(Math.max(nextPage, 1), pageCount));
  }

  return (
    <div className={`flex flex-col gap-3 ${size === "md" ? "" : "border-t border-border"} bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}>
      <p className={`${size === "md" ? "text-base" : "text-sm"} text-muted-foreground`}>
        Showing{" "}
        <span className="tabular font-semibold text-foreground">
          {start}–{end}
        </span>{" "}
        of <span className="tabular font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
        {showPageSizeSelect ? (
          <label className={`inline-flex items-center gap-2 ${size === "md" ? "text-base" : "text-sm"} text-muted-foreground`}>
            Rows per page
            <select
              value={pageSize}
              onChange={(event) => {
                onPageSizeChange(Number(event.target.value));
                onPageChange(1);
              }}
              className={`rounded-md border border-input bg-background px-2 text-foreground ${size === "md" ? "h-11 text-base" : "h-9 text-sm"}`}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-3">
          <span className={`tabular ${size === "md" ? "text-base" : "text-sm"} text-muted-foreground`}>
            Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
            <span className="font-medium text-foreground">{pageCount}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${size === "md" ? "size-11" : "size-9"}`}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage === pageCount}
              className={`inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${size === "md" ? "size-11" : "size-9"}`}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
