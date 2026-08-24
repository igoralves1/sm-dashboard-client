#!/usr/bin/env bash
#
# Fetch the Energisa device inventory using the demo account from .env.
#
# This authenticates against the ENERGISA user pool (us-east-2_SFrYV4huf) —
# the one whose accounts carry organization membership — rather than the SM
# Dashboard pool used by energisa-verify.sh. A token from the dashboard pool
# authenticates fine but returns 204 with no devices.
#
#   ./scripts/energisa-devices.sh          # pretty-print the device list
#   ./scripts/energisa-devices.sh --raw    # unformatted response body

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

[ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE not found" >&2; exit 1; }

get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'\''' | tr -d '\r'; }

REGION="$(get VITE_AWS_REGION)"
CLIENT_ID="$(get VITE_ENERGISA_CLIENT_ID)"
API="$(get VITE_ENERGISA_TENANTS_API)"
USERNAME="$(get VITE_ENERGISA_USER)"
PASSWORD="$(get VITE_ENERGISA_PASSWORD)"

for pair in "VITE_ENERGISA_CLIENT_ID:$CLIENT_ID" "VITE_ENERGISA_TENANTS_API:$API" \
            "VITE_ENERGISA_USER:$USERNAME" "VITE_ENERGISA_PASSWORD:$PASSWORD"; do
  if [ -z "${pair#*:}" ]; then
    echo "error: ${pair%%:*} is missing from .env" >&2
    exit 1
  fi
done

echo "signing in as $USERNAME against the Energisa pool..." >&2

TOKEN=$(aws cognito-idp initiate-auth \
  --region "$REGION" \
  --no-sign-request \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD" \
  --query 'AuthenticationResult.IdToken' \
  --output text)

[ -n "$TOKEN" ] && [ "$TOKEN" != "None" ] || { echo "error: sign-in returned no token" >&2; exit 1; }
echo "  ok (${#TOKEN} chars)" >&2

CODE=$(curl -s -o /tmp/energisa-devices.json -w '%{http_code}' --max-time 25 \
  -H "Authorization: $TOKEN" "$API/devices")

echo "GET $API/devices -> $CODE" >&2

if [ "$CODE" = "204" ]; then
  echo "204: authenticated, but this account belongs to no organization." >&2
  exit 2
fi

if [ "${1:-}" = "--raw" ]; then
  cat /tmp/energisa-devices.json
else
  python3 -m json.tool < /tmp/energisa-devices.json 2>/dev/null || cat /tmp/energisa-devices.json
fi
