#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3001}"

# ── Load credentials from .env if available ──
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme123}"

if [ -f .env ]; then
  ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2- | tr -d '"' | xargs || echo "$ADMIN_EMAIL")
  ADMIN_PASSWORD=$(grep -E '^ADMIN_PASSWORD=' .env | cut -d= -f2- | tr -d '"' | xargs || echo "$ADMIN_PASSWORD")
  NEXT_PUBLIC_API_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' .env | cut -d= -f2- | tr -d '"' | xargs || echo "")
  [ -n "$NEXT_PUBLIC_API_URL" ] && API="$NEXT_PUBLIC_API_URL"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

say()   { echo -e "$*"; }
ok()    { echo -e "  ${GREEN}✔${NC} $*"; }
fail()  { echo -e "  ${RED}✘${NC} $*"; }
info()  { echo -e "  ${CYAN}ℹ${NC} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $*"; }
header(){ echo -e "\n${BOLD}── $* ──${NC}"; }

# ── Validate dependencies ──
command -v curl >/dev/null 2>&1 || { fail "curl is required"; exit 1; }

HAS_JQ=false
command -v jq >/dev/null 2>&1 && HAS_JQ=true

json_val() {
  if $HAS_JQ; then
    jq -r "$1 // empty"
  else
    grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
  fi
}

