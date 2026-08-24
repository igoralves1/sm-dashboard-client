#!/usr/bin/env bash
#
# End-to-end check that the SM Dashboard user pool can reach the Energisa data
# plane. Mints a fresh token, calls both APIs, and reports what each returned.
#
#   ./scripts/energisa-verify.sh
#
# 200 = working. 401 = pool not on that authorizer, or the stage wasn't
# redeployed. 403 = token accepted but this identity lacks authorization.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICES_API="https://7nn23x3eqh.execute-api.us-east-2.amazonaws.com/prod"
TENANTS_API="https://api.simemap.com/tenants"
DEVICE_ID="5707234122"

echo "minting token..."
TOKEN="$("$ROOT/scripts/energisa-token.sh")"
echo "  ok (${#TOKEN} chars)"
echo

check() {
  local name="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Authorization: $TOKEN" "$url")
  printf '  %-22s %s' "$name" "$code"
  case "$code" in
    200) echo "  ✓" ;;
    401) echo "  ✗ pool missing from authorizer, or stage not redeployed" ;;
    403) echo "  ~ token accepted, identity not authorized" ;;
    *)   echo "  ?" ;;
  esac
}

echo "calling APIs:"
check "TenantsApi /devices"  "$TENANTS_API/devices"
check "DevicesApi /consumo"  "$DEVICES_API/consumo/eletrico?device_id=$DEVICE_ID&dt_start=0&dt_end=1"
echo

echo "device list response (first 400 chars):"
curl -s --max-time 20 -H "Authorization: $TOKEN" "$TENANTS_API/devices" | head -c 400
echo
