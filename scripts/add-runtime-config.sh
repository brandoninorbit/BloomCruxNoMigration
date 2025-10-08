#!/bin/bash

# Add runtime = 'nodejs' to all API routes that use supabaseAdmin

files=$(find src/app/api -name "route.ts" -type f | xargs grep -l "supabaseAdmin" | xargs grep -L "export const runtime")

echo "Adding runtime config to routes..."

for file in $files; do
  # Find the line number of the last import statement
  last_import=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)
  
  if [ -z "$last_import" ]; then
    echo "⚠ $file - no imports found, skipping"
    continue
  fi
  
  # Insert runtime config after the last import
  {
    head -n "$last_import" "$file"
    echo ""
    echo "// Force Node.js runtime for server-side operations (required for service role key)"
    echo "export const runtime = 'nodejs';"
    tail -n +$((last_import + 1)) "$file"
  } > "$file.tmp"
  
  mv "$file.tmp" "$file"
  echo "✓ $file - added runtime config"
done

echo ""
echo "Done! All routes updated."
