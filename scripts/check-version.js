#!/usr/bin/env node

/**
 * Version sync check
 * Ensures src/version.ts matches package.json
 */

const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const versionTs = fs.readFileSync(path.join(__dirname, '../src/version.ts'), 'utf-8');

const packageVersion = packageJson.version;
const versionMatch = versionTs.match(/export const VERSION = '([^']+)'/);

if (!versionMatch) {
  console.error('❌ Could not find VERSION in src/version.ts');
  process.exit(1);
}

const sourceVersion = versionMatch[1];

if (packageVersion !== sourceVersion) {
  console.error(`❌ Version mismatch!`);
  console.error(`   package.json: ${packageVersion}`);
  console.error(`   src/version.ts: ${sourceVersion}`);
  console.error('');
  console.error('Please update src/version.ts to match package.json');
  process.exit(1);
}

console.log(`✅ Version sync OK: ${packageVersion}`);
