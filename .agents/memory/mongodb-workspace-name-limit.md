---
name: MongoDB workspace name limit
description: The database-name length constraint for per-user Float ERP workspaces.
---

Workspace database names must stay within MongoDB's 38-byte database-name limit. The full generated user ID should remain in control-plane records, while the database name uses a bounded suffix under the required workspace prefix.

**Why:** Using the complete UUID in a `float_erp_user_` name made first-run provisioning fail after the control-plane read succeeded.

**How to apply:** When changing workspace naming, preserve the bounded-name rule and ensure the full user ID remains the authoritative account identifier.