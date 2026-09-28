import { useEffect, useState } from "react";
import { Save } from "lucide-react";
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
  const status = hub.overloaded ? "Overloaded" : hub.capacityUnits === null ? "Unrestricted" : "Within capacity";
  const statusClass = hub.overloaded
    ? "bg-destructive text-white"
    : hub.capacityUnits === null
      ? "bg-slate-600 text-white"
      : "bg-success text-white";
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
      <th scope="row" className="px-2 py-4 text-left text-base font-semibold">
        {hub.subhubName}
      </th>
      <td className="px-2 py-4 text-base">{hub.name || "—"}</td>
      <td className="tabular whitespace-nowrap px-2 py-4 text-center text-base font-semibold">{num(hub.orderCount)}</td>
      <td className="tabular px-2 py-4 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-lg font-semibold">{num(hub.openUnits)}</span>
          <span className="text-sm text-muted-foreground">open units</span>
        </div>
      </td>
      <td className="px-2 py-4">
        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[13px] font-semibold ${statusClass}`}>
          {status}
        </span>
      </td>
      <td className="px-2 py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitCapacity();
          }}
          className="min-w-[160px]"
        >
          <div className="flex items-center gap-1.5">
            <label htmlFor={`capacity-${hub.userId}`} className="sr-only">
              Declared capacity for {hub.subhubName}
            </label>
            <div className="flex h-10 min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2">
              <input
                id={`capacity-${hub.userId}`}
                type="number"
                min="1"
                step="1"
                value={capacityValue}
                onChange={(event) => setCapacityValue(event.target.value)}
                placeholder="No limit"
                className="tabular h-8 min-w-0 w-20 bg-transparent px-1 text-right text-base font-semibold outline-none"
              />
              {capacityValue.trim() ? <span className="shrink-0 text-sm text-muted-foreground">units</span> : null}
            </div>
            <button
              type="submit"
              disabled={!isDirty || saving}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="size-4" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Blank means no limit
          </p>
          {validationError ? <p className="mt-1 text-sm text-destructive">{validationError}</p> : null}
        </form>
      </td>
    </tr>
  );
}