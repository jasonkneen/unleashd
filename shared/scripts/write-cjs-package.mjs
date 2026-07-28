import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cjsUrl = new URL('../dist/cjs/', import.meta.url);
await mkdir(fileURLToPath(cjsUrl), { recursive: true });
await writeFile(new URL('package.json', cjsUrl), '{\n  "type": "commonjs"\n}\n', 'utf8');
