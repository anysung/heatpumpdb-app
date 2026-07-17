#!/usr/bin/env bash
# Products-page e2e across every country edition (DE, GB, FR).
# Starts a dev server per edition, runs the Playwright checks, tears it down.
#
# Needs NO secrets: the checks run through the ?preview=hpiq dev preview, which
# reads public/data directly and never signs in. Datasets must be built first
# (public/data/*.json) — see docs/UPDATE_PIPELINE.md.
set -uo pipefail

PORT="${PORT:-5199}"

failed=0
for cc in DE GB FR PL; do
  pkill -f "vite --port $PORT" 2>/dev/null
  sleep 1
  if [ "$cc" = "DE" ]; then
    npx vite --port "$PORT" >"/tmp/vite-products-$cc.log" 2>&1 &
  else
    VITE_COUNTRY_CODE="$cc" npx vite --port "$PORT" >"/tmp/vite-products-$cc.log" 2>&1 &
  fi
  sleep 9
  node tests/products-segmentation.e2e.mjs "$cc" "$PORT" || failed=1
done
pkill -f "vite --port $PORT" 2>/dev/null

if [ "$failed" -eq 0 ]; then
  echo "products / segmentation: all editions GREEN"
else
  echo "products / segmentation: FAILURES — see above" >&2
fi
exit "$failed"
