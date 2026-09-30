# Publicação na Netlify

O projeto já declara `npm run build` e a pasta `dist` em `netlify.toml`. Para publicar cada atualização do GitHub, abra o site na Netlify e confira em **Project configuration > Build & deploy > Continuous deployment** se o repositório correto está ligado e se `main` é a branch de produção. Em **Deploys**, verifique se o último commit de `main` aparece, se o build terminou com sucesso e se está marcado como publicado. Reative os deploys automáticos caso estejam pausados.

Depois de cada publicação, execute `npm ci`, `npm run build` e `npm run check:deploy`. O último comando compara o arquivo principal do build local com o HTML servido em `https://portal-eletrico.netlify.app/`. Se forem diferentes, consulte o deploy atual e seus logs na Netlify antes de anunciar a versão como disponível. Um build feito sobre mudanças locais ainda não enviadas ao GitHub também produzirá diferença; para a verificação final, use o mesmo commit enviado ao repositório.

Não copie valores de variáveis de ambiente para logs ou capturas. As variáveis públicas do frontend ficam no ambiente de build da Netlify; segredos privados devem permanecer apenas nas configurações seguras do provedor.
