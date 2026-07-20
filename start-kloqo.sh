#!/bin/bash
# =============================================================================
# Kloqo V2 — One-Click Clinic Launcher (Local Production Mode)
# =============================================================================
#
# This script starts the Kloqo system using pre-compiled Docker images.
# Your raw source code is NOT included on this computer.
# =============================================================================

set -e

echo ""
echo "🏥 =============================================="
echo "🏥  KLOQO LOCAL CLINIC SYSTEM"
echo "🏥 =============================================="
echo ""

# ── Step 1: Check Docker ─────────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker Desktop is not running!"
  echo "   Please open Docker Desktop and wait 15 seconds, then try again."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "✅ Docker is active."

# ── Step 2: Auto-Load Pre-compiled Docker Images (If present on USB) ─────────
KLOQO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$KLOQO_DIR"

if [ -f "kloqo-backend.tar.gz" ]; then
  echo "📦 Loading pre-compiled backend container..."
  docker load -i kloqo-backend.tar.gz
  rm -f kloqo-backend.tar.gz
  echo "✅ Backend container imported."
fi

if [ -f "kloqo-clinic-web.tar.gz" ]; then
  echo "📦 Loading pre-compiled web container..."
  docker load -i kloqo-clinic-web.tar.gz
  rm -f kloqo-clinic-web.tar.gz
  echo "✅ Web container imported."
fi

# ── Step 3: Check Configuration ──────────────────────────────────────────────
if [ ! -f ".env.local" ]; then
  echo "❌ .env.local configuration file missing!"
  echo "   Please copy .env.local.example to .env.local and fill in clinic settings."
  read -p "Press Enter to exit..."
  exit 1
fi

# ── Step 4: Start Services ───────────────────────────────────────────────────
echo ""
echo "🚀 Starting Kloqo local server..."
docker compose -f docker-compose.local.yml up -d

echo ""
echo "⏳ Waiting for server startup..."

MAX_RETRIES=30
RETRY=0
until curl -s http://localhost:3001/health > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ System startup timeout. Checking logs..."
    docker compose -f docker-compose.local.yml logs --tail=20
    read -p "Press Enter to exit..."
    exit 1
  fi
  sleep 2
done

echo ""
echo "✅ =============================================="
echo "✅  KLOQO IS ONLINE & READY"
echo "✅ =============================================="
echo "   🌐 Dashboard: http://localhost:3000"
echo ""

# Open browser automatically
if command -v open > /dev/null; then
  open http://localhost:3000
elif command -v xdg-open > /dev/null; then
  xdg-open http://localhost:3000
fi
