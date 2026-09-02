import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarRange, Copy, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel } from "@/components/erp/bits";
import { bomCatalog } from "@/lib/bom-catalog";
import { createProductionOrdersFn, listAssignableSubhubsFn } from "@/production";
import type { AssignableSubhub } from "@/production.server";

export const Route = createFileRoute("/production-targets")({
  head: () => ({
    meta: [
      { title: "Assign Production Targets — Float ERP" },
      { name: "description", content: "Build a production target plan for one or more SubHubs." },
    ],
  }),
  component: ProductionTargets,
});

type AssignmentDraft = {
  id: number;
  subhubUserId: string;
  productCode: string;
  variantCode: string;
  target: string;
  dueDate: string;
  notes: string;
};

type AssignmentGroup = {
  key: string;
  subhubUserId: string;
  assignments: AssignmentDraft[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyAssignment(id: number): AssignmentDraft {
  return {
    id,
    subhubUserId: "",
    productCode: bomCatalog[0]?.code ?? "",
    variantCode: bomCatalog[0]?.variants[0]?.code ?? "",
    target: "",
    dueDate: today(),
    notes: "",
  };
}

function groupAssignments(assignments: AssignmentDraft[]): AssignmentGroup[] {
  const groups: AssignmentGroup[] = [];
  const groupByKey = new Map<string, AssignmentGroup>();
  assignments.forEach((assignment) => {
    const key = assignment.subhubUserId ? `subhub:${assignment.subhubUserId}` : `unassigned:${assignment.id}`;
    let group = groupByKey.get(key);
    if (!group) {
      group = { key, subhubUserId: assignment.subhubUserId, assignments: [] };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.assignments.push(assignment);
  });
  return groups;
}

function ProductionTargets() {
  const nextId = useRef(1);
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([emptyAssignment(nextId.current)]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void (async () => {
      const result = await listAssignableSubhubsFn();
      if (result.ok) setSubhubs(result.subhubs);
      else setError(result.message);
      setLoading(false);
    })();
  }, []);

  const assignedSubhubCount = new Set(assignments.map((assignment) => assignment.subhubUserId).filter(Boolean)).size;
  const totalUnits = assignments.reduce((total, assignment) => {
    const value = Number(assignment.target);
    return total + (Number.isInteger(value) && value > 0 ? value : 0);
  }, 0);
  const assignmentGroups = groupAssignments(assignments);

  function updateAssignment(id: number, patch: Partial<Omit<AssignmentDraft, "id">>) {
    setAssignments((current) => current.map((assignment) => assignment.id === id ? { ...assignment, ...patch } : assignment));
    setSuccess("");
    setError("");
  }

  function addAssignment() {
    nextId.current += 1;
    setAssignments((current) => [...current, emptyAssignment(nextId.current)]);
  }

  function duplicateAssignment(assignment: AssignmentDraft) {
    nextId.current += 1;
    setAssignments((current) => [...current, { ...assignment, id: nextId.current }]);
  }

  function addAssignmentForSubhub(assignment: AssignmentDraft) {
    nextId.current += 1;
    setAssignments((current) => [
      ...current,
      {
        ...emptyAssignment(nextId.current),
        subhubUserId: assignment.subhubUserId,
        productCode: assignment.productCode,
        variantCode: assignment.variantCode,
        dueDate: assignment.dueDate,
      },
    ]);
  }

  function changeGroupSubhub(group: AssignmentGroup, subhubUserId: string) {
    const assignmentIds = new Set(group.assignments.map((assignment) => assignment.id));
    setAssignments((current) => current.map((assignment) => assignmentIds.has(assignment.id) ? { ...assignment, subhubUserId } : assignment));
    setSuccess("");
    setError("");
  }

  function removeAssignment(id: number) {
    setAssignments((current) => current.length === 1 ? current : current.filter((assignment) => assignment.id !== id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const invalidIndex = assignments.findIndex((assignment) => (
      !assignment.subhubUserId
      || !assignment.productCode
      || !assignment.variantCode
      || !Number.isInteger(Number(assignment.target))
      || Number(assignment.target) < 1
      || !assignment.dueDate
    ));
    if (invalidIndex !== -1) {
      setError(`Complete all required fields in assignment ${invalidIndex + 1}.`);
      return;
    }

    setSaving(true);
    const result = await createProductionOrdersFn({
      data: {
        assignments: assignments.map((assignment) => ({
          subhubUserId: assignment.subhubUserId,
          productCode: assignment.productCode,
          variantCode: assignment.variantCode,
          target: Number(assignment.target),
          dueDate: assignment.dueDate,
          notes: assignment.notes,
        })),
      },
    });
    if (result.ok) {
      setSuccess(`${result.orders.length} production target${result.orders.length === 1 ? "" : "s"} assigned successfully.`);
      nextId.current += 1;
      setAssignments([emptyAssignment(nextId.current)]);
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  return (
    <Shell
      title="Assign Production Targets"
      subtitle="Build a target plan with independent assignments for every SubHub and Float variant"
      actions={
        <Link to="/orders" className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Assignment rows" value={String(assignments.length)} hint="orders to be created" />
          <Kpi label="SubHubs covered" value={String(assignedSubhubCount)} hint="a SubHub can appear more than once" />
          <Kpi label="Planned units" value={totalUnits.toLocaleString()} hint="valid quantities only" />
        </div>

        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {success ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{success} <Link to="/orders" className="ml-1 font-medium underline">View assigned orders</Link></p> : null}

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">How target plans work</p>
          <p className="mt-1 text-muted-foreground">
            Each row below creates one production order. Use the same SubHub on multiple rows when it needs different Float variants or separate targets. Use different SubHubs on the same plan when each has its own work.
          </p>
        </div>

        <Panel
          title="Target assignments"
          description="Set the SubHub, Float variant, quantity, and due date independently for every target."
          action={
            <button type="button" onClick={addAssignment} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Plus className="size-3.5" /> Add target row
            </button>
          }
        >
          <div className="space-y-4 p-5">
            {assignmentGroups.map((group, index) => (
              <SubhubAssignmentCard
                key={group.key}
                group={group}
                index={index}
                subhubs={subhubs}
                loading={loading}
                canRemove={assignments.length > 1}
                onChange={updateAssignment}
                onChangeSubhub={changeGroupSubhub}
                onDuplicate={duplicateAssignment}
                onAddForSubhub={addAssignmentForSubhub}
                onRemove={removeAssignment}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-5 py-4">
            <p className="text-xs text-muted-foreground">
              {assignments.length} row{assignments.length === 1 ? "" : "s"} · {assignedSubhubCount} SubHub{assignedSubhubCount === 1 ? "" : "s"} · {totalUnits.toLocaleString()} planned units
            </p>
            <button type="submit" disabled={saving || loading || !subhubs.length} className="rule-header inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Assigning targets…" : "Assign all targets"}
            </button>
          </div>
        </Panel>
      </form>
    </Shell>
  );
}

function SubhubAssignmentCard({
  group,
  index,
  subhubs,
  loading,
  canRemove,
  onChange,
  onChangeSubhub,
  onDuplicate,
  onAddForSubhub,
  onRemove,
}: {
  group: AssignmentGroup;
  index: number;
  subhubs: AssignableSubhub[];
  loading: boolean;
  canRemove: boolean;
  onChange: (id: number, patch: Partial<Omit<AssignmentDraft, "id">>) => void;
  onChangeSubhub: (group: AssignmentGroup, subhubUserId: string) => void;
  onDuplicate: (assignment: AssignmentDraft) => void;
  onAddForSubhub: (assignment: AssignmentDraft) => void;
  onRemove: (id: number) => void;
}) {
  const selectedSubhub = subhubs.find((subhub) => subhub.id === group.subhubUserId);
  const firstAssignment = group.assignments[0];

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-muted/20 px-4 py-4">
        <div className="min-w-64 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">SubHub card {index + 1}</p>
          <label className="mt-2 block text-sm font-medium">
            SubHub / factory
            <select required disabled={loading} value={group.subhubUserId} onChange={(event) => onChangeSubhub(group, event.target.value)} className="mt-1.5 h-10 w-full max-w-xl rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60">
              <option value="">{loading ? "Loading SubHubs…" : "Select SubHub"}</option>
              {subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.subhubName} · {subhub.name}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedSubhub ? `${selectedSubhub.subhubName} · ${selectedSubhub.name}` : "Select a SubHub to add targets to this card"}
          </p>
        </div>
        <button type="button" onClick={() => firstAssignment && onAddForSubhub(firstAssignment)} disabled={!group.subhubUserId} className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40" title="Add another target inside this SubHub card">
          <Plus className="size-3.5" /> Add target here
        </button>
      </header>

      <div className="divide-y divide-border">
        {group.assignments.map((assignment, targetIndex) => (
          <AssignmentItem
            key={assignment.id}
            assignment={assignment}
            index={targetIndex}
            canRemove={canRemove}
            onChange={onChange}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        ))}
      </div>
      <div className="border-t border-border bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground">
        {group.assignments.length} target{group.assignments.length === 1 ? "" : "s"} in this SubHub card
      </div>
    </article>
  );
}

function AssignmentItem({
  assignment,
  index,
  canRemove,
  onChange,
  onDuplicate,
  onRemove,
}: {
  assignment: AssignmentDraft;
  index: number;
  canRemove: boolean;
  onChange: (id: number, patch: Partial<Omit<AssignmentDraft, "id">>) => void;
  onDuplicate: (assignment: AssignmentDraft) => void;
  onRemove: (id: number) => void;
}) {
  const product = bomCatalog.find((item) => item.code === assignment.productCode) ?? bomCatalog[0];
  const selectedVariant = product?.variants.find((variant) => variant.code === assignment.variantCode);
  const variantOptions = useMemo(() => product?.variants ?? [], [product]);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Target {index + 1}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{selectedVariant?.name ?? "Choose a Float variant"} · {assignment.target ? `${assignment.target} units` : "Quantity not set"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onDuplicate(assignment)} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted" title="Duplicate this target">
            <Copy className="size-3.5" /> Duplicate
          </button>
          <button type="button" onClick={() => onRemove(assignment.id)} disabled={!canRemove} aria-label={`Remove target ${index + 1}`} className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-medium">
          Float type
          <select required value={assignment.productCode} onChange={(event) => {
            const nextProduct = bomCatalog.find((item) => item.code === event.target.value);
            onChange(assignment.id, { productCode: event.target.value, variantCode: nextProduct?.variants[0]?.code ?? "" });
          }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
            {bomCatalog.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Variant
          <select required value={assignment.variantCode} onChange={(event) => onChange(assignment.id, { variantCode: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
            {variantOptions.map((variant) => <option key={variant.code} value={variant.code}>{variant.name} · {variant.company} · {variant.code}</option>)}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Target quantity
          <input required type="number" min="1" step="1" value={assignment.target} onChange={(event) => onChange(assignment.id, { target: event.target.value })} placeholder="1000" className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
        </label>

        <label className="block text-sm font-medium">
          Due date
          <span className="relative mt-1.5 block">
            <CalendarRange className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input required type="date" value={assignment.dueDate} onChange={(event) => onChange(assignment.id, { dueDate: event.target.value })} className="tabular h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </span>
        </label>

        <label className="block text-sm font-medium lg:col-span-2 xl:col-span-3">
          Instructions <span className="font-normal text-muted-foreground">(optional)</span>
          <input value={assignment.notes} onChange={(event) => onChange(assignment.id, { notes: event.target.value })} placeholder="Shift or delivery instructions…" className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
        </label>
      </div>
    </div>
  );
}