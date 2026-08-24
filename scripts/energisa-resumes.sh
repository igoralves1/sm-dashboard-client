#!/usr/bin/env bash
#
# Compute the Consumo CH statistics straight from the API, independently of
# either dashboard, so the two can be compared against ground truth.
#
# Defaults to *yesterday* on purpose: today's window keeps growing, so two
# snapshots taken minutes apart legitimately disagree on maxima and totals.
# A finished day is stable and any difference is a real formula difference.
#
#   ./scripts/energisa-resumes.sh                 # yesterday, Vision Residence
#   ./scripts/energisa-resumes.sh smcdwux 2       # 2 days ago
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE not found" >&2; exit 1; }

get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'\''' | tr -d '\r'; }

REGION="$(get VITE_AWS_REGION)"
CLIENT_ID="$(get VITE_ENERGISA_CLIENT_ID)"
API="$(get VITE_ENERGISA_DEVICES_API)"
USERNAME="$(get VITE_ENERGISA_USER)"
PASSWORD="$(get VITE_ENERGISA_PASSWORD)"

DEVICE="${1:-smcdwux}"
DAYS_AGO="${2:-1}"

# Start and end of that day, local time, in epoch milliseconds.
START_MS=$(python3 -c "
import datetime
d = datetime.date.today() - datetime.timedelta(days=$DAYS_AGO)
print(int(datetime.datetime.combine(d, datetime.time.min).timestamp()*1000))")
END_MS=$(python3 -c "
import datetime
d = datetime.date.today() - datetime.timedelta(days=$DAYS_AGO)
print(int(datetime.datetime.combine(d, datetime.time.max).timestamp()*1000))")

echo "device=$DEVICE  day=-$DAYS_AGO" >&2

TOKEN=$(aws cognito-idp initiate-auth \
  --region "$REGION" --no-sign-request \
  --auth-flow USER_PASSWORD_AUTH --client-id "$CLIENT_ID" \
  --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD" \
  --query 'AuthenticationResult.IdToken' --output text)

curl -s -H "Authorization: $TOKEN" \
  "$API/consumo/eletrico?device_id=$DEVICE&dt_start=$START_MS&dt_end=$END_MS" \
  -o /tmp/energisa-readings.json

python3 - <<'PY'
import json

payload = json.load(open('/tmp/energisa-readings.json'))

data = None
for candidate in (payload, payload.get('res'), payload.get('data'),
                  (payload.get('res') or {}).get('data') if isinstance(payload.get('res'), dict) else None):
    if isinstance(candidate, list):
        data = candidate
        break

if not data:
    print('no readings returned; keys:', list(payload)[:8])
    raise SystemExit(1)

print(f'{len(data)} pontos\n')

MS_PER_HOUR = 3600 * 1000

for ch in (1, 2, 3):
    v = [r.get(f'v_c{ch}', 0) for r in data]
    i = [r.get(f'i_c{ch}', 0) for r in data]
    p = [r.get(f'p_c{ch}', 0) for r in data]

    # Energy integrated exactly as the production page does.
    guarded = unguarded = 0.0
    for n in range(1, len(data)):
        gap = data[n]['timestamp'] - data[n - 1]['timestamp']
        unguarded += p[n] * gap / MS_PER_HOUR / 1000
        if gap > 0:
            guarded += p[n] * gap / MS_PER_HOUR / 1000

    print(f'CH{ch}')
    print(f'  V  max {max(v):10.2f}  med {sum(v)/len(v):10.2f}  min {min(v):10.2f}')
    print(f'  I  max {max(i):10.2f}  med {sum(i)/len(i):10.2f}  min {min(i):10.2f}')
    print(f'  P  max {max(p)/1000:10.2f}k med {sum(p)/len(p)/1000:10.2f}k min {min(p)/1000:10.2f}k')
    print(f'  Consumo  {guarded:.2f} kWh   (sem guarda: {unguarded:.2f} kWh)')
    if abs(guarded - unguarded) > 0.005:
        print('   ^ timestamps fora de ordem neste intervalo')
    print()
PY
