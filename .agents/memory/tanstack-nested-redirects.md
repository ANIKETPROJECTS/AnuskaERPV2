---
name: Nested route redirects
description: Avoid redirect loops when a TanStack file route has child pages.
---

A parent route's `beforeLoad` runs for its nested child routes as well. When keeping a legacy parent URL as a redirect alias, check the exact current pathname before redirecting; otherwise every child path inherits the redirect and can loop.

**Why:** The procurement management page was split into nested routes, and its unqualified parent redirect repeatedly sent each child route back to the parent.

**How to apply:** In a parent `beforeLoad`, redirect only when `location.pathname` matches the legacy parent URL. Let nested pathnames continue to their own loaders and components.