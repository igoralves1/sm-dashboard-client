#!/usr/bin/env bash
# Counts tool calls per session and warns every 10 turns
# File: .claude/turn-counter.sh

COUNTER_FILE="/tmp/claude-turn-counter-${PWD//\//-}"

# Read current count
COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Warn at every 10 turns
if (( COUNT % 10 == 0 )); then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚠️  TOKEN WARNING — $COUNT tool calls this session"
  echo "   History is growing. Run /compact now to reset."
  echo "   Estimated history cost: ~$((COUNT * 1500)) tokens"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi
