#!/usr/bin/env bash
# Account-page layout e2e across every country edition (DE, GB, FR).
# One shared Account component — the test drives each edition as pro/owner/member.
# No secrets: runs through the ?preview=hpiq dev preview (no sign-in).
set -uo pipefail

PORT="${PORT:-5199}"

failed=0
for cc in DE GB FR; do
  pkill -f "vite --port $PORT" 2>/dev/null
  sleep 1
  if [ "$cc" = "DE" ]; then
    npx vite --port "$PORT" >"/tmp/vite-account-$cc.log" 2>&1 &
  else
    VITE_COUNTRY_CODE="$cc" npx vite --port "$PORT" >"/tmp/vite-account-$cc.log" 2>&1 &
  fi
  sleep 9
  node tests/account-layout.e2e.mjs "$cc" "$PORT" || failed=1
done
pkill -f "vite --port $PORT" 2>/dev/null

if [ "$failed" -eq 0 ]; then
  echo "account layout: all editions GREEN"
else
  echo "account layout: FAILURES — see above" >&2
fi
exit "$failed"
