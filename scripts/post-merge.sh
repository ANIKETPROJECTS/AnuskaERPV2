#!/usr/bin/env bash
set -euo pipefail

# Keep merged workspaces reproducible and verify the production bundle.
npm ci --ignore-scripts --no-audit --no-fund
npm run build