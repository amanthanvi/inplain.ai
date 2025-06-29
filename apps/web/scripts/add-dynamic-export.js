#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('Adding dynamic export to pages...');

// Find all page.tsx files in the app directory
const pageFiles = glob.sync('src/app/**/page.tsx', {
  cwd: path.join(__dirname, '..'),
  absolute: true,
});

let updatedFiles = 0;

pageFiles.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Skip if already has dynamic export
  if (content.includes("export const dynamic")) {
    return;
  }

  // Skip API routes
  if (file.includes('/api/')) {
    return;
  }

  // Check if it's a client component or uses hooks
  const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
  const usesHooks = content.includes('useState') || content.includes('useEffect') || content.includes('useAuth');
  const usesClerk = content.includes('@clerk/nextjs');
  
  if (isClientComponent || usesHooks || usesClerk) {
    // Find the right place to insert the export
    let insertIndex = -1;
    
    // Try to insert after imports
    const importMatches = content.matchAll(/^import[^;]+;$/gm);
    let lastImportIndex = -1;
    for (const match of importMatches) {
      if (match.index !== undefined) {
        lastImportIndex = match.index + match[0].length;
      }
    }
    
    if (lastImportIndex > -1) {
      // Insert after the last import
      content = content.slice(0, lastImportIndex) + 
        '\n\n// Force dynamic rendering to prevent static export\nexport const dynamic = \'force-dynamic\'' +
        content.slice(lastImportIndex);
      
      fs.writeFileSync(file, content, 'utf8');
      updatedFiles++;
      console.log(`Updated: ${path.relative(process.cwd(), file)}`);
    }
  }
});

console.log(`\nTotal files updated: ${updatedFiles}`);
console.log('Done!');