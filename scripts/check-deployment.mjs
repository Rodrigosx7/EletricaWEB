import { readFile } from 'node:fs/promises';

const url = process.argv[2] ?? 'https://portal-eletrico.netlify.app/';
const localHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
if (!response.ok) throw new Error(`A publicação respondeu HTTP ${response.status}.`);
const liveHtml = await response.text();

function entry(html) {
  const match = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/i);
  if (!match) throw new Error('Não foi possível identificar o arquivo principal da página.');
  return match[1];
}

const localEntry = entry(localHtml);
const liveEntry = entry(liveHtml);
console.log(`Build local: ${localEntry}`);
console.log(`Site publicado: ${liveEntry}`);
if (localEntry !== liveEntry) {
  console.error('A Netlify ainda não publicou este build. Confira a ligação ao repositório, a branch de produção e o último deploy.');
  process.exitCode = 1;
} else {
  console.log('O arquivo principal do build local está publicado.');
}
