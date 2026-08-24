#!/usr/bin/env bash
#
# Print every derived quantity at one instant, computed from the raw API
# response with production's formulas. Use it to settle whether a readout
# disagreement is a real bug or just two cursors parked at different times.
#
#   ./scripts/energisa-instant.sh                     # latest reading today
#   ./scripts/energisa-instant.sh smcdwux "01:18"     # nearest reading to 01:18
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
AT="${2:-}"

START_MS=$(python3 -c "
import datetime
d=datetime.date.today()
print(int(datetime.datetime.combine(d, datetime.time.min).timestamp()*1000))")
END_MS=$(python3 -c "
import datetime
d=datetime.date.today()
print(int(datetime.datetime.combine(d, datetime.time.max).timestamp()*1000))")

TOKEN=$(aws cognito-idp initiate-auth \
  --region "$REGION" --no-sign-request \
  --auth-flow USER_PASSWORD_AUTH --client-id "$CLIENT_ID" \
  --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD" \
  --query 'AuthenticationResult.IdToken' --output text)

curl -s -H "Authorization: $TOKEN" \
  "$API/consumo/eletrico?device_id=$DEVICE&dt_start=$START_MS&dt_end=$END_MS" \
  -o /tmp/energisa-instant.json

AT="$AT" python3 - <<'PY'
import json, math, os, datetime

payload = json.load(open('/tmp/energisa-instant.json'))
data = None
for c in (payload, payload.get('res'), payload.get('data'),
          (payload.get('res') or {}).get('data') if isinstance(payload.get('res'), dict) else None):
    if isinstance(c, list):
        data = c
        break
if not data:
    print('no readings'); raise SystemExit(1)

want = os.environ.get('AT', '').strip()
if want:
    hh, mm = (want.split(':') + ['0'])[:2]
    today = datetime.date.today()
    target = datetime.datetime.combine(today, datetime.time(int(hh), int(mm))).timestamp() * 1000
    row = min(data, key=lambda r: abs(r['timestamp'] - target))
else:
    row = data[-1]

ts = datetime.datetime.fromtimestamp(row['timestamp'] / 1000)
print(f"instante: {ts:%d-%m-%Y %H:%M:%S}   ({len(data)} pontos no dia)\n")

DEG = math.pi / 180


def readout(value, unit):
    """Production's formatter: k only at >= 10000, separators below."""
    big = abs(value) >= 10000
    return f"{value/1000:,.2f} k{unit}" if big else f"{value:,.2f} {unit}"


print(f"{'':4} {'V':>16} {'I':>14} {'P':>16} {'S':>16} {'Q':>16} {'FP':>8}")
for ch in (1, 2, 3):
    v = row.get(f'v_c{ch}', 0)
    i = row.get(f'i_c{ch}', 0)
    p = row.get(f'p_c{ch}', 0)
    va = row.get(f'v_a_c{ch}', 0)
    ia = row.get(f'i_a_c{ch}', 0)

    theta = va - ia
    s = abs(v) * abs(i)
    q = s * math.sin(theta * DEG)
    fp = abs(math.cos(theta * DEG))

    print(f"CH{ch}  {readout(v,'V'):>16} {readout(i,'A'):>14} "
          f"{readout(p,'W'):>16} {readout(s,'VA'):>16} {readout(q,'var'):>16} {fp:>8.2f}")

t = row.get('temperature', row.get('temp', row.get('t')))
print(f"\nT: {t}")
print("\ncampos disponíveis:", ', '.join(sorted(row.keys())))
PY
