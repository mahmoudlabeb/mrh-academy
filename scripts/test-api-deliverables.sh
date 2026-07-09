#!/usr/bin/env bash
# MRH Academy — API deliverables smoke test (Bash)
# Usage:
#   ./scripts/test-api-deliverables.sh
#   API_URL=https://mrh-academy.onrender.com/api/v1 ./scripts/test-api-deliverables.sh

set -uo pipefail

API_URL="${API_URL:-https://mrh-academy.onrender.com/api/v1}"
PASSWORD="${TEST_PASSWORD:-123456}"
PASSED=0
FAILED=0

pass() { PASSED=$((PASSED + 1)); echo "[PASS] $1"; }
fail() { FAILED=$((FAILED + 1)); echo "[FAIL] $1 — ${2:-unknown error}"; }

api() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-s -w "\n%{http_code}" -X "$method" "${API_URL}${path}" -H "Content-Type: application/json")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}"
}

echo ""
echo "=== MRH Academy API Deliverables Test ==="
echo "API: $API_URL"
echo ""

# Health
resp=$(api GET /health)
code=$(echo "$resp" | tail -n1)
[[ "$code" == "200" ]] && pass "GET /health" || fail "GET /health" "HTTP $code"

# Public endpoints
for ep in /tutors /courses /vocabulary; do
  resp=$(api GET "$ep")
  code=$(echo "$resp" | tail -n1)
  [[ "$code" == "200" ]] && pass "GET $ep" || fail "GET $ep" "HTTP $code"
done

login() {
  local email="$1" label="$2"
  local body="{\"email\":\"$email\",\"password\":\"$PASSWORD\"}"
  resp=$(api POST /auth/login "$body")
  code=$(echo "$resp" | tail -n1)
  body_json=$(echo "$resp" | sed '$d')
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    pass "POST /auth/login ($label)"
    echo "$body_json" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4
  else
    fail "POST /auth/login ($label)" "HTTP $code"
    echo ""
  fi
}

ADMIN_TOKEN=$(login "admin@mrhacademy.com" "admin")
STUDENT_TOKEN=$(login "student@demo.com" "student")
TUTOR_TOKEN=$(login "Sarah.alazzeh87@gmail.com" "tutor")
SUBADMIN_TOKEN=$(login "subadmin@mrhacademy.com" "subadmin")

auth_get() {
  local path="$1" label="$2" token="$3"
  [[ -z "$token" ]] && fail "$label" "no token" && return
  resp=$(api GET "$path" "" "$token")
  code=$(echo "$resp" | tail -n1)
  [[ "$code" == "200" ]] && pass "$label" || fail "$label" "HTTP $code"
}

auth_get "/students/balance" "GET /students/balance" "$STUDENT_TOKEN"
auth_get "/lessons" "GET /lessons (student)" "$STUDENT_TOKEN"
auth_get "/messages/contacts" "GET /messages/contacts" "$STUDENT_TOKEN"
auth_get "/courses/my/enrollments" "GET /courses/my/enrollments" "$STUDENT_TOKEN"
auth_get "/tutors/me/stats" "GET /tutors/me/stats" "$TUTOR_TOKEN"
auth_get "/tutors/me/profile" "GET /tutors/me/profile" "$TUTOR_TOKEN"
auth_get "/admin/stats" "GET /admin/stats" "$ADMIN_TOKEN"
auth_get "/tutors/pending" "GET /tutors/pending" "$ADMIN_TOKEN"
auth_get "/admin/employees" "GET /admin/employees" "$ADMIN_TOKEN"
auth_get "/admin/payments" "GET /admin/payments" "$ADMIN_TOKEN"

TS=$(date +%s)
reg_body="{\"firstName\":\"QA\",\"lastName\":\"Test\",\"email\":\"qa-${TS}@test.mrh\",\"password\":\"Test1234!\",\"role\":\"student\"}"
resp=$(api POST /auth/register "$reg_body")
code=$(echo "$resp" | tail -n1)
[[ "$code" == "200" || "$code" == "201" ]] && pass "POST /auth/register (student)" || fail "POST /auth/register (student)" "HTTP $code"

echo ""
echo "=== Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
[[ "$FAILED" -eq 0 ]] && exit 0 || exit 1
