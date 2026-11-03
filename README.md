# Métricas Vaz 3D: site

Site da loja de impressão 3D, com catálogo, página de cada produto, carrinho, orçamento sob encomenda com envio de fotos e pedido pelo WhatsApp.

O site é **gerado**: você edita os dados em `data/` e o gerador monta todas as páginas em `dist/`. Não precisa instalar nada além do [Node.js](https://nodejs.org) (versão 18 ou mais nova).

## Páginas

| Endereço | Conteúdo |
|---|---|
| `/` | Início: destaques, como é feito, categorias, materiais, dúvidas |
| `/produtos/` | Catálogo com filtros, busca e ordenação (`?categoria=brinquedos` abre já filtrado) |
| `/produtos/<nome-do-produto>/` | Uma página por produto, com link próprio para compartilhar |
| `/encomenda/` | Orçamento sob encomenda com envio de imagens |
| `/duvidas/` | Todas as perguntas frequentes |
| `/sobre/`, `/trocas/`, `/privacidade/` | Páginas institucionais (modelos para revisar) |

Também são gerados `robots.txt`, `sitemap.xml` (quando `url` estiver preenchido), dados estruturados para o Google (produto, preço, loja, perguntas frequentes) e a prévia de link para WhatsApp e Instagram em cada página.

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
scripts/              utilitários (gerar imagens dos produtos)
```

## Identidade visual

Cores e logotipo da MV 3D: preto, roxo-violeta (`#9B30FF`), azul elétrico (`#1E9BFF`) e prata. As cores ficam no início de `assets/css/site.css` (variáveis `--violet`, `--blue`, `--grad`). O logotipo está em `assets/img/` (`logo-original.webp` e versões menores) e os ícones do navegador em `static/`.

## Tarefas comuns

**Gerar o site**

```bash
node src/build.js
```

O gerador avisa o que falta preencher. Para ver o resultado, abra `dist/index.html` com um servidor local, por exemplo `npx serve dist`.

**Adicionar ou editar um produto:** edite `data/produtos.json`. Cada produto tem `id` (não mude depois de publicado), `ref`, `nome`, `cat`, `preco`, `material`, `tamanho`, `tempo`, `desc`, `cores` e `art`. O endereço da página é criado a partir do nome.

**Colocar fotos reais:** salve as fotos em `assets/img/produtos/` (de preferência quadradas, 1000 × 1000, em `.jpg` ou `.webp`) e liste no produto: `"fotos": ["dragao-1.jpg", "dragao-2.jpg"]`. A primeira foto vira a imagem do card, da prévia e do Google; com mais de uma, a página do produto mostra miniaturas.

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
