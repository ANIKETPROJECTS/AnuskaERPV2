---
name: MongoDB workspace name limit
description: The database-name length constraint for per-user Float ERP workspaces.
---

Workspace database names must stay within MongoDB's 38-byte database-name limit. SubHub workspaces use a sanitized, bounded factory-name slug plus a short user-ID suffix; the full user ID remains in control-plane records.

**Why:** Using the complete UUID in a `float_erp_user_` name made first-run provisioning fail after the control-plane read succeeded, while factory names make workspaces identifiable in MongoDB without sacrificing per-user isolation.

**How to apply:** Keep the ASCII factory slug within the bounded name and retain the unique suffix. When a SubHub name changes, move the workspace data before updating its control record; when a managed user is deleted, drop the workspace database.