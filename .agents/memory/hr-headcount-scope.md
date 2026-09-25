---
name: HR headcount scope
description: Product decision governing SubHub daily attendance records.
---

HR & Attendance records one immutable total present headcount per SubHub per day. The first save locks that day; do not reintroduce edit flows or employee-level attendance entry.

**Why:** The user explicitly stated that once a day's attendance is recorded it cannot be changed.

**How to apply:** Hide the entry form after the first save and reject duplicate submissions on the server. History is read-only and date-selected; do not show a change-log section or add employee rosters, shifts, or individual statuses.