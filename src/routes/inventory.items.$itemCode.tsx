import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownCircle, ArrowUpCircle, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Panel, Tag } from "@/components/erp/bits";
import { getInventoryItemDetailFn } from "@/inventory";
import type { InventoryItemDetail } from "@/inventory.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/inventory/items/$itemCode")({ component: InventoryItemDetailPage });

function InventoryItemDetailPage() {
  const { itemCode } = Route.useParams();
  const [data, setData] = useState<InventoryItemDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getInventoryItemDetailFn({ data: { itemCode } }).then((result) => {
      if (result.ok) {
        setData(result.data);
        setError("");
      } else {
        setError(result.message);
      }
    });
  }, [itemCode]);

  return (
    <SubHubShell actions={<Link to="/inventory/raw-materials" className="text-sm text-primary hover:underline">Back to inventory</Link>}>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {!data ? <p className="text-sm text-muted-foreground">Loading item details…</p> : <ItemDetail data={data} />}
      </section>
    </SubHubShell>
  );
}

function ItemDetail({ data }: { data: InventoryItemDetail }) {
  const { item } = data;
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">SubHub / Inventory Management / Item detail</p>
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{item.code} · {item.category}</p>
      </div>
      <Tag tone={item.quantity > 0 ? "good" : "warn"}>{item.quantity > 0 ? "Available" : "No stock"}</Tag>
    </div>
    <Panel title="Inventory summary" description="Aggregate stock and all currently available batches for this item.">
      <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Total quantity" value={`${num(item.quantity)} ${item.unit}`} />
        <Summary label="Available batches" value={num(data.batches.length)} />
        <Summary label="Category" value={item.category} />
        <Summary label="Unit price" value={item.price ? `₹${num(item.price)}` : "—"} />
      </dl>
    </Panel>
    <Panel title="Currently available batches" description="Only batches with remaining available quantity are shown here. Select a batch for full traceability.">
      {data.batches.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Batch code</th><th className="px-5 py-3">Source</th><th className="px-5 py-3 text-right">Received</th><th className="px-5 py-3 text-right">Produced</th><th className="px-5 py-3 text-right">Consumed</th><th className="px-5 py-3 text-right">Defective</th><th className="px-5 py-3 text-right">Available</th><th className="px-5 py-3">Logged</th></tr></thead><tbody>{data.batches.map((batch) => <tr key={batch.id} className="border-b border-border/70"><td className="px-5 py-3"><Link to="/inventory/batches/$batchId" params={{ batchId: batch.id }} className="font-medium text-primary hover:underline">{batch.batchCode}</Link></td><td className="px-5 py-3"><p>{batch.source}</p><p className="text-xs text-muted-foreground">{batch.sourceReference}</p></td><td className="tabular px-5 py-3 text-right">{num(batch.receivedQuantity)}</td><td className="tabular px-5 py-3 text-right">{num(batch.producedQuantity)}</td><td className="tabular px-5 py-3 text-right">{num(batch.consumedQuantity)}</td><td className="tabular px-5 py-3 text-right">{num(batch.defectiveQuantity)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(batch.availableQuantity)}</td><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{formatDate(batch.loggedAt)}</td></tr>)}</tbody></table></div> : <EmptyState text="No available batches for this item." />}
    </Panel>
    <Panel title="Batch movement logs" description="All receipt, production, consumption, quality, and adjustment movements for this item.">
      {data.batchMovements.length ? <MovementTable movements={data.batchMovements} /> : <EmptyState text="No batch movement logs for this item." />}
    </Panel>
    <Panel title="Inventory logs" description="Aggregate inventory changes recorded for this item.">
      {data.movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Date / time</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3 text-right">Change</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Notes</th></tr></thead><tbody>{data.movements.map((movement) => <tr key={movement.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-5 py-3 text-xs">{formatDate(movement.date)}</td><td className="px-5 py-3">{movement.type}</td><td className="px-5 py-3"><p>{movement.reason}</p><p className="text-xs text-muted-foreground">{movement.reference}</p></td><td className={`tabular px-5 py-3 text-right font-semibold ${movement.change >= 0 ? "text-success" : "text-destructive"}`}>{movement.change > 0 ? "+" : ""}{num(movement.change)}</td><td className="tabular px-5 py-3 text-right">{num(movement.balance)}</td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{movement.notes || "—"}</td></tr>)}</tbody></table></div> : <EmptyState text="No aggregate inventory logs for this item." />}
    </Panel>
    <Panel title="Quality logs" description="All quality deductions and defect records related to this item.">
      {data.qualityLogs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Date / time</th><th className="px-5 py-3">Issue</th><th className="px-5 py-3">Batch</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3">Recorded by</th><th className="px-5 py-3">Notes</th></tr></thead><tbody>{data.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-5 py-3 text-xs">{formatDate(log.date)}</td><td className="px-5 py-3"><Tag tone="bad">{log.issue}</Tag></td><td className="px-5 py-3 text-xs">{log.batchCode || "FIFO batches"}</td><td className="tabular px-5 py-3 text-right text-destructive">-{num(log.quantity)}</td><td className="px-5 py-3">{log.recordedByName || log.recordedBy}</td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{log.notes || "—"}</td></tr>)}</tbody></table></div> : <EmptyState text="No quality logs for this item." />}
    </Panel>
  </>;
}

function MovementTable({ movements }: { movements: InventoryItemDetail["batchMovements"] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Date / time</th><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Movement</th><th className="px-5 py-3">Reason / reference</th><th className="px-5 py-3 text-right">Delta</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-5 py-3 text-xs">{formatDate(movement.createdAt)}</td><td className="px-5 py-3"><Link to="/inventory/batches/$batchId" params={{ batchId: movement.batchId }} className="font-medium text-primary hover:underline">{movement.batchCode}</Link></td><td className="px-5 py-3">{movement.quantityDelta > 0 ? <ArrowUpCircle className="mr-2 inline size-4 text-success" /> : <ArrowDownCircle className="mr-2 inline size-4 text-destructive" />}{movement.type}</td><td className="px-5 py-3"><p>{movement.reason}</p><p className="text-xs text-muted-foreground">{movement.reference}</p></td><td className={`tabular px-5 py-3 text-right font-semibold ${movement.quantityDelta > 0 ? "text-success" : "text-destructive"}`}>{movement.quantityDelta > 0 ? "+" : ""}{num(movement.quantityDelta)}</td><td className="tabular px-5 py-3 text-right">{num(movement.balance)}</td></tr>)}</tbody></table></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-10 text-center"><Package className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{text}</p></div>;
}

function formatDate(value: string) {
  return value.replace("T", " ").slice(0, 19);
}