# Integração Notaas

## Configuração segura

1. Crie o projeto e a API key no painel da Notaas.
2. Cadastre a empresa prestadora, município e códigos fiscais no painel da Notaas.
3. No Netlify, configure `NOTAAS_API_KEY`, `NOTAAS_ALIQUOTA_ISS`, `SUPABASE_URL` e `SUPABASE_ANON_KEY` como variáveis de ambiente protegidas.
4. Nunca coloque `NOTAAS_API_KEY` em `.env` usado pelo Vite, em variável `VITE_*`, no frontend ou em commits.
5. Teste no sandbox/homologação antes de habilitar produção.

## Fluxo implementado

- A tela prepara o rascunho localmente.
- O frontend envia o rascunho para `/.netlify/functions/notaas-emitir` com o token da sessão Supabase.
- A função valida o usuário, monta o payload NFS-e e chama a Notaas com `x-api-key` apenas no servidor.
- A emissão é assíncrona; o identificador retornado pode ser consultado em `/.netlify/functions/notaas-status?id=...`.

A integração não armazena senha do gov.br e não considera a emissão concluída sem o retorno de status da Notaas.
