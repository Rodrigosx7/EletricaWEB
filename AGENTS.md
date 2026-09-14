# Instruções de segurança do projeto

Estas regras valem para toda alteração neste repositório e devem ser lidas antes de editar, testar, revisar ou publicar código.

## Segredos e credenciais

- Nunca coloque chaves de API, tokens, senhas, cookies, credenciais do Supabase, chaves `service_role`, certificados ou senhas de certificados no código, testes, fixtures, documentação, logs, screenshots, commits ou mensagens.
- Mantenha valores locais em arquivos `.env` ignorados pelo Git e configure valores de produção somente nos secrets/environment variables do provedor (Netlify, Supabase ou equivalente).
- Variáveis `VITE_*` chegam ao navegador. Só use esse prefixo para valores realmente públicos; nenhuma credencial privada deve ser prefixada com `VITE_`.
- Chamadas a APIs de emissão fiscal e outros provedores devem passar por backend/serverless functions. A chave do provedor e o certificado A1 nunca podem ser enviados ao frontend.
- Não armazene nem solicite senha do gov.br. Use o fluxo oficial ou credenciais técnicas apropriadas do provedor.
- Arquivos `.pfx`, `.p12`, `.pem` e `.key` são privados: não devem entrar no repositório nem ser enviados para ferramentas, navegador ou chat.
- Antes de commit ou push, revise o diff e faça uma busca por padrões de segredo. Se houver suspeita de vazamento, pare a publicação, revogue/rotacione a credencial e remova o valor de todos os artefatos afetados.

## Dados de saída

- Ao diagnosticar ou compartilhar resultados, redija valores sensíveis. Mostre apenas nomes de variáveis, identificadores parciais ou placeholders como `REDACTED`.
- Nunca copie o conteúdo de `.env*`, certificados ou respostas de API que possam conter credenciais para a saída de uma ferramenta.

## Verificação

- Confirme que arquivos sensíveis estão no `.gitignore` e que o diff não contém valores reais antes de qualquer publicação.
- Prefira placeholders documentados (por exemplo, `.env.example`) sem valores funcionais.
