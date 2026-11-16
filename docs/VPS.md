# Colocar o sistema num VPS

Guia para publicar a loja, o painel e o banco num servidor próprio (VPS) com Ubuntu 24.04.
Tudo roda num programa só (PocketBase) atrás do Caddy, que cuida do HTTPS.

```
visitante ──HTTPS──▶ Caddy (porta 443) ──▶ PocketBase 127.0.0.1:8090
                                           ├─ /         loja (pasta dist/)
                                           ├─ /admin/   painel
                                           ├─ /api/     banco e regras
                                           └─ /_/       painel técnico do banco (superusuário)
```

## 1. Contratar e preparar

- VPS com **1 a 2 GB de memória**, Ubuntu 24.04, de preferência com datacenter no Brasil.
- No painel do seu domínio, crie um registro **A** apontando `seudominio.com.br` (e `www`) para o IP do VPS.
- Acesse o servidor por SSH e instale o necessário:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git unzip curl debian-keyring debian-archive-keyring apt-transport-https
# Node.js 20 (gera as páginas da loja)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
# Caddy (HTTPS automático)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
# firewall: só SSH e web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

## 2. Instalar o sistema

```bash
sudo useradd --system --create-home --home-dir /opt/metricas-vaz mv
sudo -u mv git clone https://github.com/pedrohvaz/Metricas-Vaz-3D.git /opt/metricas-vaz/app
cd /opt/metricas-vaz/app
sudo -u mv mkdir -p server/bin
sudo -u mv curl -fL -o /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_linux_amd64.zip
sudo -u mv unzip -o /tmp/pb.zip pocketbase -d server/bin && sudo chmod +x server/bin/pocketbase
```

Antes de publicar, preencha em `data/site.json` o campo `"url"` com o endereço final (ex.: `"https://seudominio.com.br/"`).

## 3. Ligar como serviço (liga sozinho quando o VPS reinicia)

Crie uma chave de instalação longa (ela só serve para criar o primeiro dono):

```bash
openssl rand -hex 16
```

Crie o arquivo `/etc/systemd/system/metricas-vaz.service`:

```ini
[Unit]
Description=Métricas Vaz 3D (loja, painel e banco)
After=network.target

[Service]
User=mv
WorkingDirectory=/opt/metricas-vaz/app
Environment=MV_HOST=127.0.0.1
Environment=MV_PORTA=8090
Environment=MV_CHAVE_INSTALACAO=COLE_A_CHAVE_AQUI
ExecStart=/usr/bin/node scripts/servidor.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now metricas-vaz
sudo journalctl -u metricas-vaz -n 50   # ver se subiu
```

## 4. HTTPS com o Caddy

Troque o conteúdo de `/etc/caddy/Caddyfile` por:

```
seudominio.com.br, www.seudominio.com.br {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8090
}
```

```bash
sudo systemctl reload caddy
```

O certificado HTTPS é emitido sozinho em alguns segundos.

## 5. Primeiros acessos

1. **Dono do sistema:** abra `https://seudominio.com.br/admin/`, preencha nome, e-mail, senha e a **chave de instalação** do passo 3. Depois disso a chave não serve para mais nada.
2. **Superusuário do banco** (backups e manutenção): no servidor, rode
   `sudo -u mv /opt/metricas-vaz/app/server/bin/pocketbase superuser upsert seu@email.com 'SENHA-FORTE' --dir=/opt/metricas-vaz/app/server/pb_data`
   e entre em `https://seudominio.com.br/_/`.
3. No painel, em **Produtos**, clique em **Importar os produtos do site atual** (só na primeira vez).

## 6. Backups

- O banco faz backup automático **todo dia às 3h** e guarda os 14 últimos (`server/pb_data/backups`).
- Para ter cópia fora do VPS: em `/_/` → Settings → Backups, ative o envio para um armazenamento S3 (Backblaze B2, Cloudflare R2, AWS) ou baixe um backup por semana.
- **Restaurar:** `/_/` → Settings → Backups → escolha o arquivo → Restore.

## 7. Atualizar o sistema

```bash
cd /opt/metricas-vaz/app && sudo -u mv git pull && sudo systemctl restart metricas-vaz
```

O banco (`server/pb_data/`) não é afetado pelo `git pull`. Alterações de estrutura vêm em `server/pb_migrations/` e são aplicadas sozinhas ao reiniciar.

## 8. Levar os dados do computador para o VPS

Se você usou o sistema no computador antes de contratar o VPS:

1. Pare o sistema no computador (Ctrl+C).
2. Copie a pasta `server/pb_data/` inteira para `/opt/metricas-vaz/app/server/pb_data/` no VPS (pelo WinSCP ou `scp -r`).
3. No VPS: `sudo chown -R mv:mv /opt/metricas-vaz/app/server/pb_data && sudo systemctl restart metricas-vaz`.
