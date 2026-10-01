import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerHeadcountDataFn, saveManagerHeadcountFn, updateManagerHeadcountFn } from "@/hr";
import type { ManagerHeadcountData } from "@/hr.server";

export const Route = createFileRoute("/subhub/hr")({
  head: () => ({ meta: [{ title: "HR & Attendance — SubHub · Gadsons ERP" }] }),
  component: SubhubHr,
});

const emptyData: ManagerHeadcountData = {
  subhubName: "",
  subhubManagerName: "",
  date: "",
  presentCount: null,
  recentRecords: [],
};

function currentDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function SubhubHr() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/subhub/hr") return <Outlet />;
  return <SubhubHrPage />;
}

function SubhubHrPage() {
  const [data, setData] = useState<ManagerHeadcountData>(emptyData);
  const [countInput, setCountInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSlow, setSavingSlow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const today = data.date || currentDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerHeadcountDataFn();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setData(result.data);
    } catch {
      setError("Today’s count could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!saving) {
      setSavingSlow(false);
      return;
    }

    setSavingSlow(false);
    const timeout = window.setTimeout(() => setSavingSlow(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [saving]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const presentCount = Number(countInput);
    if (!/^[1-9]\d*$/.test(countInput) || !Number.isSafeInteger(presentCount)) {
      setError("Enter a positive whole number of people.");
      return;
    }

    setSaving(true);
    try {
      const result = editing
        ? await updateManagerHeadcountFn({ data: { presentCount } })
        : await saveManagerHeadcountFn({ data: { presentCount } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setData((current) => ({
        ...current,
        presentCount: result.record.presentCount,
        recentRecords: [
          result.record,
          ...current.recentRecords.filter((record) => record.date !== result.record.date),
        ],
      }));
      setCountInput("");
      setEditing(false);
      setNotice(
        editing && "changed" in result && !result.changed
          ? `No change was made; today’s count is already ${result.record.presentCount}.`
          : editing
            ? "Today’s attendance was updated."
            : "Today’s attendance was recorded.",
      );
    } catch {
      setError("Today’s count could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    if (data.presentCount === null) return;
    setCountInput(String(data.presentCount));
    setEditing(true);
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setCountInput("");
    setEditing(false);
    setError("");
    setNotice("");
  }

  return (
    <SubHubShell
      headerTitle="HR & Attendance"
      actions={
        <Link
          to="/subhub/hr/history"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-white px-4 text-base font-medium hover:bg-muted"
        >
          View history <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      }
    >
      <section className="space-y-4 px-6 pb-6">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-base text-destructive"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-base text-success"
          >
            {notice}
          </p>
        ) : null}
        {savingSlow ? (
          <p role="status" className="rounded-md border border-border bg-muted/40 px-4 py-3 text-base">
            Attendance is still being recorded. Please wait and don’t submit it again.
          </p>
        ) : null}

        <section className="min-w-0">
          <header className="border-b border-border py-4">
            <h2 className="text-lg font-semibold">Today’s people count</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Enter the total number of people present in {data.subhubName || "your SubHub"} today.
            </p>
          </header>

          {data.presentCount === null || editing ? (
            <form
              onSubmit={(event) => void save(event)}
              className="space-y-5 border-b border-border py-5"
            >
              <label className="block max-w-sm text-base font-medium">
                People present today
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={countInput}
                  onChange={(event) => setCountInput(event.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 24"
                  disabled={loading || saving}
                  className="mt-1.5 h-12 w-full rounded-md border border-input bg-white px-4 text-lg font-semibold tabular outline-none focus:border-primary disabled:opacity-60"
                  aria-describedby="headcount-help"
                />
              </label>
              <p id="headcount-help" className="text-base text-muted-foreground">
                {editing
                  ? "Correct today’s total. Earlier dates remain locked."
                  : "Enter today’s total. You can correct it later today; earlier dates remain locked."}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading || saving}
                  className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {saving
                    ? editing
                      ? "Saving correction…"
                      : "Recording…"
                    : editing
                      ? "Save correction"
                      : "Record today’s attendance"}
                </button>
                {editing ? (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex min-h-12 items-center rounded-md border border-input bg-white px-5 text-base font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="border-b border-border py-5">
              <h3 className="text-base font-semibold">Today’s attendance</h3>
              <p className="mt-2 text-2xl font-semibold tabular">
                {data.presentCount} people present
              </p>
              <p className="mt-1 text-base text-muted-foreground">
                Registered by{" "}
                {data.recentRecords.find((record) => record.date === today)?.recordedByName ||
                  data.subhubManagerName ||
                  "the SubHub manager"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(today)}</p>
              <button
                type="button"
                onClick={startEditing}
                disabled={loading || saving}
                className="mt-4 inline-flex min-h-10 items-center rounded-md border border-input bg-white px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                Edit today’s count
              </button>
            </div>
          )}
        </section>
      </section>
    </SubHubShell>
  );
}
