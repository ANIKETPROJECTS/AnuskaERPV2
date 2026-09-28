import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ProductionTargetsNav } from "@/components/erp/ProductionTargetsNav";
import { Shell } from "@/components/erp/Shell";
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

  const totalUnits = assignments.reduce((total, assignment) => {
    const value = Number(assignment.target);
    return total + (Number.isInteger(value) && value > 0 ? value : 0);
  }, 0);

  function updateAssignment(id: number, patch: Partial<Omit<AssignmentDraft, "id">>) {
    setAssignments((current) => current.map((assignment) => assignment.id === id ? { ...assignment, ...patch } : assignment));
    setSuccess("");
    setError("");
  }

  function addAssignment() {
    nextId.current += 1;
    setAssignments((current) => [...current, emptyAssignment(nextId.current)]);
    setSuccess("");
    setError("");
  }

  function removeAssignment(id: number) {
    setAssignments((current) => current.length === 1 ? current : current.filter((assignment) => assignment.id !== id));
    setSuccess("");
    setError("");
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
      const capacityNotice = result.capacityWarnings.length
        ? ` Capacity warning: ${result.capacityWarnings.map((warning) => (
          `${warning.subhubName} has ${warning.openUnits.toLocaleString()} open units against a ${warning.capacityUnits.toLocaleString()}-unit limit (${warning.excessUnits.toLocaleString()} over).`
        )).join(" ")}`
        : "";
      setSuccess(`${result.orders.length} production target${result.orders.length === 1 ? "" : "s"} assigned to the selected SubHubs.${capacityNotice}`);
      nextId.current += 1;
      setAssignments([emptyAssignment(nextId.current)]);
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  return (
    <Shell
      title="Orders & Production Targets"
      subtitle="Assign production work to one or more SubHubs"
    >
      <form onSubmit={submit} className="space-y-5">
        <ProductionTargetsNav active="assign" />
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {success ? (
          <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">
            {success} <Link to="/orders" className="ml-1 font-medium underline">View orders</Link>
          </p>
        ) : null}

        <section aria-labelledby="assign-targets-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="assign-targets-heading" className="text-base font-semibold">Assign production targets</h2>
              <p className="mt-1 text-sm text-muted-foreground">Each row creates one order. Choose a SubHub, product, quantity, and due date.</p>
            </div>
            <button
              type="button"
              onClick={addAssignment}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              <Plus className="size-4" /> Add target row
            </button>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {assignments.map((assignment, index) => (
              <AssignmentItem
                key={assignment.id}
                assignment={assignment}
                index={index}
                subhubs={subhubs}
                loading={loading}
                canRemove={assignments.length > 1}
                onChange={updateAssignment}
                onRemove={removeAssignment}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              {assignments.length} {assignments.length === 1 ? "target row" : "target rows"} · {totalUnits.toLocaleString()} planned units
            </p>
            <button
              type="submit"
              disabled={saving || loading || !subhubs.length}
              className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Assigning…" : "Assign targets"}
            </button>
          </div>
        </section>
      </form>
    </Shell>
  );
}

function AssignmentItem({
  assignment,
  index,
  subhubs,
  loading,
  canRemove,
  onChange,
  onRemove,
}: {
  assignment: AssignmentDraft;
  index: number;
  subhubs: AssignableSubhub[];
  loading: boolean;
  canRemove: boolean;
  onChange: (id: number, patch: Partial<Omit<AssignmentDraft, "id">>) => void;
  onRemove: (id: number) => void;
}) {
  const product = bomCatalog.find((item) => item.code === assignment.productCode) ?? bomCatalog[0];
  const variantOptions = useMemo(() => product?.variants ?? [], [product]);
  const floatTypeOptions = useMemo(
    () => bomCatalog.map((item) => ({ value: item.code, label: `${item.name} · ${item.code}`, search: `${item.name} ${item.code}` })),
    [],
  );
  const searchableVariantOptions = useMemo(
    () => variantOptions.map((variant) => ({ value: variant.code, label: `${variant.name} · ${variant.company} · ${variant.code}`, search: `${variant.name} ${variant.company} ${variant.code}` })),
    [variantOptions],
  );

  return (
    <article className="py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Target {index + 1}</h3>
        <button
          type="button"
          onClick={() => onRemove(assignment.id)}
          disabled={!canRemove}
          aria-label={`Remove target ${index + 1}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="size-4" /> Remove
        </button>
      </div>
      <div className="grid gap-x-4 gap-y-3 pt-3 md:grid-cols-2 xl:grid-cols-12">
        <label className="block text-sm font-medium xl:col-span-2">
          SubHub
          <select
            required
            disabled={loading}
            value={assignment.subhubUserId}
            onChange={(event) => onChange(assignment.id, { subhubUserId: event.target.value })}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
          >
            <option value="">{loading ? "Loading SubHubs…" : "Select SubHub"}</option>
            {subhubs.map((subhub) => (
              <option key={subhub.id} value={subhub.id}>{subhub.subhubName} · {subhub.name}</option>
            ))}
          </select>
        </label>

        <div className="xl:col-span-2">
        <SearchableSelect
          label="Float type"
          value={assignment.productCode}
          options={floatTypeOptions}
          required
          onChange={(value) => {
            const nextProduct = bomCatalog.find((item) => item.code === value);
            onChange(assignment.id, { productCode: value, variantCode: nextProduct?.variants[0]?.code ?? "" });
          }}
        />
        </div>

        <div className="xl:col-span-3">
        <SearchableSelect
          label="Variant"
          value={assignment.variantCode}
          options={searchableVariantOptions}
          required
          onChange={(value) => onChange(assignment.id, { variantCode: value })}
        />
        </div>

        <label className="block text-sm font-medium xl:col-span-1">
          Quantity
          <input
            required
            type="number"
            min="1"
            step="1"
            value={assignment.target}
            onChange={(event) => onChange(assignment.id, { target: event.target.value })}
            placeholder="1000"
            className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block text-sm font-medium xl:col-span-2">
          Due date
          <input
            required
            type="date"
            value={assignment.dueDate}
            onChange={(event) => onChange(assignment.id, { dueDate: event.target.value })}
            className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block text-sm font-medium xl:col-span-2">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={assignment.notes}
            onChange={(event) => onChange(assignment.id, { notes: event.target.value })}
            placeholder="Special instructions"
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>
    </article>
  );
}

type SearchableOption = {
  value: string;
  label: string;
  search?: string;
};

function SearchableSelect({
  label,
  value,
  options,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) => `${option.label} ${option.search ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function toggle() {
    setOpen((current) => !current);
    setQuery("");
  }

  function selectOption(option: SearchableOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative block text-sm font-medium">
      {label}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="mt-1.5 flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm font-normal outline-none focus:border-primary"
      >
        <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>{selected?.label ?? `Select ${label.toLowerCase()}`}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {required && !value ? <input required tabIndex={-1} value="" onChange={() => undefined} className="pointer-events-none absolute h-px w-px opacity-0" aria-label={label} /> : null}
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm font-normal outline-none focus:border-primary"
                aria-label={`Search ${label}`}
              />
            </div>
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => selectOption(option)}
                className={`block w-full rounded px-2.5 py-2 text-left text-sm hover:bg-muted ${option.value === value ? "bg-primary/10 font-medium text-primary" : ""}`}
              >
                {option.label}
              </button>
            )) : <p className="px-2.5 py-3 text-sm text-muted-foreground">No matching {label.toLowerCase()} found.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}