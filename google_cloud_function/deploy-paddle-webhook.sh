#!/bin/bash
# =============================================================================
# Deploy the Paddle billing webhook (Cloud Function, gen2).
#
# Separate from deploy.sh on purpose: that script SETS the news pipeline's env
# vars and would clobber them, and the webhook must not share a URL, a secret or
# scaling behaviour with the news function. Same source directory, different
# --entry-point.
#
# THE SECRET IS NEVER PASSED ON THE COMMAND LINE. It is mounted from Google
# Secret Manager with --set-secrets, so it never appears in shell history, in
# `gcloud functions describe` output, or in this file. Sandbox and live are
# DIFFERENT Paddle notification destinations with DIFFERENT secrets.
#
# Usage:
#   ./deploy-paddle-webhook.sh sandbox     # safe: sandbox destination only
#   ./deploy-paddle-webhook.sh live        # real money — see the guard below
# =============================================================================

set -euo pipefail

PROJECT_ID="gen-lang-client-0324244302"
REGION="us-central1"
FUNCTION_NAME="paddleWebhook"
RUNTIME="nodejs20"

ENVIRONMENT="${1:-}"
if [[ "${ENVIRONMENT}" != "sandbox" && "${ENVIRONMENT}" != "live" ]]; then
  echo "Usage: $0 <sandbox|live>" >&2
  exit 1
fi

SECRET_NAME="paddle-webhook-secret-${ENVIRONMENT}"

# ---------------------------------------------------------------------------
# One-time setup, per environment (run by hand, never scripted with a value):
#
#   1. Create the notification destination in Paddle
#      (Developer tools → Notifications → New destination), subscribed to:
#        subscription.created, subscription.updated, subscription.canceled,
#        transaction.payment_failed
#      Copy its signing secret — Paddle shows it once.
#
#   2. Put it in Secret Manager WITHOUT it entering shell history. Use the
#      interactive prompt; do NOT use `echo "<value>" | gcloud ...`:
#
#        gcloud secrets create ${SECRET_NAME} --project=${PROJECT_ID} --replication-policy=automatic
#        read -rs PADDLE_SECRET && printf '%s' "$PADDLE_SECRET" | \
#          gcloud secrets versions add ${SECRET_NAME} --project=${PROJECT_ID} --data-file=- && \
#          unset PADDLE_SECRET
#
#   3. Grant the function's runtime service account read access:
#        gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
#          --project=${PROJECT_ID} \
#          --member="serviceAccount:<runtime-sa>@${PROJECT_ID}.iam.gserviceaccount.com" \
#          --role="roles/secretmanager.secretAccessor"
#
#   4. Deploy (this script), then paste the printed URL back into the Paddle
#      destination. Verify with a simulated event before any real checkout.
# ---------------------------------------------------------------------------

if [[ "${ENVIRONMENT}" == "live" ]]; then
  echo "=================================================================="
  echo "  LIVE Paddle webhook deploy — real customer money."
  echo "  Do NOT do this until:"
  echo "    - Paddle has approved the production domains, AND"
  echo "    - the live price ids are filled into paddleCatalogue.json, AND"
  echo "    - the sandbox flow has been verified end to end."
  echo "=================================================================="
  read -rp "Type 'deploy live' to continue: " CONFIRM
  [[ "${CONFIRM}" == "deploy live" ]] || { echo "Aborted."; exit 1; }
fi

echo "=== Deploying ${FUNCTION_NAME} (${ENVIRONMENT}) ==="

gcloud functions deploy "${FUNCTION_NAME}" \
  --gen2 \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --runtime="${RUNTIME}" \
  --source=. \
  --entry-point="${FUNCTION_NAME}" \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256MB \
  --timeout=60s \
  --max-instances=10 \
  --set-secrets="PADDLE_WEBHOOK_SECRET=${SECRET_NAME}:latest"

# --allow-unauthenticated is correct here: Paddle cannot present a Google
# identity token. The signature check IS the authentication, and the handler
# refuses every request that does not verify.

FUNCTION_URL=$(gcloud functions describe "${FUNCTION_NAME}" \
  --gen2 --project="${PROJECT_ID}" --region="${REGION}" \
  --format="value(serviceConfig.uri)")

echo ""
echo "=================================================================="
echo "Deployed. Webhook URL:"
echo "  ${FUNCTION_URL}"
echo ""
echo "Next: set this URL as the destination in Paddle (${ENVIRONMENT}),"
echo "then send a simulated subscription.created and confirm a 200."
echo ""
echo "Logs (no secrets are ever logged):"
echo "  gcloud functions logs read ${FUNCTION_NAME} --gen2 --region=${REGION} --limit=50"
echo ""
echo "Rollback:"
echo "  gcloud functions delete ${FUNCTION_NAME} --gen2 --project=${PROJECT_ID} --region=${REGION}"
echo "  (deleting the function stops all entitlement writes; the app falls back"
echo "   to admin-assigned subscriptions, exactly as before this feature.)"
echo "=================================================================="
