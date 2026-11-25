#!/bin/bash
set -euo pipefail

# Deploy sogo-admin-panel-v2 dev site to Cloud Run
# Run from project root: sh scripts/deploy-dev.sh
#
# The DEV site signs in with the sogogolf-dev Firebase project (its own accounts and passwords),
# never sogo-golf, so DEV testing (e.g. password resets) cannot change production sign-ins.
# These Firebase web settings are public client values, the same kind that ship in every build.
# Run as the SimpleGolf gcloud login: CLOUDSDK_CORE_ACCOUNT=sogodeveloper@gmail.com sh scripts/deploy-dev.sh

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
VITE_ENV_BANNER_TEXT=DEV SITE (DEV passwords, not production)
VITE_FIREBASE_PROJECT_ID=sogogolf-dev
VITE_FIREBASE_API_KEY=AIzaSyAAvH_ImqAaQGRjpnf_MNEMDr5MXq0ucQo
VITE_FIREBASE_AUTH_DOMAIN=sogogolf-dev.firebaseapp.com
VITE_FIREBASE_APP_ID=1:613362712202:web:ff16547ea6370f6639f773
VITE_FIREBASE_STORAGE_BUCKET=sogogolf-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=613362712202
EOF

gcloud run deploy sogo-admin-panel-dev \
    --source . \
    --region us-central1 \
    --project=sogogolf-dev \
    --allow-unauthenticated
