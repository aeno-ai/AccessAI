#!/usr/bin/env bash
# Puts the newest code from GitHub on the server (HANDOFF.md §53):
#
#   bash deploy/oracle/update.sh
#
# Pulls, reinstalls what changed, rebuilds the admin website and restarts
# the services (a few seconds offline; phones reconnect by themselves).
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$APP_DIR"
git pull --ff-only

cd "$APP_DIR/backend" && npm ci --omit=dev
cd "$APP_DIR/admin" && npm ci && npm run build
sudo rm -rf /var/www/accessai-admin/*
sudo cp -r "$APP_DIR/admin/dist/." /var/www/accessai-admin/
cd "$APP_DIR/ai" && .venv/bin/pip install -r requirements-server.txt

sudo systemctl restart accessai-ai accessai-backend
sleep 5
curl -s "http://127.0.0.1:3000/api/health" && echo
