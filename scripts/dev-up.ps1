# scripts/dev-up.ps1 — bring up the local Legal AI backend in one command.
# Starts the n8n Docker container and the ngrok tunnel (static domain).
# Usage:  pwsh scripts/dev-up.ps1
#
# Note: ngrok is ONLY needed for inbound traffic to n8n — Telegram webhooks
# and the Google OAuth callback. For editing workflows, running
# scripts/test-webhook.mjs, or deploy-workflow.mjs, n8n on localhost is enough.

$NGROK_DOMAIN = 'rosy-caution-progeny.ngrok-free.dev'

# 1. n8n container (auto-restart policy is already 'unless-stopped')
$running = (docker inspect -f '{{.State.Running}}' n8n 2>$null)
if ($running -ne 'true') {
  Write-Host 'Starting n8n container...'
  docker start n8n | Out-Null
} else {
  Write-Host 'n8n already running.'
}

# wait for health
for ($i = 0; $i -lt 30; $i++) {
  try {
    if ((Invoke-WebRequest http://localhost:5678/healthz -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { break }
  } catch {}
  Start-Sleep -Seconds 1
}
Write-Host 'n8n editor: http://localhost:5678'

# 2. ngrok tunnel (static domain)
$tunnelUp = $false
try {
  $t = (Invoke-RestMethod http://localhost:4040/api/tunnels -TimeoutSec 2).tunnels
  if ($t | Where-Object { $_.public_url -like "*$NGROK_DOMAIN*" }) { $tunnelUp = $true }
} catch {}

if ($tunnelUp) {
  Write-Host "ngrok: already tunneling https://$NGROK_DOMAIN"
} else {
  Write-Host 'Starting ngrok in a new window...'
  Start-Process ngrok -ArgumentList "http --url=$NGROK_DOMAIN 5678"
}

Write-Host ''
Write-Host 'Backend up. Quick test:  node scripts/test-webhook.mjs 2'
