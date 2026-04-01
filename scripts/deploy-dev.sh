#!/bin/bash
set -euo pipefail

# Deploy sogo-admin-panel-v2 dev site to Cloud Run
# Run from project root: sh scripts/deploy-dev.sh

TEMP_ENV_FILE=".env.production"
BACKUP_ENV_FILE=".env.production.backup-for-dev-deploy"

cleanup() {
    if [ -f "$BACKUP_ENV_FILE" ]; then
        mv "$BACKUP_ENV_FILE" "$TEMP_ENV_FILE"
    else
        rm -f "$TEMP_ENV_FILE"
    fi
}

trap cleanup EXIT

if [ -f "$TEMP_ENV_FILE" ]; then
    cp "$TEMP_ENV_FILE" "$BACKUP_ENV_FILE"
fi

cat > "$TEMP_ENV_FILE" <<'EOF'
VITE_API_PROVIDER=mongodb
VITE_MONGODB_API_URL=https://mongo-api-test-613362712202.australia-southeast1.run.app
VITE_APP_ENV=development
VITE_ENV_BANNER_TEXT=DEV SITE
EOF

gcloud run deploy sogo-admin-panel-dev \
    --source . \
    --region us-central1 \
    --project=sogogolf-dev \
    --allow-unauthenticated
