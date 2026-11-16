# Métricas Vaz 3D: loja e painel

Site da loja de impressão 3D, com catálogo, página de cada produto, carrinho, orçamento sob encomenda com envio de arquivos, calculadora de preço por STL e pedido pelo WhatsApp. Junto vem um **painel administrativo** para pedidos, projetos, estoque de filamento, clientes, produtos e financeiro.

O site é **gerado**: você edita os dados em `data/` e o gerador monta todas as páginas em `dist/`. Não precisa instalar nada além do [Node.js](https://nodejs.org) (versão 18 ou mais nova).

## Páginas

| Endereço | Conteúdo |
|---|---|
| `/` | Início: destaques, como é feito, categorias, materiais, dúvidas |
| `/produtos/` | Catálogo com filtros, busca e ordenação (`?categoria=brinquedos` abre já filtrado) |
| `/produtos/<nome-do-produto>/` | Uma página por produto, com link próprio para compartilhar |
| `/encomenda/` | Orçamento sob encomenda com envio de imagens e arquivos 3D |
| `/calculadora/` | Cliente envia o STL e vê uma faixa de preço na hora |
| `/admin/` | Painel administrativo (só com o servidor ligado) |
| `/duvidas/` | Todas as perguntas frequentes |
| `/sobre/`, `/trocas/`, `/privacidade/` | Páginas institucionais (modelos para revisar) |

Também são gerados `robots.txt`, `sitemap.xml` (quando `url` estiver preenchido), dados estruturados para o Google (produto, preço, loja, perguntas frequentes) e a prévia de link para WhatsApp e Instagram em cada página.

## Painel administrativo

O painel e o banco de dados rodam no [PocketBase](https://pocketbase.io) (um programa único, sem instalação). No computador:

1. Baixe o PocketBase **0.40.6** para o seu sistema em https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6 e coloque o executável em `server/bin/` (`pocketbase.exe` no Windows).
2. Rode `npm run servidor`.
3. Abra http://127.0.0.1:8090/admin/ e crie a conta do dono (primeiro acesso).
4. Em **Produtos**, clique em **Importar os produtos do site atual**.

| Tela | O que faz | Quem vê |
|---|---|---|
| Início | Pedidos novos, prazos da semana, carretéis acabando, resultado do mês | todos (valores só o dono) |
| Pedidos | Tudo que chega do site (carrinho, encomenda, sob consulta, calculadora) com os arquivos; vira projeto com um clique | todos |
| Projetos | Quadro por etapa (orçamento → entregue). Ao chegar em *Acabamento* o filamento é baixado do estoque; ao *aprovar* com preço, a conta a receber entra no financeiro | todos (preço e custo só o dono) |
| Estoque | Carretéis por material e cor, peso restante, alerta de mínimo, entradas, saídas, ajustes e histórico | todos |
| Clientes | Cadastro automático pelo WhatsApp e histórico de pedidos e projetos | todos |
| Produtos | Cadastro da loja com fotos, cores, preço ou *Sob consulta*; salvar publica a loja sozinho | dono |
| Financeiro | Entradas e saídas, contas a pagar e receber, taxas por forma de pagamento, lucro por projeto, gráfico de 6 meses e planilha para o contador | dono |
| Calculadora | Custo detalhado (filamento, energia, máquina, falhas, mão de obra, embalagem), preço sugerido e lucro | dono |
| Configurações | Tarifa de energia, valor da impressora, hora de trabalho, margem, taxas, materiais | dono |
| Equipe | Acessos de dono e equipe | dono |

**Catálogo interno:** em **Produtos → Catálogo interno** ficam modelos de terceiros só para consulta da equipe (ex.: a Coleção de Natal com 220 modelos do MakerWorld). Eles nunca aparecem na loja, mesmo marcados como visíveis. Para importar uma coleção, coloque `data/importar/<nome>.json` e as imagens em `data/importar/<nome>/` (pasta fora do Git) e clique em **Importar** no painel. Antes de vender um modelo de terceiro, confira na página dele se a licença permite vender impressões, troque a foto do designer por uma foto sua e desmarque “Catálogo interno”.

Produto **sem preço** (ou com *Sob consulta* marcado) aparece na loja com o botão **Solicitar orçamento**, que grava o pedido no painel e abre o WhatsApp.

Para publicar num servidor próprio, siga [docs/VPS.md](docs/VPS.md).

## Estrutura

```
data/site.json        configurações: WhatsApp, endereço do site, dados da empresa, redes, dúvidas
data/produtos.json    produtos, cores, categorias, materiais e destaques da página inicial
src/build.js          gerador das páginas
src/art.js            desenhos das peças (usados enquanto não houver foto)
src/partials/         blocos de HTML reaproveitados (início, encomenda, carrinho)
src/paginas/          textos de Sobre, Trocas e Privacidade
assets/               estilos, JavaScript do navegador e imagens
static/               ícones, imagem de prévia e manifesto (copiados para a raiz do site)
scripts/              utilitários (servidor.js liga o sistema; gerar imagens dos produtos)
admin/                painel administrativo (copiado para dist/admin/ quando o servidor gera a loja)
server/pb_migrations/ estrutura do banco e regras de acesso
server/pb_hooks/      regras de negócio (baixa de estoque, contas a receber, estimativa de preço, publicação)
server/pb_hooks/lib/calc.js  cálculo de custo e preço (o mesmo no servidor e no painel)
docs/VPS.md           como publicar num servidor próprio
```

Com o servidor ligado, o gerador lê os produtos do banco (`node src/build.js --pb=http://127.0.0.1:8090`). Sem ele, lê `data/produtos.json` e gera uma loja estática que funciona no Netlify, mas sem painel, sem calculadora de preço e com os pedidos indo só pelo WhatsApp.

## Identidade visual

Cores e logotipo da MV 3D: preto, roxo-violeta (`#9B30FF`), azul elétrico (`#1E9BFF`) e prata. As cores ficam no início de `assets/css/site.css` (variáveis `--violet`, `--blue`, `--grad`). O logotipo está em `assets/img/` (`logo-original.webp` e versões menores) e os ícones do navegador em `static/`.

## Tarefas comuns

**Gerar o site**

```bash
node src/build.js
```

O gerador avisa o que falta preencher. Para ver o resultado, abra `dist/index.html` com um servidor local, por exemplo `npx serve dist`.

**Versão com links relativos** (para abrir os arquivos direto do computador, mandar uma prévia ou publicar no GitHub Pages sem domínio):

```bash
node src/build.js --relativo --saida=preview
```

Gera a pasta `preview/`, em que todos os links são relativos e terminam em `index.html`.

**Adicionar ou editar um produto:** edite `data/produtos.json`. Cada produto tem `id` (não mude depois de publicado), `ref`, `nome`, `cat`, `preco`, `material`, `tamanho`, `tempo`, `desc`, `cores` e `art`. O endereço da página é criado a partir do nome.

**Colocar fotos reais:** salve as fotos em `assets/img/produtos/` (de preferência quadradas, 1000 × 1000, em `.jpg` ou `.webp`) e liste no produto: `"fotos": ["dragao-1.jpg", "dragao-2.jpg"]`. A primeira foto vira a imagem do card, da prévia e do Google; com mais de uma, a página do produto mostra miniaturas.

Formato recomendado: a foto em `.webp` (leve, para o site) e uma cópia `.jpg` com o mesmo nome (ex.: `dragao.webp` + `dragao.jpg`). Liste só o `.webp` em `fotos`; o gerador usa o `.jpg` automaticamente na prévia do WhatsApp e do Google, que nem sempre mostram WebP.

As fotos atuais (`assets/img/produtos/<id>.webp`) são **imagens ilustrativas geradas por IA**, no mesmo fundo cinza-claro. Ao fotografar as peças de verdade, use fundo liso claro, luz difusa (janela ou softbox) e enquadramento quadrado para manter o catálogo uniforme, e substitua os arquivos com o mesmo nome. Para destacar uma categoria da página inicial com foto, use `"foto": "<id do produto>"` em `tipos` (`data/site.json`).

**Foto da impressora:** salve uma foto da sua Kobra X como `assets/img/estudio/kobra-x.webp` (quadrada, ~1000 × 1000) e gere o site de novo. Ela aparece na página Sobre, ao lado das especificações (`impressora` em `data/site.json`).

**Google:** em `data/site.json`, `google_analytics` recebe o ID do GA4 (ex.: `G-ABC123XYZ`) e `google_verificacao` o código da tag meta do Search Console. Vazios, não aparecem no site.

**Trocar os destaques da página inicial:** edite `destaques` em `data/produtos.json`.

**Mudar número do WhatsApp, horário ou prazos:** `data/site.json`.

## Antes de divulgar

1. Preencha os campos `[PREENCHER]` em `data/site.json` (`empresa`) e em `src/paginas/`. Eles aparecem destacados em amarelo no site e são listados pelo gerador.
2. Revise as páginas de Trocas e Privacidade com um contador ou advogado.
3. Confira o número do WhatsApp em `data/site.json`.
4. Depois de publicar, coloque o endereço em `url` (ex.: `"https://metricasvaz3d.com.br/"`) e gere de novo. Isso ativa o `sitemap.xml`, os endereços oficiais das páginas e a imagem completa na prévia do WhatsApp.
5. Cadastre o site no [Google Search Console](https://search.google.com/search-console) e envie o `sitemap.xml`.

## Publicar no Netlify (grátis)

1. Envie esta pasta para um repositório no GitHub.
2. No [Netlify](https://app.netlify.com), escolha **Add new site → Import an existing project → GitHub** e selecione o repositório.
3. As configurações já vêm do `netlify.toml` (comando `node src/build.js`, pasta `dist`). Clique em **Deploy**.

A cada alteração enviada ao GitHub, o Netlify gera e publica o site sozinho. Para usar um domínio próprio, vá em **Domain management** no Netlify.

## Imagens dos produtos (opcional)

`assets/img/produtos/*.png` são geradas a partir dos desenhos e usadas na prévia do link de cada produto. Para gerar de novo depois de mudar produtos:

```bash
npm i -D playwright
npx playwright install chromium
node scripts/gerar-imagens.js
```

Produtos com fotos reais são pulados.
