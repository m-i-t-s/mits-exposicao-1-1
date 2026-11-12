# MITS Galeria — 1:1

Site de exposição baseado no layout WEBP fornecido. Front-end responsivo em HTML/CSS/JavaScript, mapa gráfico vetorial SVG e painel de edição protegido por senha. Pensado para hospedagem por repositório GitHub com deploy no Netlify.

## O que funciona

- Apresentação inicial 1:1, ilustrações amarelas, textos dos artistas e marca MITS.
- Navegação entre 10 obras, por setas ou por números no mapa.
- Ficha da obra com artista, título, ano, técnica, dimensões, status e fotografia.
- Botão **CONTATO**, que abre e-mail com assunto e identificação da obra quando o e-mail estiver cadastrado.
- Alternância entre modos claro e escuro e layout adaptado a celular.
- Painel de equipe com senha, acessível pelo ícone de perfil.
- Atualização de status (Disponível, Reservada, Vendida, Indisponível), foto e dados de cada obra, além de curadoria, lista de artistas e e-mail de contato.
- Salvamento persistente no Netlify Blobs, sem precisar publicar novamente a cada mudança.

## Mapa da exposição — arte final

**O mapa existente em `public/assets/planta.svg` é a arte final aprovada para esta interface.** É um desenho esquemático e gráfico da exposição, não uma planta arquitetônica técnica. Preservar sua geometria, proporções e linguagem visual. Não precisa ser substituído por uma planta mais detalhada.

- O mapa exibe dez números, correspondentes às dez posições das obras. Clique em qualquer número para navegar.
- O número da obra selecionada recebe destaque amarelo.
- O **grande retângulo preto no centro da ficha** é o espaço da fotografia da obra. Ao cadastrar a imagem no painel, ela substitui o preenchimento preto desse quadro; a imagem **não** deve ser inserida nas paredes ou áreas do mapa.
- Artista, título, ano, técnica, dimensões e status são atualizados no painel esquerdo conforme a posição selecionada.
- Todos os dados podem ser alterados no painel administrativo sem editar o SVG nem republicar o site.

Se no futuro houver mudança na disposição das posições, ajuste o próprio SVG e, se necessário, as coordenadas de `POSITIONS` em `public/app.js`.

## Como publicar no Netlify

1. Crie um repositório GitHub e envie **todo o conteúdo desta pasta** para a raiz do repositório: `public/`, `netlify/`, `netlify.toml` e `package.json`.
2. No Netlify escolha **Add new project → Import an existing project**, conecte o repositório GitHub e use a configuração detectada. O diretório de publicação está em `public` e as funções em `netlify/functions`.
3. Em **Project configuration → Environment variables**, cadastre **duas variáveis SECRETAS** no ambiente de produção:

   - `ADMIN_PASSWORD` = senha forte escolhida pela equipe, com pelo menos 12 caracteres.
   - `SESSION_SECRET` = sequência aleatória com pelo menos 32 caracteres. Pode gerar no Terminal com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

4. Execute o deploy/redeploy. Acesse o endereço Netlify, clique no ícone de perfil e entre com a senha.
5. Na aba **EXPOSIÇÃO**, cadastre o e-mail para o botão Contato. Na aba **OBRA**, selecione uma das 10 posições, preencha e salve. As atualizações aparecem no site público.

**Não publique apenas a pasta `public` via drag-and-drop**, pois a parte administrativa depende das Netlify Functions, das dependências de `package.json` e do armazenamento Netlify Blobs. A senha **não pode** ser escrita no JavaScript público nem no repositório.

O armazenamento é **site-wide**: os dados permanecem entre deploys do mesmo projeto Netlify. Projetos Netlify diferentes não compartilham automaticamente o catálogo. Não teste edições em uma prévia de deploy ligada ao mesmo site sem perceber que ela pode usar o armazenamento de produção.

## Testar localmente

Com Node.js instalado:

```sh
npm install
npx netlify dev
```

Para experimentar o acesso restrito localmente, defina `ADMIN_PASSWORD` e `SESSION_SECRET` no ambiente do Netlify CLI. Abrir `index.html` diretamente ou servir apenas a pasta `public` mostra a apresentação visual, mas não ativa o banco de dados nem a administração.

## Estrutura de arquivos

```
public/
  index.html            telas da exposição e editor
  style.css             identidade visual e responsividade
  app.js                navegação, sincronização do mapa e editor
  assets/
    planta.svg        mapa gráfico FINAL da exposição, com dez posições numeradas
    corpo-1.png         ilustração recortada do WEBP do layout
    corpo-2.png
    corpo-3.png
    logo-mits.png
    logo-m.png
    favicon.svg
netlify/
  functions/
    api.mjs              autenticação, fichas e imagens
netlify.toml             diretórios de deploy e cabeçalhos
package.json            dependência @netlify/blobs
```

## Segurança e limites

- Senha validada no servidor, sessão assinada em cookie HttpOnly, SameSite=Strict, validade de 8 horas.
- Dados do editor não ficam disponíveis para gravação sem autenticação.
- Imagens permitidas: JPEG, PNG ou WebP, até 5 MB. SVG pode ser usado para o **mapa**, não como foto carregada pelo painel.
- Edições precisam ser feitas no projeto Netlify publicado. O ZIP entregue é um pacote de código, não significa que a publicação do site foi realizada.
- Para uso com muitas pessoas e necessidades de auditoria/histórico, convém evoluir para contas individuais e banco de dados. A configuração atual é adequada para uma equipe pequena com senha compartilhada.
