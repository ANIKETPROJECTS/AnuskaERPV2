---
name: Panel-isolated sessions
description: Admin and SubHub identities must remain independent when used in the same browser.
---

Admin, SubHub, and Procurement each have their own server-side session cookie, and every server operation must explicitly authenticate against the expected panel. Route-level auth selects the matching panel session, while the legacy single-cookie session is only migrated when its user belongs to the requested panel.

**Why:** A single shared session cookie allowed logging into one panel to replace the identity shown in the other panel and risked reading the wrong workspace.

**How to apply:** Preserve separate cookies for all panels, pass the expected panel through route loaders and server-function authorization, and make logout clear only the selected panel session.

Account deactivation, reactivation, password replacement, and panel reassignment must revoke existing sessions so a later reactivation cannot revive a stale token.

**Why:** Checking only the account's active flag blocks a token while the account is inactive, but would make that same token usable again after reactivation.

**How to apply:** When changing status, credentials, or panel, delete the account's server-side session records; require a fresh sign-in after reactivation or panel changes.