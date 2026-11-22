import { readFile, readdir } from 'node:fs/promises';

const patterns = [
  /sb_secret_[\w-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /gh[pousr]_[\w]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/
];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git','node_modules','.vercel'].includes(entry.name)) continue;
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) await scan(path);
    else if (/\.(?:html|css|m?js|json|md|sql|ya?ml|env)$/i.test(entry.name) || entry.name.startsWith('.env')) {
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') throw new Error('Archivo de credenciales: ' + path);
      const source = await readFile(path, 'utf8');
      if (patterns.some(pattern => pattern.test(source))) throw new Error('Posible credencial en ' + path);
    }
  }
}
await scan('.');
console.log('Escaneo de secretos: sin coincidencias con los patrones configurados.');
