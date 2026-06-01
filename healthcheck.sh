#!/bin/bash
# Atrail health monitor — runs every 5 minutes via cron
# Restarts API/web if they stop responding

LOG="/home/ubuntu/atrail/healthcheck.log"
API_URL="http://localhost:4000/health"
WEB_URL="http://localhost:3002"
MAX_LOG_LINES=500

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

# Trim log file if too large
if [ -f "$LOG" ] && [ $(wc -l < "$LOG") -gt $MAX_LOG_LINES ]; then
  tail -$MAX_LOG_LINES "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi

# Check API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL" 2>/dev/null)
if [ "$API_STATUS" != "200" ]; then
  log "⚠️  API unhealthy (HTTP $API_STATUS) — restarting atrail-api"
  pm2 restart atrail-api >> "$LOG" 2>&1
  sleep 5
  RETRY=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL" 2>/dev/null)
  if [ "$RETRY" = "200" ]; then
    log "✅ API recovered after restart"
  else
    log "❌ API still down after restart (HTTP $RETRY) — manual intervention needed"
  fi
else
  log "✅ API OK"
fi

# Check Web
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$WEB_URL" 2>/dev/null)
if [ "$WEB_STATUS" != "200" ]; then
  log "⚠️  Web unhealthy (HTTP $WEB_STATUS) — restarting atrail-web"
  pm2 restart atrail-web >> "$LOG" 2>&1
  sleep 5
  RETRY=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$WEB_URL" 2>/dev/null)
  if [ "$RETRY" = "200" ]; then
    log "✅ Web recovered after restart"
  else
    log "❌ Web still down after restart (HTTP $RETRY) — manual intervention needed"
  fi
else
  log "✅ Web OK"
fi
