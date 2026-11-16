/* Liga o sistema completo no computador: banco (PocketBase) + loja + painel.
   Uso: npm run servidor   (ou: node scripts/servidor.js)
   Endereços: loja http://127.0.0.1:8090/  ·  painel http://127.0.0.1:8090/admin/ */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORTA = process.env.MV_PORTA || '8090';
const HOST = process.env.MV_HOST || '127.0.0.1';
const URL_LOCAL = `http://127.0.0.1:${PORTA}`;
const bin = path.join(ROOT, 'server', 'bin', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

if (!fs.existsSync(bin)) {
  console.error(`✖ PocketBase não encontrado em ${path.relative(ROOT, bin)}.
  Baixe a versão 0.40.6 para o seu sistema em https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6
  e coloque o arquivo "pocketbase${process.platform === 'win32' ? '.exe' : ''}" na pasta server/bin/.`);
  process.exit(1);
}

// a loja precisa existir antes de o servidor subir (o PocketBase serve a pasta dist/)
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) execFileSync(process.execPath, [path.join(ROOT, 'src/build.js')], { stdio: 'inherit' });

const pb = spawn(bin, [
  'serve', `--http=${HOST}:${PORTA}`,
  `--dir=${path.join(ROOT, 'server', 'pb_data')}`,
  `--hooksDir=${path.join(ROOT, 'server', 'pb_hooks')}`,
  `--migrationsDir=${path.join(ROOT, 'server', 'pb_migrations')}`,
  `--publicDir=${path.join(ROOT, 'dist')}`,
  '--indexFallback=false', '--automigrate=false',
], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MV_PB_URL: URL_LOCAL, MV_NODE: process.env.MV_NODE || process.execPath } });

// o PocketBase imprime um link de instalação do superusuário no primeiro uso: mostramos tudo
pb.stdout.on('data', d => process.stdout.write(d));
pb.on('exit', c => { console.log(`PocketBase encerrado (código ${c}).`); process.exit(c || 0); });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => pb.kill(s));

(async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${URL_LOCAL}/api/health`); if (r.ok) break; } catch (e) { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 500));
  }
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'src/build.js'), `--pb=${URL_LOCAL}`], { stdio: 'inherit' });
  } catch (e) { console.error('! Não foi possível gerar a loja com os dados do banco. Veja a mensagem acima.'); }
  console.log(`
  ┌──────────────────────────────────────────────────────────┐
    Loja:   ${URL_LOCAL}/
    Painel: ${URL_LOCAL}/admin/
    Banco (técnico, superusuário): ${URL_LOCAL}/_/
    Para desligar: Ctrl+C
  └──────────────────────────────────────────────────────────┘`);
})();
