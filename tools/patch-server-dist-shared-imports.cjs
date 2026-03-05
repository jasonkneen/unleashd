#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const patches = [
  {
    file: 'server/dist/server.js',
    from: 'require("@unleashd/shared")',
    to: 'require("../../shared/dist/index.js")',
  },
  {
    file: 'server/dist/adapters/jsonl.js',
    from: 'require("@unleashd/shared")',
    to: 'require("../../../shared/dist/index.js")',
  },
];

for (const patch of patches) {
  const filePath = path.join(root, patch.file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes(patch.from)) {
    throw new Error(`Expected import not found in ${patch.file}`);
  }

  const updated = content.split(patch.from).join(patch.to);
  fs.writeFileSync(filePath, updated);
}

console.log('Patched server dist shared imports for npm package runtime.');