# ── Cleanup on exit ──
CREATED_IDS=()
cleanup() {
  say ""
  header "Cleanup"
  if [ ${#CREATED_IDS[@]} -gt 0 ] && [ -n "$AUTH" ]; then
    info "Removing demo monitors..."
    for id in "${CREATED_IDS[@]}"; do
      curl -sS -X DELETE "${API}/api/monitors/${id}" -H "$AUTH" >/dev/null 2>&1 || true
    done
    ok "Demo monitors removed"
  fi
  say ""
}
trap cleanup EXIT INT TERM

# ── Banner ──
say ""
say "══════════════════════════════════════════════════════"
say "  ${BOLD}Cronko Demo — Self-Hosted Monitor Simulator${NC}"
say "  API: ${API}"
say "══════════════════════════════════════════════════════"
say ""

# ── Login ──
header "Authentication"
CREDS="{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
info "Logging in as ${ADMIN_EMAIL}..."

LOGIN=$(curl -sS --max-time 10 -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d "$CREDS") || { fail "Cannot reach API at ${API}"; exit 1; }

TOKEN=$(echo "$LOGIN" | json_val ".token" "token")
[ -z "$TOKEN" ] && { fail "Login failed. Check ADMIN_EMAIL / ADMIN_PASSWORD."; exit 1; }
ok "Authenticated"
AUTH="Authorization: Bearer ${TOKEN}"

# ── Create notification channel (Discord webhook test) ──
header "Notification Channel"
info "Creating test Discord channel..."
CHANNEL=$(curl -sS --max-time 5 -X POST "${API}/api/notifications" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Demo Discord","type":"discord","config":{"webhookUrl":"https://discord.com/api/webhooks/test"}}') || true
CHANNEL_ID=$(echo "$CHANNEL" | json_val ".id" "id" || true)
if [ -n "$CHANNEL_ID" ]; then
  ok "Discord channel created"
  info "Testing notification channel..."
  curl -sS -X POST "${API}/api/notifications/${CHANNEL_ID}/test" -H "$AUTH" >/dev/null 2>&1 || true
  ok "Test notification sent"
else
  warn "Could not create channel — continuing without notifications"
fi

# ── Create monitors ──
header "Creating Monitors"
declare -A TOKENS

create_monitor() {
  local name="$1" interval="$2" grace="${3:-120}" max_dur="${4:-}"
  say -n "  ${name} (each ${interval}s)... "

  local body="{\"name\":\"${name}\",\"expectedIntervalSeconds\":${interval},\"gracePeriodSeconds\":${grace}"
  [ -n "$max_dur" ] && body="${body},\"maxDurationMs\":${max_dur}"
  body="${body}}"

  local resp
  resp=$(curl -sS --max-time 10 -X POST "${API}/api/monitors" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$body") || { fail "Request failed"; exit 1; }

  local id token
  id=$(echo "$resp" | json_val ".id" "id")
  token=$(echo "$resp" | json_val ".token" "token")

  [ -z "$id" ] || [ -z "$token" ] && { fail "Create failed: $(echo "$resp" | json_val ".error" "error" || echo 'unknown')"; exit 1; }
  TOKENS["${name}"]="$token"
  CREATED_IDS+=("$id")
  ok "token: ${token:0:8}..."
}

create_monitor "Always Healthy" 30 120
create_monitor "Slow Worker"  60 120 5000
create_monitor "Goes Down"    90 120

# ── Pulse demo (start/finish) ──
header "Pulse Demo (start/finish)"
TOKEN_PULSE="${TOKENS[Slow Worker]}"
info "Sending /start..."
curl -sS --max-time 5 -X POST "${API}/ping/${TOKEN_PULSE}/start" -o /dev/null 2>/dev/null
ok "Pulse started"

say -n "  Simulating work..."
sleep 2
say " done"
DURATION=$((SECONDS + 2))

info "Sending /finish with duration=${DURATION}ms..."
curl -sS --max-time 5 "${API}/ping/${TOKEN_PULSE}/finish?d=${DURATION}&exit=0" -o /dev/null 2>/dev/null
ok "Pulse finished (${DURATION}ms)"

# ── Simulation ──
header "Simulation"
say "  Sending pings to populate data..."
say "  ${CYAN}(Ctrl+C to stop — monitors will be cleaned up)${NC}"
say ""

C=0
MAX_CYCLES=${MAX_CYCLES:-8}

while [ $C -lt $MAX_CYCLES ]; do
  C=$((C + 1))

  # Always Healthy — normal ping
  D=$((100 + RANDOM % 400))
  curl -sS --max-time 5 "${API}/ping/${TOKENS[Always Healthy]}?d=${D}&exit=0" -o /dev/null 2>/dev/null
  printf "  ${GREEN}●${NC} %-18s %-8s %s\n" "Always Healthy" "${D}ms" "healthy"

  # Slow Worker — sometimes exceeds max duration (5s)
  if [ $((C % 3)) -eq 0 ]; then
    D=$((5500 + RANDOM % 2000))
    curl -sS --max-time 5 "${API}/ping/${TOKENS[Slow Worker]}?d=${D}&exit=0" -o /dev/null 2>/dev/null
    printf "  ${YELLOW}●${NC} %-18s %-8s %s\n" "Slow Worker" "${D}ms" "exceeded max"
  else
    D=$((200 + RANDOM % 800))
    curl -sS --max-time 5 "${API}/ping/${TOKENS[Slow Worker]}?d=${D}&exit=0" -o /dev/null 2>/dev/null
    printf "  ${GREEN}●${NC} %-18s %-8s %s\n" "Slow Worker" "${D}ms" "healthy"
  fi

  # Goes Down — stops after 3 cycles
  if [ "$C" -le 3 ]; then
    D=$((80 + RANDOM % 200))
    curl -sS --max-time 5 "${API}/ping/${TOKENS[Goes Down]}?d=${D}&exit=0" -o /dev/null 2>/dev/null
    printf "  ${GREEN}●${NC} %-18s %-8s %s\n" "Goes Down" "${D}ms" "healthy"
    [ "$C" -eq 3 ] && say "  ${RED}  Goes Down stops sending pings (simulating outage)${NC}"
  else
    printf "  ${RED}●${NC} %-18s %-8s %s\n" "Goes Down" "—" "no ping"
  fi

  say ""
  sleep 5
done

header "Done!"
info "Open ${NEXT_PUBLIC_API_URL:-http://localhost:3000} to view the dashboard."
info "Monitors will be cleaned up..."
say ""
sleep 2