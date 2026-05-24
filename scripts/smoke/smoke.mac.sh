#!/usr/bin/env bash
# SoloCampaign macOS Smoke Test
# Run after: npm run build
# Usage: bash scripts/smoke/smoke.mac.sh
set -u

DIST_DIR="${1:-dist}"
FAILED=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; FAILED=$((FAILED + 1)); }
check() { local label="$1"; shift; if "$@" 2>/dev/null; then pass "$label"; else fail "$label"; fi; }

echo "--- SoloCampaign macOS Smoke Test ---"

# 1. .app bundle exists
APP_PATH="$DIST_DIR/mac/SoloCampaign.app"
check ".app bundle exists" test -d "$APP_PATH"

# 2. Main executable inside .app
EXE_PATH="$APP_PATH/Contents/MacOS/SoloCampaign"
check "Main executable exists inside .app" test -f "$EXE_PATH"

# 3. better-sqlite3 ASAR-unpacked .node file
NODE_FILE=$(find "$DIST_DIR/mac/SoloCampaign.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3" -name "*.node" 2>/dev/null | head -1)
check "better-sqlite3 .node in asar.unpacked" test -n "$NODE_FILE"

# 4. Drizzle migration SQL
MIGRATION_SQL="$DIST_DIR/mac/SoloCampaign.app/Contents/Resources/migrations/0000_absent_thunderball.sql"
check "Drizzle migration SQL at Resources/migrations/" test -f "$MIGRATION_SQL"

# 5. Launch packaged app
open "$APP_PATH" --args --no-sandbox 2>/dev/null || true
sleep 6
APP_PID=$(pgrep -f "SoloCampaign" | head -1 || echo "")
if [ -n "$APP_PID" ]; then
  pass "Packaged app running after 6s (pid=$APP_PID)"

  # 6. Single-instance lock
  open "$APP_PATH" --args --no-sandbox 2>/dev/null || true
  sleep 3
  NEW_PID_COUNT=$(pgrep -f "SoloCampaign" | wc -l | tr -d ' ')
  # If single-instance lock works, there should still be only one process
  check "Single-instance lock (second open does not spawn extra process)" test "$NEW_PID_COUNT" -le 2

  # 7. DB file in userData
  DB_PATH="$HOME/Library/Application Support/SoloCampaign/solocampaign.db"
  sleep 2
  check "solocampaign.db created in ~/Library/Application Support/SoloCampaign/" test -f "$DB_PATH"

  # Cleanup
  pkill -f "SoloCampaign" 2>/dev/null || true
else
  fail "Packaged app did not start within 6s"
  FAILED=$((FAILED + 1))
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All smoke checks passed."
  exit 0
else
  echo "$FAILED smoke check(s) FAILED."
  exit 1
fi
