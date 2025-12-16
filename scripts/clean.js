#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function rm(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

const root = process.cwd();
rm(path.join(root, 'build'));
rm(path.join(root, '.next'));
console.log('[clean] diretórios de build limpos');



