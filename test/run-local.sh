#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

echo "=== killing stale wrangler dev servers ==="
pkill -f "wrangler pages dev" 2>/dev/null || true
sleep 1

echo "=== cleaning local D1/R2 state ==="
rm -rf .wrangler/state

echo "=== starting wrangler pages dev on :8788 ==="
npx wrangler pages dev public --d1=DB --r2=FILES --port=8788 --local > /tmp/wrangler-dev.log 2>&1 &
SERVER_PID=$!

cleanup() {
  echo "=== stopping server (pid $SERVER_PID) ==="
  kill $SERVER_PID 2>/dev/null || true
  pkill -f "wrangler pages dev" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== waiting for server to become ready ==="
READY=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8788/ 2>/dev/null | grep -qE "^[0-9]+$"; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "!!! server did not become ready, log follows:"
  cat /tmp/wrangler-dev.log
  exit 1
fi
echo "server ready after ~${i}s"

echo "=== running devinittemp init/seed/resetpw ==="
curl -s "http://127.0.0.1:8788/api/devinittemp?mode=init" | head -c 2000; echo
curl -s "http://127.0.0.1:8788/api/devinittemp?mode=seed" | head -c 2000; echo
curl -s "http://127.0.0.1:8788/api/devinittemp?mode=resetpw" | head -c 2000; echo

echo "=== running api-test.mjs ==="
node test/api-test.mjs
API_EXIT=$?

echo "=== running ui-test.mjs ==="
node test/ui-test.mjs
UI_EXIT=$?

echo "=== results ==="
echo "api-test exit: $API_EXIT"
echo "ui-test exit: $UI_EXIT"

if [ "$API_EXIT" != "0" ] || [ "$UI_EXIT" != "0" ]; then
  echo "!!! TESTS FAILED"
  exit 1
fi
echo "=== ALL TESTS PASSED ==="
exit 0
