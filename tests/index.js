// `node --test tests/` resolves the directory to this file on recent Node versions.
const fs = require('node:fs');
const path = require('node:path');
for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.mjs')).sort()) import(path.join(__dirname, f));
