#!/usr/bin/env bash
# SoloCampaign Linux Smoke Test
# Run after: npm run build
# Usage: bash scripts/smoke/smoke.linux.sh
set -u

DIST_DIR="${1:-dist}"
FAILED=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; FAILED=$((FAILED + 1)); }
check() { local label="$1"; shift; if "$@" 2>/dev/null; then pass "$label"; else fail "$label"; fi; }

echo "--- SoloCampaign Linux Smoke Test ---"

# 1. AppImage artifact exists
APPIMAGE=$(find "$DIST_DIR" -name "*.AppImage" 2>/dev/null | head -1)
check "AppImage artifact exists in dist/" test -n "$APPIMAGE"

if [ -n "$APPIMAGE" ]; then
  chmod +x "$APPIMAGE"

  # Extract AppImage to a temp dir for static checks (avoids needing FUSE)
  EXTRACT_DIR=$(mktemp -d)
  "$APPIMAGE" --appimage-extract --appimage-extract-root="$EXTRACT_DIR" > /dev/null 2>&1 || {
    # Fallback: just check the file size (AppImages are typically >50MB)
    SIZE=$(stat -c%s "$APPIMAGE" 2>/dev/null || echo "0")
    check "AppImage is non-trivially sized (>10MB)" test "$SIZE" -gt 10485760
  }

  # 2. better-sqlite3 ASAR-unpacked .node (check inside extracted or within AppImage path)
  # Looks inside app.asar.unpacked/node_modules/better-sqlite3 for the native .node binary
  NODE_FILE=$(find "$EXTRACT_DIR" -path "*/app.asar.unpacked/node_modules/better-sqlite3/*.node" 2>/dev/null | head -1)
  if [ -z "$NODE_FILE" ]; then
    NODE_FILE=$(find "$EXTRACT_DIR" -name "*.node" 2>/dev/null | head -1)
  fi
  if [ -z "$NODE_FILE" ]; then
    # If extraction failed, look in dist/linux-unpacked if it exists
    NODE_FILE=$(find "$DIST_DIR/linux-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3" -name "*.node" 2>/dev/null | head -1)
  fi
  check "better-sqlite3 .node file exists in asar.unpacked" test -n "$NODE_FILE"

  # 3. Drizzle migration SQL
  MIGRATION_SQL=$(find "$EXTRACT_DIR" -name "0000_absent_thunderball.sql" 2>/dev/null | head -1)
  if [ -z "$MIGRATION_SQL" ]; then
    MIGRATION_SQL=$(find "$DIST_DIR/linux-unpacked" -name "0000_absent_thunderball.sql" 2>/dev/null | head -1)
  fi
  check "Drizzle migration SQL present in resources" test -n "$MIGRATION_SQL"

  # 4. Launch AppImage (requires FUSE or --no-sandbox)
  "$APPIMAGE" --no-sandbox &
  APP_PID=$!
  sleep 6
  if kill -0 "$APP_PID" 2>/dev/null; then
    pass "AppImage running after 6s (pid=$APP_PID)"

    # 5. Single-instance lock
    "$APPIMAGE" --no-sandbox &
    SECOND_PID=$!
    sleep 3
    if ! kill -0 "$SECOND_PID" 2>/dev/null; then
      pass "Single-instance lock (second launch exited)"
    else
      fail "Single-instance lock (second launch still running)"
      kill "$SECOND_PID" 2>/dev/null || true
    fi

    # 6. DB file in userData
    DB_PATH="$HOME/.config/SoloCampaign/solocampaign.db"
    sleep 2
    check "solocampaign.db created in ~/.config/SoloCampaign/" test -f "$DB_PATH"

    # Cleanup
    kill "$APP_PID" 2>/dev/null || true
  else
    fail "AppImage did not stay running for 6s"
  fi

  rm -rf "$EXTRACT_DIR"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All smoke checks passed."
  exit 0
else
  echo "$FAILED smoke check(s) FAILED."
  exit 1
fi
