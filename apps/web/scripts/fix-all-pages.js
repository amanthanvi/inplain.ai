#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('Adding dynamic export to ALL pages...');

// Find all page.tsx files in the app directory
const pageFiles = glob.sync('src/app/**/page.tsx', {
  cwd: path.join(__dirname, '..'),
  absolute: true,
});

let updatedFiles = 0;
let skippedFiles = 0;

pageFiles.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Skip if already has dynamic export
  if (content.includes("export const dynamic")) {
    skippedFiles++;
    return;
  }

  // Skip API routes
  if (file.includes('/api/')) {
    skippedFiles++;
    return;
  }

  // Add dynamic export to ALL pages (except API routes)
  let insertIndex = -1;
  
  // Check if it has 'use client'
  const hasUseClient = content.includes("'use client'") || content.includes('"use client"');
  
  if (hasUseClient) {
    // Insert after 'use client'
    const useClientMatch = content.match(/['"]use client['"];?\s*\n/);
    if (useClientMatch && useClientMatch.index !== undefined) {
      insertIndex = useClientMatch.index + useClientMatch[0].length;
    }
  } else {
    // Insert at the beginning
    insertIndex = 0;
  }
  
  if (insertIndex !== -1) {
    // Insert the dynamic export
    const insertion = '\n// Force dynamic rendering to prevent static export\nexport const dynamic = \'force-dynamic\'\n';
    content = content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
    
    fs.writeFileSync(file, content, 'utf8');
    updatedFiles++;
    console.log(`Updated: ${path.relative(process.cwd(), file)}`);
  }
});

console.log(`\nTotal files updated: ${updatedFiles}`);
console.log(`Files skipped: ${skippedFiles}`);
console.log('Done!');