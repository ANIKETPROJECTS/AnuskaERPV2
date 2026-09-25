import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, ClipboardList, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import type { ProcurementItemRequest } from "@/procurement.server";
import { num } from "@/lib/erp-data";
import { Route as RequestItemsRoute } from "./subhub.request-items";

export const Route = createFileRoute("/subhub/request-items/history")({
  head: () => ({ meta: [{ title: "My item request history — SubHub" }] }),
  component: RequestItemsHistoryPage,
});

type RequestStatusFilter = "all" | ProcurementItemRequest["status"];
const noRequests: ProcurementItemRequest[] = [];

function RequestItemsHistoryPage() {
  const result = RequestItemsRoute.useLoaderData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RequestStatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const requests = result.ok ? result.requests : noRequests;
  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return requests
      .filter((request) => status === "all" || request.status === status)
      .filter((request) => {
        const dateKey = requestDateKey(request.createdAt);
        return (!dateFrom || dateKey >= dateFrom) && (!dateTo || dateKey <= dateTo);
      })
      .filter(
        (request) =>
          !normalizedQuery ||
          `${request.itemName} ${request.quantity} ${request.notes} ${request.status} ${request.response}`
            .toLowerCase()
            .includes(normalizedQuery),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [requests, query, status, dateFrom, dateTo]);
  const visibleRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);
  const pendingCount = requests.filter((request) => request.status === "Pending").length;
  const approvedCount = requests.filter((request) => request.status === "Approved").length;
  const declinedCount = requests.filter((request) => request.status === "Declined").length;
  const hasFilters = Boolean(query || status !== "all" || dateFrom || dateTo);

  useEffect(() => {
    setPage(1);
  }, [query, status, dateFrom, dateTo]);

  return (
    <SubHubShell
      headerTitle="Request history"
      actions={
        <Link
          to="/subhub/request-items"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to Request items
        </Link>
      }
    >
      <section className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            All item requests submitted by this SubHub, including their review status and
            Procurement Management responses.
          </p>
        </div>

        {!result.ok ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <span className="inline-flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {result.message}
            </span>
            <button
              type="button"
              onClick={() => void router.invalidate()}
              className="min-h-10 rounded-md border border-destructive/25 px-3 font-medium hover:bg-destructive/5"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="All requests" value={requests.length} tone="text-foreground" />
          <Stat label="Pending" value={pendingCount} tone="text-warning" />
          <Stat label="Approved" value={approvedCount} tone="text-success" />
          <Stat label="Declined" value={declinedCount} tone="text-destructive" />
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-4 sm:px-5">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">My item requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {num(filteredRequests.length)} of {num(requests.length)} requests
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/10 p-4">
            <label className="min-w-[220px] flex-1 text-sm font-medium text-muted-foreground">
              Search
              <span className="relative mt-1 block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  aria-label="Search item request history"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Item, details, or response"
                  className="h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm font-normal text-foreground outline-none focus:border-primary"
                />
              </span>
            </label>

            <label className="w-full text-sm font-medium text-muted-foreground sm:w-40">
              Status
              <select
                aria-label="Filter item request history by status"
                value={status}
                onChange={(event) => setStatus(event.target.value as RequestStatusFilter)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
              >
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Declined">Declined</option>
              </select>
            </label>

            <label className="w-full text-sm font-medium text-muted-foreground sm:w-40">
              From date
              <input
                aria-label="Filter item request history from date"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
              />
            </label>

            <label className="w-full text-sm font-medium text-muted-foreground sm:w-40">
              To date
              <input
                aria-label="Filter item request history to date"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
              />
            </label>

            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="h-10 rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {requests.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No request history yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Requests you send will be stored here with their status and responses.
              </p>
              <Link
                to="/subhub/request-items"
                className="mt-4 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Submit an item request
              </Link>
            </div>
          ) : filteredRequests.length === 0 ? (
            <p className="border-y border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No requests match the selected filters.
            </p>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Date &amp; time</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Last updated</th>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Request details</th>
                      <th className="px-4 py-3 font-semibold">Procurement response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRequests.map((request) => (
                      <tr key={request.id} className="border-b border-border/70 last:border-0">
                        <td className="tabular whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                          {formatRequestDateTime(request.createdAt)}
                        </td>
                        <td className="tabular whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                          {request.updatedAt !== request.createdAt
                            ? formatRequestDateTime(request.updatedAt)
                            : "Not reviewed"}
                        </td>
                        <td className="px-4 py-4 font-medium">{request.itemName}</td>
                        <td className="tabular px-4 py-4 text-right">{num(request.quantity)}</td>
                        <td className="px-4 py-4">
                          <RequestStatus status={request.status} />
                        </td>
                        <td className="max-w-64 whitespace-pre-wrap px-4 py-4 text-muted-foreground">
                          {request.notes || "—"}
                        </td>
                        <td className="max-w-64 whitespace-pre-wrap px-4 py-4 text-muted-foreground">
                          {request.response ||
                            (request.status === "Pending"
                              ? "Awaiting review"
                              : "No response provided")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                total={filteredRequests.length}
                page={page}
                pageSize={pageSize}
                showPageSizeSelect={false}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
              />
            </>
          )}
        </section>
      </section>
    </SubHubShell>
  );
}

function RequestStatus({ status }: { status: ProcurementItemRequest["status"] }) {
  const style =
    status === "Approved"
      ? "bg-success/10 text-success"
      : status === "Declined"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/10 text-warning";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{status}</span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{num(value)}</p>
    </div>
  );
}

function requestDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatRequestDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
