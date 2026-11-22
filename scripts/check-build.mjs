import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

for (const directory of ['public','api','lib','test','scripts']) {
  for (const filename of await readdir(directory)) {
    if (!/\.m?js$/.test(filename)) continue;
    const path = directory + '/' + filename;
    const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(1);
  }
}
const html = await readFile('public/index.html', 'utf8');
for (const [, file] of html.matchAll(/(?:src|href)="\/([^"#?]+)"/g)) {
  await readFile('public/' + file);
}
console.log('Build verificado: sintaxis de módulos y recursos de entrada.');
