/**
 * One-time build script: extract MedExpress keyword rules from compiled bundle.
 * Usage: node scripts/extract-medexpress-rules.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(
  __dirname,
  '../../medexpress SCR/compiled/keywords-tool.js'
);
const outPath = path.resolve(__dirname, '../src/config/medexpress.rules.json');

const src = fs.readFileSync(srcPath, 'utf8');
const start = src.indexOf('const sn=[');
const end = src.indexOf('];function je', start);

if (start < 0 || end < 0) {
  console.error('Could not locate rules array in keywords-tool.js');
  process.exit(1);
}

let chunk = src.slice(start + 'const sn='.length, end + 1);
chunk = chunk.replace(/!0/g, 'true').replace(/!1/g, 'false');
chunk = chunk.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

let rules;
try {
  rules = JSON.parse(chunk);
} catch (err) {
  console.error('JSON parse failed:', err.message);
  fs.writeFileSync(path.resolve(__dirname, '../tmp-rules-chunk.txt'), chunk.slice(0, 8000));
  process.exit(1);
}

console.log(`Extracted ${rules.length} rules`);
for (const r of rules) {
  console.log(`  ${r.id} ${r.name}: ${r.keywords.length} keywords`);
}

fs.writeFileSync(outPath, JSON.stringify(rules, null, 2));
console.log('Wrote', outPath);
