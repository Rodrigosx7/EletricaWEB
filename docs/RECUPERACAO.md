# Backup e recuperação

Este procedimento cobre o banco Supabase, os arquivos dos buckets `avatars` e `logos` e os projetos editáveis do montador de quadros. Guarde as cópias em local privado, criptografado e fora do computador usado para operar o portal. O GitHub e a publicação da Netlify não são backups dos dados de usuários.

## Rotina de backup

1. No Supabase, confirme em **Database > Backups** se há backups automáticos e qual a retenção do plano. Em planos sem backup automático, agende um `supabase db dump` ou `pg_dump` com credenciais de banco guardadas em um gerenciador de segredos. Não inclua senhas na linha de comando, em arquivos versionados ou em logs. Faça a cópia da estrutura e dos dados, identifique o arquivo pela data e registre o tamanho e um hash SHA-256.
2. Exporte separadamente os objetos dos buckets `avatars` e `logos`, preservando o nome de cada objeto e o bucket. O backup do banco contém os metadados do Storage, mas não contém os arquivos em si. Confira a contagem e o hash dos objetos exportados.
3. No montador, abra **Seus projetos**, exporte cada quadro importante em **Exportar > Projeto editável JSON** e guarde os arquivos junto ao backup. O PDF ou PNG serve para consulta, mas não substitui o JSON editável.
4. Mantenha mais de uma geração de backup e proteja o acesso a elas. Defina a retenção conforme a necessidade operacional e legal antes de automatizar a exclusão das cópias antigas.

## Teste de restauração

1. Crie um projeto Supabase **separado**, sem tráfego real. Restaure nele o dump do banco e depois os objetos dos dois buckets. Não restaure por cima da produção para fazer o teste.
2. Confira as quantidades das tabelas principais, incluindo `clientes`, `orcamentos`, `ordens_servico` e `qdc_projetos`, e compare com o inventário do backup. Verifique se as imagens de perfil e logotipos abrem e se o acesso de uma conta não revela dados de outra.
3. Em uma sessão de teste do montador, importe um JSON exportado e confirme nome, circuitos, componentes e fios. Salve uma cópia e abra novamente.
4. Registre data do backup, data do teste, resultado, responsável e tempo necessário para recuperar. Corrija o processo e repita o teste se qualquer item faltar.

Uma solicitação de exclusão de conta deve considerar cópias de segurança e obrigações de retenção antes de remover dados de produção. Não prometa eliminação instantânea dos backups.
