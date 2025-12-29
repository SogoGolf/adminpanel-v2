#!/bin/bash
# Deploy sogo-admin-panel-v2 to Cloud Run
# Run from project root: sh scripts/deploy.sh

gcloud run deploy sogo-admin-panel \
    --source . \
    --region us-central1 \
    --project=sogo-golf \
    --allow-unauthenticated
