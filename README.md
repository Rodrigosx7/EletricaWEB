# Portal Elétrico

Aplicação React/Vite para gestão de serviços elétricos, orçamentos e montagem de quadros. Os dados de negócio usam Supabase; a emissão fiscal usa funções Netlify no servidor.

## Desenvolvimento

1. Instale as dependências com `npm ci`.
2. Copie `.env.example` para `.env.local` e preencha apenas as variáveis públicas `VITE_SUPABASE_*` necessárias ao navegador. Nunca use `VITE_` para chaves privadas.
3. Execute `npm run dev`. Para testar as funções fiscais localmente, use `npx netlify dev` com as variáveis privadas configuradas no ambiente local seguro.

Verificações: `npm run build`, `npm run typecheck:functions`, `npm run lint` e `npm test`.

## Banco de dados

Em um projeto novo, aplique os scripts SQL no Supabase nesta ordem: `SETUP_SUPABASE.sql`, `FEATURES_FINAL.sql`, `RECEITA_AUTO.sql`, `ESTOQUE_SETUP.sql`, `QDC_SETUP.sql` e `NOTAAS_SETUP.sql`. Em um projeto existente, após backup, aplique `SECURITY_HARDENING.sql` para proteger os históricos e limitar uploads. As demais políticas de relacionamento e a view de estoque dos scripts de instalação só mudam no banco depois de sua execução; confira se não há referências entre contas diferentes. `FIX_SUPABASE.sql`, se usado para recuperação, também contém as políticas reforçadas.

`qdc_projetos` mantém os quadros na nuvem com RLS por usuário. `notaas_requests` registra as tentativas de emissão e só pode ser acessada pela função de servidor. O navegador não recebe a chave de serviço.

## Emissão fiscal

Configure no ambiente seguro da Netlify as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTAAS_API_KEY`, `NOTAAS_ALLOWED_USER_ID` e `NOTAAS_ALIQUOTA_ISS`. A chave Notaas fica restrita ao usuário indicado por `NOTAAS_ALLOWED_USER_ID`; para outra empresa, use outra configuração de emissor. Consulte `.env.example` apenas para os nomes das variáveis. Não adicione valores reais ao repositório.

Após uma resposta incerta do provedor, a mesma nota fica bloqueada para reenvio até conciliação manual. Isso evita duplicidade de NFS-e.

## Segurança no deploy

Execute `SECURITY_HARDENING.sql` no SQL Editor do Supabase existente e confirme que os buckets `logos` e `avatars` ficaram com os tipos e tamanhos limitados. Arquivos antigos fora desses limites não são removidos automaticamente; revise os SVGs já publicados. Em **Authentication > Rate Limits**, confira os limites de login, cadastro e recuperação de senha. Não ative CAPTCHA/Turnstile em **Authentication > Bot and Abuse Protection** sem integrar o widget e enviar `captchaToken` nos formulários de login, cadastro e recuperação; a ativação isolada pode bloquear esses fluxos.

Na Netlify, mantenha as variáveis privadas somente em **Environment variables**. Os cabeçalhos de segurança são definidos em `netlify.toml`; confirme-os na resposta HTTPS do site publicado. Nenhuma dessas medidas substitui backup, revisão das políticas ativas no banco e monitoramento de abuso.
