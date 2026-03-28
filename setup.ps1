# =============================================================================
# setup.ps1 — First-time setup for Windows (PowerShell 5.1+)
# Run from an elevated PowerShell terminal:
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#   .\setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

function Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Ok    { param($msg) Write-Host "[ OK ]  $msg" -ForegroundColor Green }
function Err   { param($msg) Write-Host "[ERR ]  $msg" -ForegroundColor Red; exit 1 }

Info "AI Agent System — Windows Setup"

# ---------------------------------------------------------------------------
# 1. Check Docker Desktop
# ---------------------------------------------------------------------------
try { $null = docker version 2>&1 }
catch { Err "Docker not found. Install Docker Desktop from https://www.docker.com/products/docker-desktop/" }
Ok "Docker found"

$composeCmd = $null
try { docker compose version | Out-Null; $composeCmd = "docker compose" } catch {}
if (-not $composeCmd) {
    try { docker-compose --version | Out-Null; $composeCmd = "docker-compose" } catch {}
}
if (-not $composeCmd) { Err "Docker Compose not found." }
Ok "Docker Compose found ($composeCmd)"

# ---------------------------------------------------------------------------
# 2. Create .env
# ---------------------------------------------------------------------------
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Warn ".env created — please edit it (especially OBSIDIAN_VAULT_PATH) before continuing."
    Warn "Press Enter to continue after editing, or Ctrl+C to abort."
    Read-Host
}

# ---------------------------------------------------------------------------
# 3. Windows: ensure OLLAMA_LOCAL_URL uses host.docker.internal
# ---------------------------------------------------------------------------
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "host\.docker\.internal") {
    # Replace any Linux bridge IP with the Windows default
    $envContent = $envContent -replace "OLLAMA_LOCAL_URL=http://[\d.]+:11434",
                                        "OLLAMA_LOCAL_URL=http://host.docker.internal:11434"
    Set-Content ".env" $envContent
    Info "Set OLLAMA_LOCAL_URL=http://host.docker.internal:11434 for Windows"
}

# ---------------------------------------------------------------------------
# 4. Vault directory
# ---------------------------------------------------------------------------
$vaultLine = (Get-Content ".env") | Where-Object { $_ -match "^OBSIDIAN_VAULT_PATH=" }
$vaultPath = ($vaultLine -split "=", 2)[1].Trim().Trim('"').Trim("'")
if ($vaultPath -eq "./data/vault") {
    New-Item -ItemType Directory -Force -Path "data\vault" | Out-Null
    Info "Created placeholder vault at .\data\vault"
    Warn "Change OBSIDIAN_VAULT_PATH in .env to your real Obsidian vault path."
}

# ---------------------------------------------------------------------------
# 5. Check Ollama
# ---------------------------------------------------------------------------
try {
    $null = Get-Command ollama -ErrorAction Stop
    Ok "Ollama found"
} catch {
    Warn "Ollama not found. Download from https://ollama.com and run: ollama pull llama3"
}

# ---------------------------------------------------------------------------
# 6. Build and start
# ---------------------------------------------------------------------------
Info "Building Docker images (this may take a few minutes on first run)…"
Invoke-Expression "$composeCmd build"

Info "Starting services…"
Invoke-Expression "$composeCmd up -d"

Write-Host ""
Ok "=== Agent System is starting ==="
Write-Host "  Main UI:           http://localhost:3000  (admin / adminadmin)" -ForegroundColor Cyan
Write-Host "  Agent HQ (office): http://localhost:3000/office" -ForegroundColor Cyan
Write-Host "  Grafana:           http://localhost:3001  (admin / admin)" -ForegroundColor Cyan
Write-Host "  RabbitMQ:          http://localhost:15672 (guest / guest)" -ForegroundColor Cyan
Write-Host "  Prometheus:        http://localhost:9090" -ForegroundColor Cyan
Write-Host ""
Warn "Allow ~30 seconds for all services to become healthy."
