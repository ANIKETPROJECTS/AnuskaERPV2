import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Database, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Panel } from "@/components/erp/bits";
import { deleteRawMaterial, useRawMaterials, updateRawMaterial, addRawMaterial, type RawMaterial } from "@/lib/raw-material-store";
type RawMaterialSort = "code-asc" | "code-desc" | "name-asc" | "name-desc" | "material-asc" | "source-asc";
type SourceFilter = "all" | RawMaterial["source"];
type PageSize = 10 | 25 | 50 | "all";

export const Route = createFileRoute("/raw-materials")({
  head: () => ({ meta: [{ title: "Raw Materials — Float ERP" }] }),
  component: RawMaterials,
});

function RawMaterials() {
  return <RawMaterialsPage readOnly={false} />;
}

export function RawMaterialsPage({ readOnly }: { readOnly: boolean }) {
  const materials = useRawMaterials();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<RawMaterialSort>("code-asc");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreator, setShowCreator] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const materialOptions = useMemo(
    () => [...new Set(materials.map((item) => item.material))].sort((left, right) => left.localeCompare(right)),
    [materials],
  );
  const filteredMaterials = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase();
      const filtered = materials.filter((item) => {
        const matchesQuery = `${item.code} ${item.name} ${item.description} ${item.material} ${item.source}`.toLowerCase().includes(normalizedQuery);
        return matchesQuery && (sourceFilter === "all" || item.source === sourceFilter) && (materialFilter === "all" || item.material === materialFilter);
      });
      return filtered.sort((left, right) => {
        if (sortBy === "code-asc") return left.code.localeCompare(right.code);
        if (sortBy === "code-desc") return right.code.localeCompare(left.code);
        if (sortBy === "name-asc") return left.name.localeCompare(right.name);
        if (sortBy === "name-desc") return right.name.localeCompare(left.name);
        if (sortBy === "material-asc") return left.material.localeCompare(right.material) || left.name.localeCompare(right.name);
        return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
      });
    },
    [materialFilter, materials, query, sortBy, sourceFilter],
  );
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredMaterials.length / pageSize));
  const paginatedMaterials = pageSize === "all"
    ? filteredMaterials
    : filteredMaterials.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [materialFilter, pageSize, query, sortBy, sourceFilter]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  function clearCatalogFilters() {
    setQuery("");
    setSortBy("code-asc");
    setSourceFilter("all");
    setMaterialFilter("all");
  }

  function openCreate() {
    setEditingMaterial(null);
    setShowCreator(true);
  }

  function openEdit(item: RawMaterial) {
    setEditingMaterial(item);
    setShowCreator(true);
  }

  function removeMaterial(item: RawMaterial) {
    if (!window.confirm(`Delete ${item.name} (${item.code})? This will remove it from the raw-material catalog.`)) return;
    deleteRawMaterial(item.code);
  }

  function saveMaterial(item: RawMaterial) {
    if (editingMaterial) updateRawMaterial(editingMaterial.code, item);
    else addRawMaterial(item);
    setShowCreator(false);
    setEditingMaterial(null);
  }

  return (
    readOnly ? (
      <SubHubShell title="Raw Materials" subtitle="View-only central raw-part catalog">
        <RawMaterialsContent
          materials={materials}
          filteredMaterials={paginatedMaterials}
          totalFiltered={filteredMaterials.length}
          query={query}
          onQueryChange={setQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          materialFilter={materialFilter}
          materialOptions={materialOptions}
          onMaterialFilterChange={setMaterialFilter}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          pageCount={pageCount}
          onPageChange={setCurrentPage}
          onClearFilters={clearCatalogFilters}
          readOnly
        />
      </SubHubShell>
    ) : (
      <Shell
        title="Raw Materials"
        subtitle="Admin Panel · central raw-part catalog"
        actions={
          <button type="button" onClick={openCreate} className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
            <Plus className="size-4" /> New raw material
          </button>
        }
      >
        <RawMaterialsContent
          materials={materials}
          filteredMaterials={paginatedMaterials}
          totalFiltered={filteredMaterials.length}
          query={query}
          onQueryChange={setQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          materialFilter={materialFilter}
          materialOptions={materialOptions}
          onMaterialFilterChange={setMaterialFilter}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          pageCount={pageCount}
          onPageChange={setCurrentPage}
          onClearFilters={clearCatalogFilters}
          onEdit={openEdit}
          onDelete={removeMaterial}
        />
        {showCreator ? (
          <RawMaterialDrawer
            initial={editingMaterial}
            editing={Boolean(editingMaterial)}
            onClose={() => {
              setShowCreator(false);
              setEditingMaterial(null);
            }}
            onSave={saveMaterial}
          />
        ) : null}
      </Shell>
    )
  );
}

function RawMaterialsContent({
  materials,
  filteredMaterials,
  totalFiltered,
  query,
  onQueryChange,
  sortBy,
  onSortChange,
  sourceFilter,
  onSourceFilterChange,
  materialFilter,
  materialOptions,
  onMaterialFilterChange,
  pageSize,
  onPageSizeChange,
  currentPage,
  pageCount,
  onPageChange,
  onClearFilters,
  readOnly = false,
  onEdit,
  onDelete,
}: {
  materials: RawMaterial[];
  filteredMaterials: RawMaterial[];
  totalFiltered: number;
  query: string;
  onQueryChange: (value: string) => void;
  sortBy: RawMaterialSort;
  onSortChange: (value: RawMaterialSort) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (value: SourceFilter) => void;
  materialFilter: string;
  materialOptions: string[];
  onMaterialFilterChange: (value: string) => void;
  pageSize: PageSize;
  onPageSizeChange: (value: PageSize) => void;
  currentPage: number;
  pageCount: number;
  onPageChange: (value: number) => void;
  onClearFilters: () => void;
  readOnly?: boolean;
  onEdit?: (item: RawMaterial) => void;
  onDelete?: (item: RawMaterial) => void;
}) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{materials.length} raw materials</p>
          <p className="mt-1 text-xs text-muted-foreground">{readOnly ? "View-only access for this SubHub." : "Master data is maintained in the Admin Panel."}</p>
        </div>
        <label className="relative block w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search raw materials" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
      </div>
      <div className="filter-toolbar rounded-lg border border-border bg-card p-3">
        <label className="text-xs font-medium">
          Sort by
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value as RawMaterialSort)} className="mt-1.5 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
            <option value="code-asc">Code A–Z</option>
            <option value="code-desc">Code Z–A</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="material-asc">Material A–Z</option>
            <option value="source-asc">Source</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          Filter source
          <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)} className="mt-1.5 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
            <option value="all">All sources</option>
            <option value="Molded">Molded</option>
            <option value="Purchased">Purchased</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          Filter material
          <select value={materialFilter} onChange={(event) => onMaterialFilterChange(event.target.value)} className="mt-1.5 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
            <option value="all">All materials</option>
            {materialOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button type="button" onClick={onClearFilters} className="h-9 rounded-md border border-input px-3 text-xs font-medium text-muted-foreground hover:bg-muted">Clear filters</button>
        <label className="ml-auto text-xs font-medium">
          Rows per page
          <select value={pageSize} onChange={(event) => onPageSizeChange(event.target.value === "all" ? "all" : Number(event.target.value) as PageSize)} className="ml-2 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
      <Panel title="Raw material catalog" description="Costing inputs and component records used by product structures">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Material</th>
                <th className="px-5 py-3 font-medium">Source</th>
                {!readOnly ? <th className="px-5 py-3 text-right font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => (
                <tr key={item.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                  <td className="tabular px-5 py-4 font-medium">{item.code}</td>
                  <td className="px-5 py-4 font-medium">{item.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{item.description}</td>
                  <td className="px-5 py-4 text-muted-foreground">{item.material}</td>
                  <td className="px-5 py-4 text-muted-foreground">{item.source}</td>
                  {!readOnly ? (
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => onEdit?.(item)} aria-label={`Edit ${item.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => onDelete?.(item)} aria-label={`Delete ${item.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!filteredMaterials.length ? <tr><td colSpan={readOnly ? 5 : 6} className="px-5 py-12 text-center text-sm text-muted-foreground">No raw materials found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {totalFiltered === 0 ? "Showing 0 records" : `Showing ${(currentPage - 1) * (pageSize === "all" ? totalFiltered : pageSize) + 1}–${Math.min(currentPage * (pageSize === "all" ? totalFiltered : pageSize), totalFiltered)} of ${totalFiltered} matching records`}
          </p>
          {pageSize !== "all" && pageCount > 1 ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button key={page} type="button" onClick={() => onPageChange(page)} aria-current={page === currentPage ? "page" : undefined} className={`min-w-8 rounded-md border px-2 py-1.5 text-xs font-medium ${page === currentPage ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted"}`}>
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function RawMaterialDrawer({
  initial,
  editing,
  onClose,
  onSave,
}: {
  initial: RawMaterial | null;
  editing: boolean;
  onClose: () => void;
  onSave: (item: RawMaterial) => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [source, setSource] = useState<RawMaterial["source"]>(initial?.source ?? "Other");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ code: code.trim().toUpperCase(), name: name.trim(), description: description.trim(), material: material.trim(), source });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-labelledby="raw-material-title">
      <form onSubmit={submit} className="flex h-full w-full max-w-md flex-col border-l border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary"><Database className="size-4" /><span className="text-xs font-semibold uppercase tracking-wide">Admin Panel</span></div>
            <h2 id="raw-material-title" className="mt-2 text-lg font-semibold">{editing ? "Edit raw material" : "New raw material"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{editing ? "Update this material in the shared raw-material catalog." : "Add a material to the shared raw-material catalog."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </div>
        <label className="mt-6 block text-sm font-medium">Code<input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="GP006-050" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-sm font-medium">Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Raw part name" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-sm font-medium">Description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the raw material or part" rows={4} className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-sm font-medium">Material<input required value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Nylon 66" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-sm font-medium">Source<select value={source} onChange={(event) => setSource(event.target.value as RawMaterial["source"])} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 font-normal outline-none focus:border-primary"><option value="Molded">Molded</option><option value="Purchased">Purchased</option><option value="Other">Other</option></select></label>
        <div className="mt-auto flex justify-end gap-3 pt-8"><button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" className="rule-header rounded-md px-4 py-2 text-sm font-medium">{editing ? "Save changes" : "Add raw material"}</button></div>
      </form>
    </div>
  );
}