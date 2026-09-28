import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Edit3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { ProductionTargetEditor, type ProductionTargetUpdate } from "@/components/erp/ProductionTargetEditor";
import { Shell } from "@/components/erp/Shell";
import { Tag } from "@/components/erp/bits";
import { num } from "@/lib/erp-data";
import {
  deleteProductionOrderFn,
  getAdminProductionOrderDetailFn,
  listAssignableSubhubsFn,
  reassignProductionOrderFn,
  updateProductionOrderFn,
} from "@/production";
import type { ProductionOrderActivity, ProductionReport } from "@/production.server";

export const Route = createFileRoute("/production-orders/$orderId")({
  loader: async ({ params }) => {
    const [detailResult, subhubResult] = await Promise.all([
      getAdminProductionOrderDetailFn({ data: { orderId: params.orderId } }),
      listAssignableSubhubsFn(),
    ]);
    if (!detailResult.ok) throw notFound();
    return {
      ...detailResult.data,
      subhubs: subhubResult.ok ? subhubResult.subhubs : [],
      subhubError: subhubResult.ok ? "" : subhubResult.message,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.order.orderNumber} — Production order · Gadsons ERP` : "Production order — Gadsons ERP" },
      { name: "description", content: "Order details, daily production reports, and activity history." },
    ],
  }),
  notFoundComponent: ProductionOrderMissing,
  component: ProductionOrderDetailPage,
});

type ReportHistoryItem = {
  report: ProductionReport;
  remaining: number;
};

function ProductionOrderMissing() {
  return (
    <Shell title="Production order not found" subtitle="This order may have been removed or may not be available in your Admin workspace.">
      <p className="border-b border-border py-5 text-sm text-muted-foreground">
        Back to <Link to="/orders" className="font-medium text-primary underline">Orders</Link>.
      </p>
    </Shell>
  );
}

function ProductionOrderDetailPage() {
  const { order, reports, activities, subhubs, subhubError } = Route.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const isMasterAdmin = user?.role === "master_admin";
  const [destinationId, setDestinationId] = useState(order.subhubUserId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDestinationId(order.subhubUserId);
  }, [order.subhubUserId]);

  const productionHistory = useMemo<ReportHistoryItem[]>(() => {
    let producedToDate = 0;
    return [...reports]
      .sort((left, right) => `${left.date}${left.updatedAt}`.localeCompare(`${right.date}${right.updatedAt}`))
      .map((report) => {
        producedToDate += report.quantity;
        return { report, remaining: Math.max(0, order.target - producedToDate) };
      })
      .reverse();
  }, [order.target, reports]);

  async function moveOrder() {
    if (destinationId === order.subhubUserId) return;
    setMoving(true);
    setError("");
    setSuccess("");
    const result = await reassignProductionOrderFn({
      data: { orderId: order.id, subhubUserId: destinationId, reason },
    });
    if (!result.ok) {
      setError(result.message);
    } else {
      setReason("");
      setSuccess(`${order.orderNumber} was moved successfully.`);
      await router.invalidate();
    }
    setMoving(false);
  }

  async function saveTarget(input: ProductionTargetUpdate) {
    setSaving(true);
    setError("");
    setSuccess("");
    const result = await updateProductionOrderFn({ data: input });
    if (!result.ok) {
      setError(result.message);
    } else {
      setEditing(false);
      setSuccess(`${result.order.orderNumber} was updated successfully.`);
      await router.invalidate();
    }
    setSaving(false);
  }

  async function deleteTarget() {
    if (!window.confirm(`Delete ${order.orderNumber}? This will permanently remove the target, its production reports, and its activity history.`)) return;
    setDeleting(true);
    setError("");
    const result = await deleteProductionOrderFn({ data: { orderId: order.id } });
    if (!result.ok) {
      setError(result.message);
      setDeleting(false);
      return;
    }
    await router.navigate({ to: "/orders" });
  }

  const metrics = [
    { label: "Target", value: num(order.target), hint: "Units assigned" },
    { label: "Produced", value: num(order.produced), hint: "Units reported so far" },
    { label: "Remaining", value: num(order.remaining), hint: "Units left to produce" },
    { label: "Status", value: order.status, hint: "Current production status" },
  ];

  return (
    <Shell
      title={order.orderNumber}
      subtitle={`${order.productName} · ${order.variantName} · ${order.subhubName}`}
      actions={
        <Link
          to="/orders"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
      }
    >
      <div className="space-y-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {success ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{success}</p> : null}

        <section aria-label="Order summary" className="grid grid-cols-1 gap-x-8 border-y border-border sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className="tabular mt-1 text-2xl font-bold leading-tight">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.hint}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="order-log-heading">
          <SectionHeading
            id="order-log-heading"
            title="Order log"
            description="Assignments, target changes, and production updates with the person and time recorded."
          />
          {activities.length ? (
            <ol className="divide-y divide-border border-b border-border">
              {activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
            </ol>
          ) : (
            <p className="border-b border-border py-6 text-sm text-muted-foreground">No activity has been recorded for this order yet.</p>
          )}
        </section>

        <section aria-labelledby="daily-production-heading">
          <SectionHeading
            id="daily-production-heading"
            title="Daily production"
            description="Saved production quantities for this order, newest date first."
          />
          {productionHistory.length ? (
            <div className="overflow-x-auto border-b border-border">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Production date</th>
                    <th className="px-3 py-3 font-medium">Saved at</th>
                    <th className="px-3 py-3 text-right font-medium">Produced</th>
                    <th className="px-3 py-3 text-right font-medium">Target remaining</th>
                    <th className="px-3 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {productionHistory.map(({ report, remaining }) => (
                    <tr key={report.id} className="border-b border-border/70 last:border-0">
                      <td className="tabular whitespace-nowrap px-3 py-3 font-medium">{formatDate(report.date)}</td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{formatTimestamp(report.updatedAt)}</td>
                      <td className="tabular px-3 py-3 text-right font-semibold">{num(report.quantity)}</td>
                      <td className="tabular px-3 py-3 text-right">{num(remaining)}</td>
                      <td className="max-w-xs px-3 py-3 text-muted-foreground">{report.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-b border-border py-6 text-sm text-muted-foreground">No production has been recorded for this order yet.</p>
          )}
        </section>

        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <section aria-labelledby="order-details-heading">
            <SectionHeading id="order-details-heading" title="Order details" />
            <dl className="divide-y divide-border border-b border-border text-sm">
              <Detail label="Order number" value={order.orderNumber} />
              <Detail label="SubHub" value={order.subhubName} />
              <Detail label="Product" value={`${order.productName} · ${order.productCode}`} />
              <Detail label="Variant" value={`${order.variantName} · ${order.variantCode}`} />
              <Detail label="Due date" value={formatDate(order.dueDate)} />
              <Detail label="Created" value={formatTimestamp(order.createdAt)} />
              <Detail label="Notes" value={order.notes || "No notes"} />
            </dl>
          </section>

          <section aria-labelledby="order-actions-heading">
            <SectionHeading id="order-actions-heading" title="Order actions" />
            <div className="space-y-4 border-b border-border py-4">
              {subhubError ? <p role="alert" className="text-sm text-destructive">{subhubError}</p> : null}
              <label className="block text-sm font-medium">
                Move to another SubHub
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <select
                    value={destinationId}
                    onChange={(event) => setDestinationId(event.target.value)}
                    disabled={!subhubs.length || moving}
                    aria-label={`Destination SubHub for ${order.orderNumber}`}
                    className="h-10 min-w-48 flex-1 rounded-md border border-input bg-background px-3 text-sm font-normal"
                  >
                    {subhubs.map((subhub) => (
                      <option key={subhub.id} value={subhub.id}>{subhub.subhubName}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void moveOrder()}
                    disabled={!subhubs.length || moving || destinationId === order.subhubUserId}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRight className="size-4" /> {moving ? "Moving…" : "Move order"}
                  </button>
                </div>
              </label>
              {destinationId !== order.subhubUserId ? (
                <label className="block text-sm font-medium">
                  Reason for moving <span className="font-normal text-muted-foreground">(optional)</span>
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                  />
                </label>
              ) : null}
              {isMasterAdmin ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    disabled={saving || deleting}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    <Edit3 className="size-4" /> Edit target
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTarget()}
                    disabled={deleting || saving}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" /> {deleting ? "Deleting…" : "Delete target"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      {editing && isMasterAdmin ? (
        <ProductionTargetEditor
          order={order}
          subhubs={subhubs}
          busy={saving}
          onClose={() => setEditing(false)}
          onSave={saveTarget}
        />
      ) : null}
    </Shell>
  );
}

function SectionHeading({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <header className="border-b border-border py-3">
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}

function ActivityRow({ activity }: { activity: ProductionOrderActivity }) {
  return (
    <li className="flex flex-wrap gap-x-4 gap-y-2 px-2 py-4 text-sm">
      <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-medium">{activity.summary}</p>
          <time className="tabular text-xs text-muted-foreground">{formatTimestamp(activity.createdAt)}</time>
        </div>
        <p className="mt-1 text-muted-foreground">{activity.details}</p>
        <p className="mt-1 text-xs text-muted-foreground">By {activity.actorName} · {activity.actorRole}</p>
      </div>
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 px-2 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto max-w-[70%] text-right font-medium">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}