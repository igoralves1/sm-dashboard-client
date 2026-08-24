#!/usr/bin/env bash
#
# Mint a fresh Cognito idToken for the SM Dashboard user pool.
#
# Reads ENERGISA_VERIFY_USER / ENERGISA_VERIFY_PASSWORD from .env and exchanges
# them for a token via USER_PASSWORD_AUTH. No browser, no admin credentials, no
# copy-paste — the app client is public (no secret) and MFA is off, so this
# works from any shell or CI job.
#
#   ./scripts/energisa-token.sh              # print the idToken
#   TOKEN=$(./scripts/energisa-token.sh)     # capture it
#   ./scripts/energisa-token.sh --access     # print the accessToken instead
#
# Tokens are valid ~30 minutes; just run it again rather than caching.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

[ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE not found" >&2; exit 1; }

get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'\''' | tr -d '\r'; }

CLIENT_ID="$(get VITE_COGNITO_CLIENT_ID)"
REGION="$(get VITE_AWS_REGION)"
USERNAME="$(get ENERGISA_VERIFY_USER)"
PASSWORD="$(get ENERGISA_VERIFY_PASSWORD)"

for pair in "VITE_COGNITO_CLIENT_ID:$CLIENT_ID" "VITE_AWS_REGION:$REGION" \
            "ENERGISA_VERIFY_USER:$USERNAME" "ENERGISA_VERIFY_PASSWORD:$PASSWORD"; do
  if [ -z "${pair#*:}" ]; then
    echo "error: ${pair%%:*} is missing from .env" >&2
    exit 1
  fi
done

FIELD="IdToken"
[ "${1:-}" = "--access" ] && FIELD="AccessToken"

# initiate-auth is unauthenticated against a public client, so --no-sign-request
# keeps it from picking up whatever AWS profile happens to be active.
aws cognito-idp initiate-auth \
  --region "$REGION" \
  --no-sign-request \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD" \
  --query "AuthenticationResult.$FIELD" \
  --output text
