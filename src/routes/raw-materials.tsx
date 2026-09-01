import { createFileRoute } from "@tanstack/react-router";
import { Database, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Shell } from "@/components/erp/Shell";
import { Panel } from "@/components/erp/bits";
import { subparts } from "@/lib/erp-data";

type RawMaterial = {
  code: string;
  name: string;
  description: string;
  material: string;
};

const seededMaterials: RawMaterial[] = subparts.map((part) => ({
  code: part.code,
  name: part.name,
  description: `${part.source} raw part used in parent-product BOM assemblies.`,
  material: part.material,
}));

export const Route = createFileRoute("/raw-materials")({
  head: () => ({ meta: [{ title: "Raw Materials — Float ERP" }] }),
  component: RawMaterials,
});

function RawMaterials() {
  const [materials, setMaterials] = useState<RawMaterial[]>(seededMaterials);
  const [query, setQuery] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const filteredMaterials = useMemo(
    () => materials.filter((item) => `${item.code} ${item.name} ${item.description} ${item.material}`.toLowerCase().includes(query.toLowerCase())),
    [materials, query],
  );

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
    setMaterials((current) => current.filter((material) => material.code !== item.code));
  }

  function saveMaterial(item: RawMaterial) {
    setMaterials((current) =>
      editingMaterial
        ? current.map((material) => (material.code === editingMaterial.code ? item : material))
        : [...current, item],
    );
    setShowCreator(false);
    setEditingMaterial(null);
  }

  return (
    <Shell
      title="Raw Materials"
      subtitle="Admin Panel · central raw-part catalog"
      actions={
        <button type="button" onClick={openCreate} className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
          <Plus className="size-4" /> New raw material
        </button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{materials.length} raw materials</p>
          <p className="mt-1 text-xs text-muted-foreground">Master data is maintained in the Admin Panel.</p>
        </div>
        <label className="relative block w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search raw materials" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
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
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => (
                <tr key={item.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                  <td className="tabular px-5 py-4 font-medium">{item.code}</td>
                  <td className="px-5 py-4 font-medium">{item.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{item.description}</td>
                  <td className="px-5 py-4 text-muted-foreground">{item.material}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => removeMaterial(item)} aria-label={`Delete ${item.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredMaterials.length ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">No raw materials found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ code: code.trim().toUpperCase(), name: name.trim(), description: description.trim(), material: material.trim() });
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
        <div className="mt-auto flex justify-end gap-3 pt-8"><button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" className="rule-header rounded-md px-4 py-2 text-sm font-medium">{editing ? "Save changes" : "Add raw material"}</button></div>
      </form>
    </div>
  );
}