---
name: MongoDB workspace name limit
description: The database-name length constraint for per-user Float ERP workspaces.
---

Workspace database names must stay within MongoDB's 38-byte database-name limit. SubHub workspaces use a sanitized, bounded factory-name slug plus a short user-ID suffix; the full user ID remains in control-plane records.

**Why:** Using the complete UUID in a `float_erp_user_` name made first-run provisioning fail after the control-plane read succeeded, while factory names make workspaces identifiable in MongoDB without sacrificing per-user isolation.

**How to apply:** Keep the ASCII factory slug within the bounded name and retain the unique suffix. Move data when a SubHub name changes, but preserve the current database name when an account simply leaves the SubHub panel; when a managed user is deleted, drop the workspace database.

Changing a SubHub user's panel to Admin or Procurement must not rename or move their workspace database.

**Why:** Those panels do not use the SubHub workspace, and attempting to move it to a legacy per-user name can collide with existing data and block the account update.

**How to apply:** Treat panel access changes and workspace-name changes separately. Only run a workspace move when the destination SubHub name actually changes.