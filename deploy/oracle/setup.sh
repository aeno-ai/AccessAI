#!/usr/bin/env bash
# One-time setup of AccessAI on an Oracle Cloud "Always Free" ARM VM
# (Ubuntu 24.04). HANDOFF.md §53 and deploy/oracle/README.md.
#
#   bash deploy/oracle/setup.sh YOUR-NAME.duckdns.org
#
# Run it from the cloned repo, as the normal user (it asks for sudo), AFTER
# backend/.env is in place. Safe to run again.
set -euo pipefail

DOMAIN="${1:?Usage: bash deploy/oracle/setup.sh YOUR-NAME.duckdns.org}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_USER="$(id -un)"
say() { printf '\n\033[1;35m== %s\033[0m\n' "$*"; }

if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "backend/.env is missing. Copy deploy/oracle/backend.env.example to backend/.env and fill it in first."
  exit 1
fi

say "1/7 System packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git curl ca-certificates gnupg build-essential python3-venv python3-pip \
  debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

say "2/7 Node.js 24"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

say "3/7 Caddy (HTTPS) and Ollama (Laya's AI models)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

say "4/7 Firewall on the VM: allow web traffic (80, 443)"
# Oracle's Ubuntu images only allow SSH in iptables; the VCN security list
# must ALSO allow 80 and 443 (README step 1).
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
  fi
done
sudo netfilter-persistent save

say "5/7 App code: backend, admin website, AI service"
cd "$APP_DIR/backend" && npm ci --omit=dev
cd "$APP_DIR/admin" && npm ci && npm run build
sudo mkdir -p /var/www/accessai-admin
sudo rm -rf /var/www/accessai-admin/*
sudo cp -r "$APP_DIR/admin/dist/." /var/www/accessai-admin/
cd "$APP_DIR/ai"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements-server.txt

say "6/7 Laya's AI models (about 3 GB, once)"
ollama pull qwen2.5:3b
ollama pull bge-m3

say "7/7 Services (start at boot, restart if they stop) and HTTPS"
for unit in accessai-ai accessai-backend; do
  sed "s#__APP_DIR__#$APP_DIR#g; s#__USER__#$RUN_USER#g" "$APP_DIR/deploy/oracle/$unit.service" \
    | sudo tee "/etc/systemd/system/$unit.service" >/dev/null
done
sed "s#__DOMAIN__#$DOMAIN#g" "$APP_DIR/deploy/oracle/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now ollama accessai-ai accessai-backend
sudo systemctl restart accessai-ai accessai-backend
sudo systemctl reload caddy || sudo systemctl restart caddy

say "Done. Checking…"
sleep 5
curl -s "http://127.0.0.1:3000/api/health" || true
echo
echo "Open https://$DOMAIN/api/health (and the admin site at https://$DOMAIN/)."
echo "Logs: journalctl -u accessai-backend -f   |   journalctl -u accessai-ai -f   |   journalctl -u caddy -f"
