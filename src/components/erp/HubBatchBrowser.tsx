import { useEffect, useMemo, useState } from "react";
import { getManagedHubBatchDetailFn, getManagedHubBatchesFn, getManagedHubItemDetailFn } from "@/inventory";
import type { BatchTraceabilityData, InventoryBatch, InventoryItemDetail } from "@/inventory.server";
import { num } from "@/lib/erp-data";
import { Panel, Tag } from "./bits";
import { TablePagination } from "./TablePagination";

type StaffPanel = "admin" | "procurement";

export function HubBatchBrowser({
  hubId,
  panel,
  initialBatches,
}: {
  hubId: string;
  panel: StaffPanel;
  initialBatches?: InventoryBatch[];
}) {
  const [batches, setBatches] = useState<InventoryBatch[]>(initialBatches ?? []);
  const [loading, setLoading] = useState(initialBatches === undefined);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [error, setError] = useState("");
  const [itemDetail, setItemDetail] = useState<InventoryItemDetail | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchTraceabilityData | null>(null);

  useEffect(() => {
    if (initialBatches !== undefined) {
      setBatches(initialBatches);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    void getManagedHubBatchesFn({ data: { panel, hubId } })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setBatches(result.batches);
          setError("");
        } else {
          setError(result.message);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Hub batches could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hubId, initialBatches, panel]);

  const filteredBatches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return batches.filter((batch) => !search || `${batch.batchCode} ${batch.itemName} ${batch.itemCode} ${batch.source}`.toLowerCase().includes(search));
  }, [batches, query]);
  const visibleBatches = useMemo(() => filteredBatches.slice((page - 1) * pageSize, page * pageSize), [filteredBatches, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [hubId, query]);

  async function openItem(itemCode: string) {
    setItemDetail(null);
    setBatchDetail(null);
    setError("");
    setDetailLoading(true);
    try {
      const result = await getManagedHubItemDetailFn({ data: { panel, hubId, itemCode } });
      if (result.ok) setItemDetail(result.data);
      else setError(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Item traceability could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function openBatch(batchId: string) {
    setItemDetail(null);
    setBatchDetail(null);
    setError("");
    setDetailLoading(true);
    try {
      const result = await getManagedHubBatchDetailFn({ data: { panel, hubId, batchId } });
      if (result.ok) setBatchDetail(result.data);
      else setError(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Batch traceability could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  }

  function clearDetails() {
    setItemDetail(null);
    setBatchDetail(null);
    setError("");
  }

  return (
    <div className="space-y-5">
      <Panel title="Batch register" description="Workspace-scoped batch history and current availability for this SubHub.">
        <div className="border-b border-border p-4">
          <label className="block max-w-xl text-xs font-medium text-muted-foreground">
            Search batches
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Batch, item or source"
              className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
            />
          </label>
        </div>
        {error ? <p role="alert" className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading hub batches…</p> : filteredBatches.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{batches.length ? "No batches match the search." : "No batches are recorded for this SubHub."}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="border-b border-border bg-muted/15 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Batch code</th><th className="px-4 py-3">Item / source</th>
                    <th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3 text-right">Produced</th>
                    <th className="px-4 py-3 text-right">Consumed</th><th className="px-4 py-3 text-right">Defective</th>
                    <th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBatches.map((batch) => (
                    <tr key={batch.id} className="border-b border-border/70 last:border-0">
                      <td className="tabular whitespace-nowrap px-4 py-3">
                        <button type="button" onClick={() => void openBatch(batch.id)} className="font-medium text-primary hover:underline">{batch.batchCode}</button>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void openItem(batch.itemCode)} className="text-left font-medium text-primary hover:underline">{batch.itemName}</button>
                        <p className="text-xs text-muted-foreground">{batch.itemCode} · {batch.source}</p>
                      </td>
                      <td className="tabular px-4 py-3 text-right">{num(batch.receivedQuantity)}</td>
                      <td className="tabular px-4 py-3 text-right">{num(batch.producedQuantity)}</td>
                      <td className="tabular px-4 py-3 text-right">{num(batch.consumedQuantity)}</td>
                      <td className="tabular px-4 py-3 text-right">{num(batch.defectiveQuantity)}</td>
                      <td className="tabular px-4 py-3 text-right font-semibold">{num(batch.availableQuantity)}</td>
                      <td className="px-4 py-3"><Tag tone={batch.availableQuantity > 0 ? "good" : "neutral"}>{batch.status}</Tag></td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(batch.loggedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination total={filteredBatches.length} page={page} pageSize={pageSize} pageSizeOptions={[15, 25, 50, 100]} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Panel>

      {detailLoading ? <p className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">Loading traceability…</p> : null}
      {itemDetail ? <ItemTraceability data={itemDetail} onOpenBatch={openBatch} onClose={clearDetails} /> : null}
      {batchDetail ? <BatchTraceability data={batchDetail} onClose={clearDetails} onOpenBatch={openBatch} /> : null}
    </div>
  );
}

function ItemTraceability({ data, onOpenBatch, onClose }: { data: InventoryItemDetail; onOpenBatch: (batchId: string) => void; onClose: () => void }) {
  const { item } = data;
  return (
    <Panel title={`${item.name} · item traceability`} description={`${item.code} · ${item.category}`} action={<button type="button" onClick={onClose} className="text-xs font-medium text-primary hover:underline">Close</button>}>
      <dl className="grid gap-4 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Current quantity" value={`${num(item.quantity)} ${item.unit}`} />
        <Summary label="Available batches" value={num(data.batches.length)} />
        <Summary label="Category" value={item.category} />
        <Summary label="Unit price" value={item.price ? `₹${num(item.price)}` : "—"} />
      </dl>
      <div className="border-b border-border p-5">
        <h3 className="text-sm font-semibold">Currently available batches</h3>
        {data.batches.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Produced</th><th className="px-3 py-2 text-right">Consumed</th><th className="px-3 py-2 text-right">Defective</th><th className="px-3 py-2 text-right">Available</th></tr></thead>
              <tbody>{data.batches.map((batch) => <tr key={batch.id} className="border-b border-border/70 last:border-0"><td className="px-3 py-2"><button type="button" onClick={() => onOpenBatch(batch.id)} className="font-medium text-primary hover:underline">{batch.batchCode}</button></td><td className="px-3 py-2">{batch.source}<p className="text-xs text-muted-foreground">{batch.sourceReference}</p></td><td className="tabular px-3 py-2 text-right">{num(batch.receivedQuantity)}</td><td className="tabular px-3 py-2 text-right">{num(batch.producedQuantity)}</td><td className="tabular px-3 py-2 text-right">{num(batch.consumedQuantity)}</td><td className="tabular px-3 py-2 text-right">{num(batch.defectiveQuantity)}</td><td className="tabular px-3 py-2 text-right font-semibold">{num(batch.availableQuantity)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-muted-foreground">No currently available batches.</p>}
      </div>
      <div className="border-b border-border p-5">
        <h3 className="text-sm font-semibold">Batch movement logs</h3>
        {data.batchMovements.length ? <MovementTable movements={data.batchMovements} onOpenBatch={onOpenBatch} /> : <p className="mt-3 text-sm text-muted-foreground">No batch movements are recorded.</p>}
      </div>
      <div className="border-b border-border p-5">
        <h3 className="text-sm font-semibold">Inventory logs</h3>
        {data.movements.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Date / time</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2 text-right">Change</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Notes</th></tr></thead><tbody>{data.movements.map((movement) => <tr key={movement.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-3 py-2 text-xs">{formatDate(movement.date)}</td><td className="px-3 py-2">{movement.type}</td><td className="px-3 py-2">{movement.reason}<p className="text-xs text-muted-foreground">{movement.reference}</p></td><td className="tabular px-3 py-2 text-right">{movement.change > 0 ? "+" : ""}{num(movement.change)}</td><td className="tabular px-3 py-2 text-right">{num(movement.balance)}</td><td className="px-3 py-2">{movement.notes || "—"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-muted-foreground">No inventory movements are recorded.</p>}
      </div>
      <div className="p-5">
        <h3 className="text-sm font-semibold">Quality logs</h3>
        {data.qualityLogs.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Date / time</th><th className="px-3 py-2">Issue</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2">Recorded by</th><th className="px-3 py-2">Notes</th></tr></thead><tbody>{data.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-3 py-2 text-xs">{formatDate(log.date)}</td><td className="px-3 py-2">{log.issue}</td><td className="px-3 py-2">{log.batchCode || "FIFO batches"}</td><td className="tabular px-3 py-2 text-right">{num(log.quantity)}</td><td className="px-3 py-2">{log.recordedByName || log.recordedBy}</td><td className="px-3 py-2">{log.notes || "—"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-muted-foreground">No quality logs are recorded.</p>}
      </div>
    </Panel>
  );
}

function BatchTraceability({ data, onClose, onOpenBatch }: { data: BatchTraceabilityData; onClose: () => void; onOpenBatch: (batchId: string) => void }) {
  const { batch } = data;
  return (
    <div className="space-y-5">
      <Panel title="Batch traceability" description={`${batch.itemName} · ${batch.itemCode}`} action={<button type="button" onClick={onClose} className="text-xs font-medium text-primary hover:underline">Close</button>}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch code</p><h3 className="tabular mt-1 text-lg font-semibold">{batch.batchCode}</h3></div>
          <Tag tone={batch.availableQuantity ? "good" : "warn"}>{batch.status}</Tag>
        </div>
        <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Category" value={batch.category} /><Summary label="Source" value={batch.source} />
          <Summary label="Source reference" value={batch.sourceReference || "—"} /><Summary label="Logged" value={formatDate(batch.loggedAt)} />
          <Summary label="Received" value={num(batch.receivedQuantity)} /><Summary label="Produced" value={num(batch.producedQuantity)} />
          <Summary label="Consumed" value={num(batch.consumedQuantity)} /><Summary label="Defective" value={num(batch.defectiveQuantity)} />
          <Summary label="Available" value={num(batch.availableQuantity)} />
        </dl>
        <div className="border-t border-border p-5">
          <h3 className="text-sm font-semibold">Source metadata</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(batch.sourceMetadata).length ? Object.entries(batch.sourceMetadata).map(([key, value]) => <div key={key} className="rounded border border-border/70 bg-muted/20 px-3 py-2"><dt className="text-xs text-muted-foreground">{labelize(key)}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>) : <p className="text-sm text-muted-foreground">No additional source metadata recorded.</p>}</dl>
        </div>
      </Panel>
      <Lineage title="Parent input batches" rows={data.parents} parent onOpenBatch={onOpenBatch} />
      <Lineage title="Child output batches" rows={data.children} onOpenBatch={onOpenBatch} />
      <Panel title="Quality records">{data.qualityLogs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Issue</th><th className="px-4 py-2 text-right">Quantity</th><th className="px-4 py-2">Recorded by</th><th className="px-4 py-2">Notes</th></tr></thead><tbody>{data.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70"><td className="tabular px-4 py-2">{formatDate(log.date)}</td><td className="px-4 py-2">{log.issue}</td><td className="tabular px-4 py-2 text-right">{num(log.quantity)}</td><td className="px-4 py-2">{log.recordedByName || log.recordedBy}</td><td className="px-4 py-2">{log.notes || "—"}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-muted-foreground">No quality records are linked to this batch.</p>}</Panel>
      <Panel title="Movement ledger">{data.movements.length ? <MovementTable movements={data.movements} /> : <p className="p-5 text-sm text-muted-foreground">No movements are recorded for this batch.</p>}</Panel>
    </div>
  );
}

function MovementTable({ movements, onOpenBatch }: { movements: InventoryItemDetail["batchMovements"]; onOpenBatch?: (batchId: string) => void }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Date / time</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Movement</th><th className="px-3 py-2">Reason / reference</th><th className="px-3 py-2 text-right">Delta</th><th className="px-3 py-2 text-right">Balance</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-3 py-2 text-xs">{formatDate(movement.createdAt)}</td><td className="px-3 py-2">{onOpenBatch ? <button type="button" onClick={() => onOpenBatch(movement.batchId)} className="text-primary hover:underline">{movement.batchCode}</button> : movement.batchCode}</td><td className="px-3 py-2">{movement.type}</td><td className="px-3 py-2">{movement.reason}<p className="text-xs text-muted-foreground">{movement.reference}</p></td><td className={`tabular px-3 py-2 text-right ${movement.quantityDelta > 0 ? "text-success" : "text-destructive"}`}>{movement.quantityDelta > 0 ? "+" : ""}{num(movement.quantityDelta)}</td><td className="tabular px-3 py-2 text-right">{num(movement.balance)}</td></tr>)}</tbody></table></div>;
}

function Lineage({ title, rows, parent, onOpenBatch }: { title: string; rows: BatchTraceabilityData["parents"]; parent?: boolean; onOpenBatch: (batchId: string) => void }) {
  return <Panel title={title} description={parent ? "Inputs consumed to create this batch." : "Output batches derived from this batch."}>{rows.length ? <ul className="divide-y divide-border">{rows.map((row) => { const batchId = parent ? row.parentBatchId : row.childBatchId; const batchCode = parent ? row.parentBatchCode : row.childBatchCode; return <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"><div><button type="button" onClick={() => onOpenBatch(batchId)} className="font-medium text-primary hover:underline">{batchCode}</button><p className="text-xs text-muted-foreground">{parent ? `${row.parentItemName} · ${row.parentItemCode}` : `${row.childItemName} · ${row.childItemCode}`}</p></div><div className="text-right"><p className="tabular font-medium">{num(row.quantity)} units</p><p className="text-xs text-muted-foreground">{row.reference} · {formatDate(row.createdAt)}</p></div></li>; })}</ul> : <p className="p-5 text-sm text-muted-foreground">No linked batches.</p>}</Panel>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>;
}

function formatDate(value: string) {
  return value.replace("T", " ").slice(0, 19);
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (character) => character.toUpperCase());
}