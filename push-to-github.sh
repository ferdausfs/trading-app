#!/usr/bin/env bash
# ============================================================
# TradeApp → GitHub push script (free, no extra tools needed)
#
# Usage:
#   GITHUB_TOKEN=ghp_xxxxxxxxxxxx bash push-to-github.sh
#   GITHUB_TOKEN=ghp_xxxxxxxxxxxx bash push-to-github.sh my-repo-name
#
# Token needs the classic "repo" scope. Create one here:
#   https://github.com/settings/tokens/new?scopes=repo&description=TradeApp%20push
#
# ⚠️  SECURITY RULES
#   - NEVER commit the token into any file (this script reads it
#     from the environment only).
#   - A token that was ever pasted into a chat must be treated
#     as leaked → revoke it after use.
# ============================================================
set -euo pipefail

TOKEN="${GITHUB_TOKEN:-}"
REPO_NAME="${1:-trading-app}"

if [ -z "$TOKEN" ]; then
  echo "✗ No token provided."
  echo "  Run:  GITHUB_TOKEN=ghp_xxx bash push-to-github.sh [repo-name]"
  exit 1
fi

cd "$(dirname "$0")"   # always run from the repo root

API="https://api.github.com"
AUTH=(-H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json")

echo "→ [1/5] Checking token..."
USER_JSON=$(curl -sS -m 20 "${AUTH[@]}" "$API/user" || true)
USER_NAME=$(echo "$USER_JSON" | sed -n 's/.*"login"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
if [ -z "$USER_NAME" ]; then
  echo "✗ Token invalid/expired or no 'repo' scope. GitHub said: $USER_JSON"
  exit 1
fi
echo "  ✓ GitHub user: ${USER_NAME}"

echo "→ [2/5] Creating repo '${REPO_NAME}' (201=created, 422=already exists — both fine)..."
CODE=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "${AUTH[@]}" -X POST "$API/user/repos" \
  -d "{\"name\":\"${REPO_NAME}\",\"private\":false,\"description\":\"Free real-time trading chart app - Next.js + Socket.IO + Binance + Expo\"}")
echo "  ✓ HTTP ${CODE}"

echo "→ [3/5] Committing local changes (if any)..."
git config user.name  >/dev/null 2>&1 || git config --local user.name  "TradeApp Dev"
git config user.email >/dev/null 2>&1 || git config --local user.email "dev@tradeapp.local"
git add -A
git commit -m "feat: TradeApp - real-time trading charts (web + android)" || echo "  (nothing new to commit)"

echo "→ [4/5] Setting remote + branch..."
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${TOKEN}@github.com/${USER_NAME}/${REPO_NAME}.git"

echo "→ [5/5] Pushing to main..."
git push -u origin main

echo ""
echo "✓ DONE → https://github.com/${USER_NAME}/${REPO_NAME}"
echo ""
echo "⚠️  Cleanup (recommended):"
echo "   git remote set-url origin https://github.com/${USER_NAME}/${REPO_NAME}.git"
echo "   ...then revoke the token: https://github.com/settings/tokens"
