#!/bin/bash

# Debug script to check production deployment issues

echo "🔍 Checking Production Deployment..."
echo ""

echo "1️⃣ Checking if service role key is set in production..."
vercel env ls production | grep SUPABASE_SERVICE_ROLE_KEY

echo ""
echo "2️⃣ Getting recent production logs..."
vercel logs --prod -n 50

echo ""
echo "3️⃣ Checking production environment variables..."
vercel env pull .env.production

echo ""
echo "✅ Debug info collected. Check above for any errors."
