#!/usr/bin/env node

/**
 * Add runtime = 'nodejs' to all API routes that use supabaseAdmin
 * This ensures they run on Node.js runtime (not Edge) where service role key is available
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Find all route.ts files in src/app/api that import supabaseAdmin
const routeFiles = execSync(
  `grep -l "supabaseAdmin" src/app/api/**/route.ts`,
  { encoding: 'utf-8', cwd: rootDir }
)
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${routeFiles.length} routes using supabaseAdmin:`);

routeFiles.forEach(file => {
  const fullPath = path.join(rootDir, file);
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Check if runtime is already set
  if (content.includes('export const runtime')) {
    console.log(`✓ ${file} - already has runtime config`);
    return;
  }
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || lines[i].startsWith('import{')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex === -1) {
    console.log(`⚠ ${file} - no imports found, skipping`);
    return;
  }
  
  // Insert runtime config after imports
  lines.splice(
    lastImportIndex + 1,
    0,
    '',
    "// Force Node.js runtime for server-side operations (required for service role key)",
    "export const runtime = 'nodejs';"
  );
  
  fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
  console.log(`✓ ${file} - added runtime config`);
});

console.log('\nDone! All routes updated.');
