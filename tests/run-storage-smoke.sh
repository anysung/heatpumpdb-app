#!/usr/bin/env bash
# Production data-path smoke: builds an edition, serves it with `vite preview`
# (import.meta.env.DEV = false → the REAL Storage download path, which the
# dev-server e2e suites never exercise), signs in as e2e-verify and asserts the
# datasets download from gs://heatpumpdb-datasets. Run after dataset uploads
# and after any change to auth/App Check/storage config:
#   HPDB_TEST_SECRETS=<dir> npm run test:storage          # PL (default)
#   HPDB_TEST_SECRETS=<dir> bash tests/run-storage-smoke.sh "DE PL"
set -uo pipefail

PORT="${PORT:-5311}"
: "${HPDB_TEST_SECRETS:?set HPDB_TEST_SECRETS to the directory holding e2e-pw.txt}"
MARKETS="${1:-PL}"

failed=0
for cc in $MARKETS; do
  case $cc in
    DE) build=build:de; out=dist;;
    GB) build=build:uk; out=dist-uk;;
    FR) build=build:fr; out=dist-fr;;
    PL) build=build:pl; out=dist-pl;;
    *) echo "unknown market: $cc" >&2; exit 2;;
  esac
  echo "[$cc] building production bundle ($build)…"
  npm run "$build" >/dev/null 2>&1 || { echo "[$cc] build FAILED" >&2; failed=1; continue; }
  pkill -f "vite preview --outDir $out" 2>/dev/null
  npx vite preview --outDir "$out" --port "$PORT" --strictPort >"/tmp/preview-smoke-$cc.log" 2>&1 &
  sleep 3
  node tests/storage-path.smoke.mjs "$cc" "$PORT" || failed=1
  pkill -f "vite preview --outDir $out" 2>/dev/null
done

if [ "$failed" -eq 0 ]; then
  echo "storage-path smoke: GREEN"
else
  echo "storage-path smoke: FAILURES — see above" >&2
fi
exit "$failed"
