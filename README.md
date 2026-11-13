# MITS Galeria · 1:1 — Site com os SVGs originais, desktop e mobile

Este projeto usa diretamente os **12 SVGs enviados**: seis desktop (1920 × 1080) e seis mobile (390 × 844). Não recria a composição com blocos de HTML ou CSS. O JavaScript carrega o SVG correto para o formato de tela e posiciona somente a fotografia, os dados editáveis e as áreas transparentes de interação.

## Qual arquivo é usado

| Tela | Claro | Escuro |
|---|---|---|
| Capa desktop | `public/assets/expografia-capa-claro.svg` | `public/assets/expografia-capa-escuro.svg` |
| Ficha disponível desktop | `public/assets/expografia-ficha-disponivel-claro.svg` | `public/assets/expografia-ficha-disponivel-escuro.svg` |
| Ficha indisponível desktop | `public/assets/expografia-ficha-indisponivel-claro.svg` | `public/assets/expografia-ficha-indisponivel-escuro.svg` |
| Capa mobile | `public/assets/expografia-capa-claro-mobile.svg` | `public/assets/expografia-capa-escuro-mobile.svg` |
| Ficha disponível mobile | `public/assets/expografia-ficha-disponivel-claro-mobile.svg` | `public/assets/expografia-ficha-disponivel-escuro-mobile.svg` |
| Ficha indisponível mobile | `public/assets/expografia-ficha-indisponivel-claro-mobile.svg` | `public/assets/expografia-ficha-indisponivel-escuro-mobile.svg` |

Em telas verticais com largura até 740 px, o site usa os SVGs mobile. No restante, usa os SVGs desktop. O layout mobile mantém a proporção original de 390 × 844 e aceita rolagem vertical quando a altura do celular for menor. Nenhum botão possui mancha de hover. O mapa é o desenho gráfico final da exposição.

## Atualizar o projeto no GitHub/Netlify

1. Extraia o ZIP.
2. Abra `m-i-t-s/mits-exposicao-1-1` no GitHub.
3. Faça upload **dos arquivos e subpastas** do ZIP preservando a estrutura de diretórios. Na raiz do repositório devem ficar `public/`, `netlify/`, `package.json`, `netlify.toml` e `README.md`. **Não** coloque todos esses itens dentro de uma pasta adicional.
4. Confirme a substituição dos arquivos de mesmo nome e faça **Commit changes**.
5. O Netlify, já conectado ao repositório, publica o novo commit automaticamente. Abra o site no celular e confira também o modo escuro.

As variáveis de ambiente `ADMIN_PASSWORD` e `SESSION_SECRET` já cadastradas permanecem no projeto Netlify. Nunca envie seus valores ao GitHub. Os dados armazenados em Netlify Blobs não são substituídos por uma atualização de arquivos estáticos.

## Acesso administrativo

Na **capa**, clique no ícone de perfil: no desktop ele está embaixo, à direita; no mobile ele está **no alto, à direita**. Entre com a senha configurada em `ADMIN_PASSWORD`.

- Aba **OBRA**: posição 1–10, artista, título, ano, técnica, dimensões, disponibilidade e imagem (JPG/PNG/WebP de até 5 MB).
- Aba **EXPOSIÇÃO**: curadoria, artistas e e-mail de contato.

As dez obras e as fotografias são as mesmas para desktop e mobile; não precisam de dois cadastros. O backend usa funções do Netlify e Netlify Blobs. **O login e a persistência real devem ser validados no Netlify publicado**; os testes locais usaram respostas de exemplo, sem alterar dados do projeto online.

## Fontes da MITS

A família PP Neue Montreal **não está incluída** no pacote. Mantenha seus arquivos licenciados nas rotas de `public/fonts` mencionadas em `public/style.css`, com os nomes `PPNeueMontreal-Book`, `PPNeueMontreal-Medium` e `PPNeueMontreal-Thin`, no formato `.woff2` ou `.otf`. É necessário ter licença apropriada para hospedar essas fontes publicamente. Se a fonte não for carregada, o navegador poderá mudar as métricas de nomes e outros textos editáveis.

## Observação sobre o SVG mobile 09

O SVG original `site expografia claro mobile-09.svg` foi enviado **sem o símbolo M e sem o ícone da lua** no canto superior esquerdo, ao contrário da ficha disponível (08). Ele foi mantido fiel ao arquivo enviado. As áreas de clique continuam disponíveis nas coordenadas correspondentes, mas os ícones não aparecem nessa ficha. Para exibir os ícones, é preferível corrigir o próprio SVG 09 e substituir apenas o respectivo arquivo em `public/assets/`.

## Verificações feitas

- Sintaxe JavaScript sem erros (`public/app.js` e `netlify/functions/api.mjs`).
- Navegação desktop e mobile, mapa 1–10, destaque selecionado, número ampliado, modo claro/escuro e abertura do login.
- Testes em navegador com 390 × 844, 375 × 667 e 1440 × 810 px. Em telas mais baixas, há rolagem vertical.
