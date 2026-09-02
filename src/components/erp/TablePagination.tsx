import { ChevronLeft, ChevronRight } from "lucide-react";

type TablePaginationProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <span>
        Showing{" "}
        <span className="font-medium text-foreground">
          {start}–{end}
        </span>{" "}
        of <span className="font-medium text-foreground">{total}</span>
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              onPageChange(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span className="tabular">
          Page {currentPage} of {pageCount}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === pageCount}
            className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
