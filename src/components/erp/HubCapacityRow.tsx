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
    <tr className="hover:bg-muted/20">
      <th scope="row" className="px-4 py-4 text-left font-normal">
        <p className="font-medium">{hub.subhubName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hub.name} · {hub.orderCount} active order{hub.orderCount === 1 ? "" : "s"}
        </p>
      </th>
      <td className="tabular whitespace-nowrap px-4 py-4 text-right font-semibold">{loadLabel}</td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Tag tone={statusTone}>{status}</Tag>
          {hub.overloaded ? <AlertTriangle className="size-4 text-destructive" aria-label="Hub is overloaded" /> : null}
        </div>
      </td>
      <td className="px-4 py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitCapacity();
          }}
          className="min-w-64"
        >
          <div className="flex items-center gap-2">
            <label htmlFor={`capacity-${hub.userId}`} className="sr-only">
              Declared capacity for {hub.subhubName}
            </label>
            <div className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5">
              <Settings2 className="size-4 shrink-0 text-muted-foreground" />
              <input
                id={`capacity-${hub.userId}`}
                type="number"
                min="1"
                step="1"
                value={capacityValue}
                onChange={(event) => setCapacityValue(event.target.value)}
                placeholder="No limit"
                className="tabular h-8 min-w-0 w-24 bg-transparent px-1 text-right text-sm font-semibold outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!isDirty || saving}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="size-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Blank means no limit{!isDirty && capacityValue === "" ? "" : ` · Current: ${capacityLabel}`}
          </p>
          {validationError ? <p className="mt-1 text-xs text-destructive">{validationError}</p> : null}
        </form>
      </td>
    </tr>
  );
}