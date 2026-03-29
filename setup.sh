#!/usr/bin/env bash
# =============================================================================
# setup.sh — First-time setup for Linux (Fedora/Debian/Ubuntu) and macOS
# =============================================================================
set -euo pipefail

CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
error() { echo -e "${RED}[ERR ]${NC}  $*"; exit 1; }

OS="$(uname -s)"
info "Detected OS: $OS"

# ---------------------------------------------------------------------------
# 1. Check Docker
# ---------------------------------------------------------------------------
command -v docker  >/dev/null 2>&1 || error "Docker not found. Install from https://docs.docker.com/get-docker/"
command -v docker  >/dev/null 2>&1 && ok "Docker found"
# Check compose (plugin or standalone)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  error "Docker Compose not found. Install from https://docs.docker.com/compose/install/"
fi
ok "Docker Compose found ($COMPOSE)"

# ---------------------------------------------------------------------------
# 2. Create .env if missing
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example — please review and edit it before starting."
fi

# ---------------------------------------------------------------------------
# 3. Detect Linux gateway for Ollama on Fedora/Linux
#    On Linux, host.docker.internal doesn't work by default.
#    We auto-detect the bridge IP and patch OLLAMA_LOCAL_URL.
# ---------------------------------------------------------------------------
if [ "$OS" = "Linux" ]; then
  BRIDGE_IP=$(ip route show default 2>/dev/null | awk '/default/ {print $3; exit}')
  if [ -n "$BRIDGE_IP" ]; then
    CURRENT_URL=$(grep "^OLLAMA_LOCAL_URL=" .env | cut -d= -f2-)
    if echo "$CURRENT_URL" | grep -q "host.docker.internal"; then
      sed -i "s|OLLAMA_LOCAL_URL=.*|OLLAMA_LOCAL_URL=http://${BRIDGE_IP}:11434|" .env
      info "Linux detected: set OLLAMA_LOCAL_URL=http://${BRIDGE_IP}:11434"
      warn "Make sure Ollama is listening on 0.0.0.0:11434 (not just 127.0.0.1)."
      warn "  Edit /etc/systemd/system/ollama.service and add:"
      warn "  Environment=\"OLLAMA_HOST=0.0.0.0\""
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 4. Create vault directory if OBSIDIAN_VAULT_PATH is the default placeholder
# ---------------------------------------------------------------------------
VAULT_PATH=$(grep "^OBSIDIAN_VAULT_PATH=" .env | cut -d= -f2- | tr -d '"'"'" | xargs)
if [ "$VAULT_PATH" = "./data/vault" ]; then
  mkdir -p data/vault
  info "Created local vault placeholder at ./data/vault"
  info "  Change OBSIDIAN_VAULT_PATH in .env to point to your real Obsidian vault."
fi

# ---------------------------------------------------------------------------
# 5. Check Ollama
# ---------------------------------------------------------------------------
if command -v ollama >/dev/null 2>&1; then
  ok "Ollama found"
  MODEL=$(grep "^LOCAL_MODEL=" .env | cut -d= -f2- | xargs)
  if ! ollama list 2>/dev/null | grep -q "${MODEL:-llama3}"; then
    warn "Model '${MODEL:-llama3}' not pulled yet. Run: ollama pull ${MODEL:-llama3}"
  else
    ok "Model '${MODEL:-llama3}' is available"
  fi
else
  warn "Ollama not found. Install from https://ollama.com and run: ollama pull llama3"
fi

# ---------------------------------------------------------------------------
# 6. Build and start
# ---------------------------------------------------------------------------
info "Building Docker images…"
$COMPOSE build

info "Starting services…"
$COMPOSE up -d

echo ""
ok "=== Agent System is starting ==="
echo -e "  ${CYAN}Main UI:${NC}          http://localhost:3000  (admin / adminadmin)"
echo -e "  ${CYAN}Agent HQ (office):${NC} http://localhost:3000/office"
echo -e "  ${CYAN}Grafana:${NC}           http://localhost:3001  (admin / admin)"
echo -e "  ${CYAN}RabbitMQ:${NC}          http://localhost:15672 (guest / guest)"
echo -e "  ${CYAN}Prometheus:${NC}        http://localhost:9090"
echo ""
warn "Allow ~30 seconds for all services to become healthy."
