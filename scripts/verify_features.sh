#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://frontend-six-weld-37.vercel.app}"
BACKEND_URL="${BACKEND_URL:-https://backend-blond-seven-35.vercel.app}"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

check_status() {
  local name="$1"
  local url="$2"
  local expected="$3"

  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url")"
  if [[ "$code" == "$expected" ]]; then
    pass "$name -> $code"
  else
    fail "$name -> expected $expected, got $code"
  fi
}

echo "Checking core feature endpoints..."
check_status "Backend health" "$BACKEND_URL/health" "200"
check_status "Frontend login" "$FRONTEND_URL/login" "200"
check_status "Frontend proxy health" "$FRONTEND_URL/api/backend/health" "200"

# Cron endpoints should be protected
check_status "Cron auth guard" "$BACKEND_URL/cron/morning-briefing" "401"

echo "All core checks passed."
