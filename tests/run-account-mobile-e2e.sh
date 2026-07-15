#!/usr/bin/env bash
# Phone Account screen e2e (< 700px, the curated MobileApp shell) across DE, GB, FR.
# One shared MobileApp component — driven as pro/owner/member. No secrets: runs
# through the ?preview=hpiq dev preview (no sign-in).
set -uo pipefail

PORT="${PORT:-5199}"

failed=0
for cc in DE GB FR; do
  pkill -f "vite --port $PORT" 2>/dev/null
  sleep 1
  if [ "$cc" = "DE" ]; then
    npx vite --port "$PORT" >"/tmp/vite-account-mobile-$cc.log" 2>&1 &
  else
    VITE_COUNTRY_CODE="$cc" npx vite --port "$PORT" >"/tmp/vite-account-mobile-$cc.log" 2>&1 &
  fi
  sleep 9
  node tests/account-mobile.e2e.mjs "$cc" "$PORT" || failed=1
done
pkill -f "vite --port $PORT" 2>/dev/null

if [ "$failed" -eq 0 ]; then
  echo "phone account: all editions GREEN"
else
  echo "phone account: FAILURES — see above" >&2
fi
exit "$failed"
