import "./_group.css";
import { AppLayout } from "./_shared/AppLayout";
import { CalendarDays, Download, Search } from "lucide-react";

const hubs = [
  { name: "Factory 1 - Thane", manager: "Pratik" },
  { name: "Unit G10 - Goa", manager: "Sara Fernandes" },
  { name: "Unit G4 - Indore", manager: "Meera Joshi" },
  { name: "Unit G5 - Bengaluru", manager: "Rohan Iyer" },
];

export function Current() {
  return (
    <AppLayout title="HR & Attendance" subtitle="Read-only report of the daily people count for each SubHub." activePage="current">
      <section className="border-b border-border pb-3">
        <h2 className="text-sm font-semibold">Present headcount</h2>
        <p className="mt-1 text-xs text-muted-foreground">One total count for each SubHub and day. Admin can review these records but cannot change them.</p>
      </section>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3 text-xs">
        <span><strong className="tabular">4</strong> SubHubs</span>
        <span><strong className="tabular">0</strong> daily entries</span>
        <span><strong className="tabular">0</strong> people across saved days</span>
        <span><strong className="tabular">0</strong> average per saved day</span>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-b border-border py-3">
        <label className="block text-xs font-medium text-muted-foreground">Show
          <select className="mt-1 block h-9 w-32 rounded-md border border-input bg-white px-2 text-xs text-foreground"><option>One day</option></select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">Date
          <span className="mt-1 flex h-9 w-36 items-center gap-2 rounded-md border border-input bg-white px-2 text-xs text-foreground"><CalendarDays className="size-3.5" />27/09/2026</span>
        </label>
        <button type="button" className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-white px-3 text-xs text-muted-foreground"><Download className="size-3.5" /> Export CSV</button>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-border py-3">
        <label className="min-w-52 flex-1 text-xs font-medium text-muted-foreground">Search
          <span className="relative mt-1 block"><Search className="absolute left-2.5 top-2.5 size-3.5" /><input className="h-9 w-full rounded-md border border-input bg-white pl-8 pr-2 text-xs text-foreground" placeholder="SubHub or manager" /></span>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">SubHub
          <select className="mt-1 block h-9 w-44 rounded-md border border-input bg-white px-2 text-xs text-foreground"><option>All SubHubs</option></select>
        </label>
      </div>
      <p className="border-b border-border py-2.5 text-xs text-muted-foreground">Showing 27 Sep 2026</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2.5">SubHub</th><th className="px-3 py-2.5">Manager</th><th className="px-3 py-2.5 text-center">People present</th></tr></thead>
          <tbody>{hubs.map((hub) => <tr key={hub.name} className="border-b border-border/70"><td className="px-3 py-3 font-medium">{hub.name}</td><td className="px-3 py-3 text-muted-foreground">{hub.manager}</td><td className="px-3 py-3 text-center text-muted-foreground">—</td></tr>)}</tbody>
        </table>
      </div>
    </AppLayout>
  );
}