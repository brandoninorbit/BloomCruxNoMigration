#!/bin/bash

echo "🔧 Production Deployment Fix Script"
echo "===================================="
echo ""

echo "Step 1: Removing old environment variable (if exists)..."
vercel env rm SUPABASE_SERVICE_ROLE_KEY production -y 2>/dev/null || true

echo ""
echo "Step 2: Adding SUPABASE_SERVICE_ROLE_KEY to production..."
# Get the key from .env.local
SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | cut -d'=' -f2 | tr -d '"')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ ERROR: Could not find SUPABASE_SERVICE_ROLE_KEY in .env.local"
  exit 1
fi

echo "$SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo ""
echo "Step 3: Redeploying with environment variable..."
vercel --prod --force

echo ""
echo "✅ Done! Check the deployment logs for any errors."
echo ""
echo "🧪 Test the debug endpoint:"
echo "   curl https://your-domain.com/api/debug/env-check"
