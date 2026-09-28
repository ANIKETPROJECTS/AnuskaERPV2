import { useEffect, useState } from "react";
import { AlertTriangle, Save, Settings2 } from "lucide-react";
import { Tag } from "@/components/erp/bits";
import { num } from "@/lib/erp-data";
import type { HubSummary } from "@/production.server";

type SaveHubCapacity = (
  subhubUserId: string,
  capacityUnits: number | null,
) => Promise<{ ok: true } | { ok: false; message: string }>;

export function HubCapacityRow({
  hub,
  saving,
  onSave,
}: {
  hub: HubSummary;
  saving: boolean;
  onSave: SaveHubCapacity;
}) {
  const [capacityValue, setCapacityValue] = useState(hub.capacityUnits === null ? "" : String(hub.capacityUnits));
  const [validationError, setValidationError] = useState("");
  const capacityLabel = hub.capacityUnits === null ? "No limit" : num(hub.capacityUnits);
  const loadLabel = hub.capacityUnits === null
    ? `${num(hub.openUnits)} open units`
    : `${num(hub.openUnits)} / ${num(hub.capacityUnits)} units`;
  const status = hub.overloaded ? "Overloaded" : hub.capacityUnits === null ? "Unrestricted" : "Within capacity";
  const statusTone = hub.overloaded ? "bad" : hub.capacityUnits === null ? "neutral" : "good";
  const isDirty = capacityValue !== (hub.capacityUnits === null ? "" : String(hub.capacityUnits));

  useEffect(() => {
    setCapacityValue(hub.capacityUnits === null ? "" : String(hub.capacityUnits));
  }, [hub.capacityUnits]);

  async function submitCapacity() {
    const trimmed = capacityValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setValidationError("Enter a whole number greater than zero, or leave blank for no limit.");
      return;
    }
    setValidationError("");
    const result = await onSave(hub.userId, parsed);
    if (!result.ok) setValidationError(result.message);
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-52 flex-1">
        <p className="font-medium">{hub.subhubName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hub.name} · {hub.orderCount} active order{hub.orderCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current load</p>
          <p className="tabular mt-1 font-semibold">{loadLabel}</p>
        </div>
        <Tag tone={statusTone}>{status}</Tag>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitCapacity();
        }}
        className="flex flex-col items-start gap-1"
      >
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
          <Settings2 className="size-4 text-muted-foreground" />
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">Declared capacity</span>
            <input
              type="number"
              min="1"
              step="1"
              value={capacityValue}
              onChange={(event) => setCapacityValue(event.target.value)}
              placeholder="No limit"
              aria-label={`Declared capacity for ${hub.subhubName}`}
              className="h-8 w-28 rounded-md border border-input bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={!isDirty || saving}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="size-3.5" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="pl-8 text-[11px] text-muted-foreground">
          Blank means no limit{!isDirty && capacityValue === "" ? "" : ` · Current: ${capacityLabel}`}
        </p>
        {validationError ? <p className="pl-8 text-xs text-destructive">{validationError}</p> : null}
      </form>
      {hub.overloaded ? <AlertTriangle className="size-5 text-destructive" aria-label="Hub is overloaded" /> : null}
    </div>
  );
}