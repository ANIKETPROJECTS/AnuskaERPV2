---
name: Panel-isolated sessions
description: Admin and SubHub identities must remain independent when used in the same browser.
---

Each panel has its own server-side session cookie and server operation must explicitly authenticate against the expected panel. Route-level auth selects the matching panel session, while the legacy single-cookie session is only migrated when its user belongs to the requested panel.

**Why:** A single shared session cookie allowed logging into one panel to replace the identity shown in the other panel and risked reading the wrong workspace.

**How to apply:** Preserve separate Admin and SubHub cookies, pass the expected panel through auth checks, and make logout clear only the selected panel session.