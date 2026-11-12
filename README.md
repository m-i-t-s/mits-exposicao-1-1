# MITS / 1:1 — site com os SVGs originais da exposição

Esta versão utiliza diretamente os **três SVGs enviados pela designer** como composição integral. Não há reconstrução em CSS do desenho, da planta gráfica, dos corpos, da marca ou dos botões. Apenas os campos de obra e as áreas transparentes de interação mudam dinamicamente.

## Arquivos visuais usados

- `public/assets/expografia-capa-original.svg` — capa original.
- `public/assets/expografia-ficha-disponivel-original.svg` — ficha original com estado "Disponível".
- `public/assets/expografia-ficha-indisponivel-original.svg` — ficha original com estado "Indisponível".

Ambos os SVGs de ficha possuem o **mapa gráfico definitivo** à direita. Seus números funcionam como seletores das posições 1 a 10; não existe uma planta técnica a ser adicionada ou redesenhada. A fotografia enviada para uma posição aparece dentro do retângulo preto central da ficha e o número correspondente recebe destaque amarelo.

## Fonte: PP Neue Montreal

Os próprios SVGs especificam **PPNeueMontreal-Book**, **PPNeueMontreal-Medium** e **PPNeueMontreal-Thin**. O arquivo `public/style.css` declara esses três estilos com as mesmas famílias e pesos. **As fontes NÃO estão incluídas no ZIP.** Para que o navegador reproduza fielmente a tipografia, adicione *arquivos webfont de sua própria licença* em `public/fonts/` com os nomes abaixo:

```
public/fonts/
  PPNeueMontreal-Book.woff2      (ou PPNeueMontreal-Book.otf)
  PPNeueMontreal-Medium.woff2    (ou PPNeueMontreal-Medium.otf)
  PPNeueMontreal-Thin.woff2      (ou PPNeueMontreal-Thin.otf)
```

Use `.woff2` quando disponível e quando a licença permitir hospedagem na web. Se os arquivos tiverem nomes diferentes, ajuste os caminhos em `public/style.css`, na seção `@font-face`. Sem os arquivos, a página ainda abre, mas o navegador usará uma fonte substituta e alguns textos podem ter medidas diferentes. Não publique fontes em repositório público sem licença de uso e distribuição web.

## Atualização do GitHub que já está conectado ao Netlify

1. Abra seu repositório `m-i-t-s/mits-exposicao-1-1` no GitHub.
2. Atualize **somente os arquivos alterados** de `public/` usando a versão deste ZIP, preservando `netlify/`, `netlify.toml` e `package.json`. Se preferir, você pode substituir todo o conteúdo do repositório pelo conteúdo deste ZIP: a API foi mantida.
3. Envie os três arquivos de fontes licenciadas para `public/fonts/` ou corrija os nomes se forem diferentes.
4. Clique em **Commit changes**. O Netlify deve implantar o novo commit automaticamente.
5. Atualize a página com Ctrl+F5 e teste capa, navegação pelo mapa, status e edição por senha.

O código de autenticação e de armazenamento foi preservado. As variáveis `ADMIN_PASSWORD` e `SESSION_SECRET` que você já cadastrou no Netlify permanecem vinculadas ao projeto. Os dados de obras salvos no mesmo projeto Netlify não são apagados pelo upload do código.

## O que pode ser alterado pelo painel

- Obra 1–10: artista, título, ano, técnica, dimensões, status e fotografia JPG/PNG/WebP de até 5 MB.
- Exposição: texto de curadoria, participantes e e-mail para contato.
- Estados: Disponível, Reservada, Vendida ou Indisponível.

A ilustração, a geometria do mapa, a marca e os componentes originais não são alterados pelo editor. Textos longos podem ser reduzidos **apenas dentro da área reservada à informação**, para evitar que avancem sobre a fotografia.

## Estrutura de publicação

O projeto usa `public/` como pasta de publicação e `netlify/functions/` como backend. As funções gravam os dados no Netlify Blobs, protegidas por senha armazenada nas variáveis de ambiente do Netlify. Não é necessário redigitar sua senha nem republicar o site para atualizar uma obra.

### Testes locais

Para abrir a interface local, use um servidor estático na pasta `public`. Para testar o acesso restrito e os dados reais, use o projeto Netlify publicado ou o Netlify CLI.
