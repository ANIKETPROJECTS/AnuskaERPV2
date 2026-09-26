import { createFileRoute } from "@tanstack/react-router";
import { Database, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Shell } from "@/components/erp/Shell";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { TablePagination } from "@/components/erp/TablePagination";
import { Tag } from "@/components/erp/bits";
import { deleteRawMaterial, useRawMaterials, updateRawMaterial, addRawMaterial, type RawMaterial } from "@/lib/raw-material-store";
import { useBomProducts } from "@/lib/bom-store";
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
  const products = useBomProducts();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<RawMaterialSort>("code-asc");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreator, setShowCreator] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [materialError, setMaterialError] = useState("");
  const materialOptions = useMemo(
    () => [...new Set(materials.map((item) => item.material))].sort((left, right) => left.localeCompare(right)),
    [materials],
  );
  const bomMaterialCodes = useMemo(
    () => new Set(products.flatMap((product) => product.variants.flatMap((variant) => Object.keys(variant.parts)))),
    [products],
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
    setMaterialError("");
    setShowCreator(true);
  }

  function openEdit(item: RawMaterial) {
    setEditingMaterial(item);
    setMaterialError("");
    setShowCreator(true);
  }

  function removeMaterial(item: RawMaterial) {
    if (bomMaterialCodes.has(item.code)) {
      window.alert("This raw material is still used by a BOM variant. Remove it from the BOM before deleting it.");
      return;
    }
    if (!window.confirm(`Delete ${item.name} (${item.code})? This will remove it from the raw-material catalog.`)) return;
    deleteRawMaterial(item.code);
  }

  function saveMaterial(item: RawMaterial) {
    const duplicateCode = materials.some(
      (material) => material.code.toLowerCase() === item.code.toLowerCase() && material.code !== editingMaterial?.code,
    );
    if (duplicateCode) {
      setMaterialError("A raw material with that code already exists.");
      return;
    }
    if (editingMaterial && bomMaterialCodes.has(editingMaterial.code) && item.code !== editingMaterial.code) {
      setMaterialError("This code is used in a BOM and cannot be changed.");
      return;
    }
    if (editingMaterial) updateRawMaterial(editingMaterial.code, item);
    else if (!addRawMaterial(item)) {
      setMaterialError("A raw material with that code already exists.");
      return;
    }
    setShowCreator(false);
    setEditingMaterial(null);
    setMaterialError("");
  }

  return (
    readOnly ? (
      <SubHubShell headerTitle="Raw Materials">
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
        mainClassName="flex-1 space-y-0 p-0"
        actions={
          <button type="button" onClick={openCreate} className="rule-header inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-base font-medium">
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
          adminStyle
          onEdit={openEdit}
          onDelete={removeMaterial}
        />
        {showCreator ? (
          <RawMaterialDrawer
            initial={editingMaterial}
            editing={Boolean(editingMaterial)}
            error={materialError}
            codeLocked={Boolean(editingMaterial && bomMaterialCodes.has(editingMaterial.code))}
            onClose={() => {
              setShowCreator(false);
              setEditingMaterial(null);
              setMaterialError("");
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
  adminStyle = false,
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
  adminStyle?: boolean;
  onEdit?: (item: RawMaterial) => void;
  onDelete?: (item: RawMaterial) => void;
}) {
  if (readOnly || adminStyle) {
    return (
      <section className="space-y-5 px-6 py-5">
        <label className="block w-full text-base font-medium text-muted-foreground">
          Search
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search raw materials"
              aria-label="Search raw materials"
              className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-base font-normal text-foreground outline-none focus:border-primary"
            />
          </span>
        </label>
        <div className="overflow-x-auto border-y border-border">
          <table className={`w-full table-fixed text-base ${adminStyle ? "min-w-[1120px]" : "min-w-[900px]"}`}>
            <caption className="sr-only">Raw materials</caption>
            <colgroup>
              <col className={adminStyle ? "w-[13%]" : "w-[15%]"} />
              <col className={adminStyle ? "w-[18%]" : "w-[22%]"} />
              <col className={adminStyle ? "w-[28%]" : "w-[31%]"} />
              <col className={adminStyle ? "w-[16%]" : "w-[18%]"} />
              <col className={adminStyle ? "w-[12%]" : "w-[14%]"} />
              {adminStyle ? <col className="w-[13%]" /> : null}
            </colgroup>
            <thead className="border-b border-border text-left text-sm uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Code
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Description
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Material
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Source
                </th>
                {adminStyle ? <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => (
                <tr
                  key={item.code}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/40"
                >
                  <th
                    scope="row"
                    className="tabular whitespace-nowrap px-4 py-4 text-left font-semibold"
                  >
                    {item.code}
                  </th>
                  <td className="px-4 py-4 font-semibold">{item.name}</td>
                  <td className="px-4 py-4 leading-6 text-muted-foreground">{item.description}</td>
                  <td className="px-4 py-4 text-muted-foreground">{item.material}</td>
                  <td className="px-4 py-4">
                    <Tag tone={item.source === "Molded" ? "info" : "neutral"} size="md">
                      {item.source}
                    </Tag>
                  </td>
                  {adminStyle ? (
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => onEdit?.(item)} aria-label={`Edit ${item.name}`} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-input px-2 text-sm font-medium hover:bg-muted">
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button type="button" onClick={() => onDelete?.(item)} aria-label={`Delete ${item.name}`} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-destructive/30 px-2 text-sm font-medium text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!filteredMaterials.length ? (
                <tr>
                  <td
                    colSpan={adminStyle ? 6 : 5}
                    className="px-4 py-12 text-center text-base text-muted-foreground"
                  >
                    No raw materials match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={totalFiltered}
          page={currentPage}
          pageSize={pageSize === "all" ? Math.max(totalFiltered, 1) : pageSize}
          showPageSizeSelect={false}
          onPageChange={onPageChange}
          onPageSizeChange={() => undefined}
          size="md"
        />
      </section>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">{materials.length} raw materials</p>
          <p className="mt-1 text-sm text-muted-foreground">{readOnly ? "View-only access for this SubHub." : "Master data is maintained in the Admin Panel."}</p>
        </div>
        <label className="relative block w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search raw materials" aria-label="Search raw materials" className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
      </div>
      <div className="filter-toolbar rounded-lg border border-border bg-card p-4">
        <label className="text-sm font-medium">
          Sort by
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value as RawMaterialSort)} className="mt-1.5 h-11 rounded-md border border-input bg-white px-3 text-base font-normal">
            <option value="code-asc">Code A–Z</option>
            <option value="code-desc">Code Z–A</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="material-asc">Material A–Z</option>
            <option value="source-asc">Source</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Filter source
          <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)} className="mt-1.5 h-11 rounded-md border border-input bg-white px-3 text-base font-normal">
            <option value="all">All sources</option>
            <option value="Molded">Molded</option>
            <option value="Purchased">Purchased</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Filter material
          <select value={materialFilter} onChange={(event) => onMaterialFilterChange(event.target.value)} className="mt-1.5 h-11 rounded-md border border-input bg-white px-3 text-base font-normal">
            <option value="all">All materials</option>
            {materialOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button type="button" onClick={onClearFilters} className="h-11 rounded-md border border-input px-4 text-sm font-medium text-muted-foreground hover:bg-muted">Clear filters</button>
      </div>
      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Raw material catalog</h2>
            <p className="mt-1 text-sm text-muted-foreground">Costing inputs and component records used by product structures</p>
          </div>
          <p className="text-sm text-muted-foreground">{totalFiltered} matching {totalFiltered === 1 ? "material" : "materials"}</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-base">
            <caption className="sr-only">Raw material catalog</caption>
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[19%]" />
              <col className="w-[28%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              {!readOnly ? <col className="w-[14%]" /> : null}
            </colgroup>
            <thead className="border-b border-border bg-muted/20 text-left text-sm uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Code</th>
                <th scope="col" className="px-6 py-4 font-medium">Name</th>
                <th scope="col" className="px-6 py-4 font-medium">Description</th>
                <th scope="col" className="px-6 py-4 font-medium">Material</th>
                <th scope="col" className="px-6 py-4 font-medium">Source</th>
                {!readOnly ? <th scope="col" className="px-6 py-4 text-right font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => (
                <tr key={item.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                  <th scope="row" className="tabular px-6 py-4 text-left text-sm font-semibold">{item.code}</th>
                  <td className="px-6 py-4 font-semibold">{item.name}</td>
                  <td className="px-6 py-4 text-sm leading-6 text-muted-foreground">{item.description}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{item.material}</td>
                  <td className="px-6 py-4"><Tag tone={item.source === "Molded" ? "info" : "neutral"} size="md">{item.source}</Tag></td>
                  {!readOnly ? (
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => onEdit?.(item)} aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-input px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="size-4" /> Edit
                        </button>
                        <button type="button" onClick={() => onDelete?.(item)} aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-input px-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-4" /> Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!filteredMaterials.length ? <tr><td colSpan={readOnly ? 5 : 6} className="px-6 py-14 text-center text-base text-muted-foreground">No raw materials found. Try changing your search or filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {totalFiltered === 0
              ? "Showing 0 matching records"
              : `Showing ${(currentPage - 1) * (pageSize === "all" ? totalFiltered : pageSize) + 1}–${Math.min(currentPage * (pageSize === "all" ? totalFiltered : pageSize), totalFiltered)} of ${totalFiltered} matching records`}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              Rows per page
              <select value={pageSize} onChange={(event) => onPageSizeChange(event.target.value === "all" ? "all" : Number(event.target.value) as PageSize)} className="h-11 rounded-md border border-input bg-background px-3 text-base text-foreground">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </label>
            {pageSize !== "all" ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Page <strong className="text-foreground">{currentPage}</strong> of <strong className="text-foreground">{pageCount}</strong></span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} aria-label="Previous page" className="inline-flex size-11 items-center justify-center rounded-md border border-input bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                    <ChevronLeft className="size-4" />
                  </button>
                  <button type="button" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} aria-label="Next page" className="inline-flex size-11 items-center justify-center rounded-md border border-input bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}

function RawMaterialDrawer({
  initial,
  editing,
  error,
  codeLocked,
  onClose,
  onSave,
}: {
  initial: RawMaterial | null;
  editing: boolean;
  error: string;
  codeLocked: boolean;
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
      <form onSubmit={submit} className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary"><Database className="size-4" /><span className="text-xs font-semibold uppercase tracking-wide">Admin Panel</span></div>
            <h2 id="raw-material-title" className="mt-2 text-xl font-semibold">{editing ? "Edit raw material" : "New raw material"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{editing ? "Update this material in the shared raw-material catalog." : "Add a material to the shared raw-material catalog."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </div>
        <label className="mt-6 block text-base font-medium">Code<input required disabled={codeLocked} value={code} onChange={(event) => setCode(event.target.value)} placeholder="GP006-050" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted" /></label>
        {codeLocked ? <p className="-mt-3 text-sm text-muted-foreground">This code is referenced by a BOM and cannot be changed.</p> : null}
        <label className="mt-4 block text-base font-medium">Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Raw part name" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-base font-medium">Description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the raw material or part" rows={4} className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-base font-medium">Material<input required value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Nylon 66" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary" /></label>
        <label className="mt-4 block text-base font-medium">Source<select value={source} onChange={(event) => setSource(event.target.value as RawMaterial["source"])} className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary"><option value="Molded">Molded</option><option value="Purchased">Purchased</option><option value="Other">Other</option></select></label>
        {error ? <p role="alert" className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-auto flex justify-end gap-3 pt-8"><button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-md border border-input px-4 py-2 text-base font-medium">Cancel</button><button type="submit" className="rule-header inline-flex min-h-11 items-center rounded-md px-4 py-2 text-base font-medium">{editing ? "Save changes" : "Add raw material"}</button></div>
      </form>
    </div>
  );
}