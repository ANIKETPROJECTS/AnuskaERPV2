---
name: HR headcount scope
description: Product decision governing SubHub daily attendance records.
---

HR & Attendance records one aggregate total present headcount per SubHub per India-local day. A manager may correct today's saved count; earlier dates remain locked. Corrections update the daily record and append an audit entry with the old and new totals and the acting manager.

**Why:** The user later clarified that today's saved count may be corrected, but did not authorize editing historical dates.

**How to apply:** Keep the first-save flow separate from today's correction flow. Derive the editable date on the server, allow updates only for India-local today, and store each actual correction atomically with its audit entry. Keep past-date history read-only and do not add employee rosters, shifts, or individual statuses.