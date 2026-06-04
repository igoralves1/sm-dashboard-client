#!/usr/bin/env bash
# Counts tool calls per session and warns every 10 turns
# File: .claude/turn-counter.sh

COUNTER_FILE="$HOME/.claude-turn-counter-${PWD//\//-}"

# Read current count
COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Warn at every 10 turns
if (( COUNT % 10 == 0 )); then
  EST_TOKENS=$((COUNT * 1500))
  if   (( COUNT >= 40 )); then LEVEL="🔴 HIGH"
  elif (( COUNT >= 20 )); then LEVEL="🟠 MEDIUM"
  else                         LEVEL="🟡 LOW"
  fi
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📊 TOKEN COUNTER — $COUNT tool calls  |  $LEVEL"
  echo "  Estimated history cost : ~${EST_TOKENS} tokens"
  echo "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"
  echo "  You decide when to act:"
  echo "    /compact  → compress history, keep context, continue"
  echo "    new session → start clean (loses in-progress context)"
  echo "    ignore    → keep going, counter continues"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi
