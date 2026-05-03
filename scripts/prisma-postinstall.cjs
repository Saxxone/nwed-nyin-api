'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const prismaPkg = path.join(root, 'node_modules', 'prisma', 'package.json');

if (process.env.SKIP_PRISMA_GENERATE === '1') {
  console.log('Skipping prisma generate (SKIP_PRISMA_GENERATE=1).');
  process.exit(0);
}

if (!fs.existsSync(prismaPkg)) {
  console.log(
    'Skipping prisma generate (no prisma CLI — use a pre-generated client in src/generated/prisma).',
  );
  process.exit(0);
}

const r = spawnSync('npx', ['prisma', 'generate'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(r.status === null ? 1 : r.status);
