#!/usr/bin/env bash
# Sign Up / Account / Team / policies e2e across every country edition.
# The dev server runs with VITE_REGISTRATION_OPEN=true so the REOPENED Sign Up
# form can be exercised — the shipped pause is covered by run-registration-e2e.sh.
set -uo pipefail

PORT="${PORT:-5199}"
: "${HPDB_TEST_SECRETS:?set HPDB_TEST_SECRETS to the directory holding e2e-pw.txt and appcheck-debug-token.txt}"

failed=0
for cc in DE GB FR; do
  pkill -f "vite --port $PORT" 2>/dev/null
  sleep 1
  if [ "$cc" = "DE" ]; then
    VITE_REGISTRATION_OPEN=true npx vite --port "$PORT" >"/tmp/vite-su-$cc.log" 2>&1 &
  else
    VITE_COUNTRY_CODE="$cc" VITE_REGISTRATION_OPEN=true npx vite --port "$PORT" >"/tmp/vite-su-$cc.log" 2>&1 &
  fi
  sleep 9
  node tests/signup-account.e2e.mjs "$cc" "$PORT" || failed=1
done
pkill -f "vite --port $PORT" 2>/dev/null

[ "$failed" -eq 0 ] && echo "signup/account/team: all editions GREEN" || echo "signup/account/team: FAILURES — see above" >&2
exit "$failed"
