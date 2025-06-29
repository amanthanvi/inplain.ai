#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('Updating Sentry and logger imports...');

// Find all TypeScript files
const files = glob.sync('src/**/*.{ts,tsx}', {
  cwd: path.join(__dirname, '..'),
  absolute: true,
});

let updatedFiles = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;

  // Update sentry-stub imports
  if (content.includes("from '@/lib/sentry-stub'")) {
    content = content.replace(
      /from '@\/lib\/sentry-stub'/g,
      "from '@/lib/sentry'"
    );
    updated = true;
  }

  // Update logger-stub imports
  if (content.includes("from '@/lib/logger-stub'")) {
    content = content.replace(
      /from '@\/lib\/logger-stub'/g,
      "from '@/lib/logger'"
    );
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(file, content, 'utf8');
    updatedFiles++;
    console.log(`Updated: ${path.relative(process.cwd(), file)}`);
  }
});

console.log(`\nTotal files updated: ${updatedFiles}`);
console.log('Done!');