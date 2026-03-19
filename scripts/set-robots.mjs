import fs from 'node:fs';
import path from 'node:path';

const modeArg = process.argv[2];
const mode = modeArg === 'os' ? 'os' : 'public';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');

const src = path.join(publicDir, mode === 'os' ? 'robots.os.txt' : 'robots.public.txt');
const dest = path.join(publicDir, 'robots.txt');

fs.copyFileSync(src, dest);
console.log(`robots.txt set for mode: ${mode}`);

