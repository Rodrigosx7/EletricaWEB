# Auditoria de Código — SiteEletrica

**Escopo:** revisão estática de `C:\Users\Rodrigo Justo\Desktop\Claude\SiteEletrica`
**Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + Supabase JS 2 + jsPDF/jspdf-autotable
**Build:** `npm run build` (tsc -b && vite build). Lint: `npm run lint`
**Data da auditoria:** 04/09/2026

---

## 1. Visão geral

O projeto é um sistema de gestão para empresa de serviços elétricos ("RJ Elétrica") com:

- Autenticação (login, cadastro, recuperação de senha) via Supabase Auth.
- Cadastros: `clientes`, `servicos`, `produtos` (com controle de estoque), `orcamentos` (com itens), `ordens_servico` (com itens).
- Geração de PDF de orçamento (jsPDF + jspdf-autotable).
- Dashboard estático (sem integração com dados — apenas placeholders).
- Sidebar com 9 menus, três deles com placeholders "Módulo em construção".

Estrutura relevante:

```
src/
  App.tsx, main.tsx, supabase.ts, index.css, App.css
  pages/{Login,Cadastro,NovaSenha}.tsx
  components/{Sidebar,Dashboard,Clientes,Servicos,Produtos,Orcamentos,OrdensServico}.tsx
public/  logo.png, favicon.svg, icons.svg
```

---

## 2. Resumo executivo

| Categoria                  | Ocorrências |
|---------------------------|-------------|
| Crítico (segurança/RLS)    | 4 |
| Alto (lógica/dados)        | 6 |
| Médio (UX/código)          | 9 |
| Baixo (estilo/limpeza)     | 8 |

**Maiores riscos:**
1. Ausência (visível) de validação por `user_id` em operações sensíveis — depende inteiramente de RLS no Supabase, o que não é verificável a partir do front.
2. `tsconfig.app.json` com `noUnusedLocals`/`noUnusedParameters` ligados, mas o build não tem `tsc --noEmit` na CI — bugs podem passar.
3. Uso disseminado de `any`, `alert()`, `confirm()` e `style={{...}}` inline em vez de componentes/Tailwind.
4. Lógica de geração de número sequencial (`orcamentos`, `ordens_servico`) feita por leitura + soma no front — vulnerável a condições de corrida se dois clientes abrirem o mesmo formulário.

---

## 3. Achados críticos (segurança / dados)

### 3.1 — Filtragem por `user_id` depende exclusivamente de RLS

**Arquivos:** `Clientes.tsx`, `Servicos.tsx`, `Produtos.tsx`, `Orcamentos.tsx`, `OrdensServico.tsx`

Todas as queries filtram `eq("user_id", user.id)`, o que é correto — **se** a RLS no Supabase estiver habilitada. Como o front não consegue verificar isso, qualquer pessoa com a `VITE_SUPABASE_PUBLISHABLE_KEY` poderia, em tese, ler dados de outros usuários caso as políticas RLS não estejam ativas.

**Recomendação:**
- Confirmar no painel do Supabase que as tabelas `clientes`, `servicos`, `produtos`, `orcamentos`, `orcamento_itens`, `ordens_servico`, `ordem_servico_itens` têm RLS habilitada com políticas `auth.uid() = user_id`.
- Adicionar um teste/documento listando as políticas aplicadas.

### 3.2 — Edição/exclusão de O.S. não filtra por `user_id`

**Arquivo:** `OrdensServico.tsx`

- `editarOrdem` chama `update` com `.eq("id", editandoId)` **sem** `.eq("user_id", user.id)` (linhas 451–471 e 572–595).
- `excluirOrdem` chama `delete` apenas com `.eq("id", id)` (linhas 834–838).
- `concluirOrdem`/`reabrirOrdem` também só filtram por id.

Novamente, RLS no banco deve barrar, mas é inconsistente com o resto do código, que sempre filtra. Se um dia alguém desativar RLS temporariamente, essas operações vazam.

**Recomendação:** adicionar `.eq("user_id", user.id)` em todas as mutações de `ordens_servico`.

### 3.3 — Geração de número sequencial com race condition

**Arquivos:** `Orcamentos.tsx:416–447`, `OrdensServico.tsx:528–554`

O próximo número é calculado como:

```ts
const { data: ultimo } = await supabase.from("orcamentos")
  .select("numero").eq("user_id", user.id)
  .order("numero", { ascending: false }).limit(1).maybeSingle();
const proximoNumero = (ultimo?.numero || 0) + 1;
// em seguida: .insert({ numero: proximoNumero, ... })
```

Se duas abas/usuários abrem o formulário simultaneamente, ambos leem o mesmo `ultimo.numero` e gravam o mesmo `numero` — quebra a unicidade. Se houver `unique(numero)` na tabela, vai dar erro; se não houver, vão existir duplicados.

**Recomendação:**
- Criar uma sequence no Postgres (`create sequence orcamento_numero_seq`) e função RPC que retorne o próximo número, **ou**
- Tornar `numero` gerado por trigger no banco (`before insert`) usando `max(numero)+1` em transação, **ou**
- Adicionar constraint `unique(user_id, numero)` no banco para evitar duplicação silenciosa.

### 3.4 — `supabase.ts` não trata env vars ausentes

**Arquivo:** `src/supabase.ts`

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)
```

Se as variáveis não estiverem definidas, o `createClient` recebe `undefined` e a primeira chamada explode com erro genérico em runtime, sem dica útil para o desenvolvedor.

**Recomendação:** adicionar validação explícita:

```ts
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes");
}
```

---

## 4. Achados altos (lógica / dados)

### 4.1 — `noUnusedLocals` ligado, build não falha em erro TS

**Arquivos:** `tsconfig.app.json`, `package.json`

O `tsconfig.app.json` tem `noUnusedLocals: true` e `noUnusedParameters: true`, mas o `npm run build` usa `tsc -b && vite build` que já roda o tsc. Ok. **Porém:** o `tsconfig.app.json` **não tem** `"strict": true`, então `noImplicitAny` etc. estão desligados. Isso é compatível com o uso indiscriminado de `any` visto no código.

**Recomendação:** ligar `strict: true` (ou pelo menos `noImplicitAny`, `strictNullChecks`) e ir tipando os `any` progressivamente.

### 4.2 — `useEffect` em `App.tsx` chama `getUser` + `onAuthStateChange` em duplicidade

**Arquivo:** `src/App.tsx:18–38`

O `verificarUsuario()` (uma chamada `getUser`) executa em paralelo com o `onAuthStateChange`, que já entrega o usuário no evento `INITIAL_SESSION`. Resultado: dois `setUsuario` quase simultâneos.

**Recomendação:** remover a chamada inicial de `getUser` e confiar no evento `INITIAL_SESSION` do `onAuthStateChange`. Caso precise hidratar explicitamente, faça `await` antes de registrar o listener.

### 4.3 — Cálculo de subtotal no front sem validação de origem

**Arquivos:** `Orcamentos.tsx:196–222`, `OrdensServico.tsx:379–408`

Subtotais são calculados no front e enviados ao banco. Um usuário malicioso poderia editar o payload antes de enviar (mas isso é mitigado por RLS se a tabela só aceitar inserções autenticadas). Em todo caso, é boa prática recalcular no banco via trigger antes do `insert`.

**Recomendação:** calcular `subtotal` e `valor_total` em função SQL/trigger antes do insert/update. No front manter como preview.

### 4.4 — `NovaSenha` valida apenas hash de URL

**Arquivo:** `src/pages/NovaSenha.tsx:46–52` (em `App.tsx`)

A detecção da tela de "redefinir senha" no `App.tsx` é feita por substring no hash:

```ts
const recuperandoSenha =
  window.location.hash.includes("type=recovery") ||
  window.location.hash.includes("redefinir-senha");
```

Qualquer pessoa pode adicionar `#redefinir-senha` à URL manualmente e ver a tela — mas a tela em si chama `supabase.auth.updateUser({ password })` que exige sessão válida. Como não há garantia forte de que a sessão veio de um link de recovery, em tese um usuário logado pode "trocar" a própria senha pela tela de nova senha, o que normalmente é desejado — mas pode mascarar fluxos de expiração.

**Recomendação:** extrair o evento do auth state (`PASSWORD_RECOVERY`) e usar isso como gatilho, em vez de inspecionar o hash.

### 4.5 — `Orcamentos.tsx` faz chamada de logo duplicada

**Arquivos:** `Orcamentos.tsx:599–700`

A função `carregarImagem` é declarada duas vezes (uma antes do header, outra antes do título) e `/logo.png` é carregado/processado duas vezes. Funciona, mas é desperdício — uma única Promise reutilizável resolveria.

**Recomendação:** extrair `carregarImagem` para um helper e usar uma única Promise.

### 4.6 — `Orcamentos.tsx` mistura `useState<any>(null)` para usuário

**Arquivos:** `App.tsx`, `Clientes.tsx`, `Servicos.tsx`, `Produtos.tsx`, `Orcamentos.tsx`

Vários componentes fazem `const [usuario, setUsuario] = useState<any>(null)` em vez de usar o tipo `User` do Supabase (`import type { User } from "@supabase/supabase-js"`).

**Recomendação:** tipar `usuario: User | null` para evitar contornar o sistema de tipos.

---

## 5. Achados médios (UX / código)

### 5.1 — `alert()` / `confirm()` em fluxos de erro

**Arquivos:** praticamente todos os componentes

Erros são reportados com `alert("…")` e confirmações com `window.confirm("…")`. Em uma SPA, isso bloqueia a thread visual e quebra a estética.

**Recomendação:** criar um pequeno `<Toast>` / `<Dialog>` e um hook `useConfirm()`.

### 5.2 — Estilos inline `style={{...}}` em vez de Tailwind

**Arquivos:** `Login.tsx`, `Cadastro.tsx`, `NovaSenha.tsx`, `OrdensServico.tsx` (alguns trechos)

A identidade visual é feita com `<div style={{ background: "#0D1B2A", ... }}>`. Misturar inline styles com classes Tailwind dificulta manutenção de tema.

**Recomendação:** mover para classes Tailwind ou CSS modules. Pelo menos tokens como a cor `#0D1B2A` (que aparece em vários lugares) deveriam virar `bg-brand-dark`.

### 5.3 — `App.tsx` roteamento por `useState("dashboard")`

**Arquivo:** `src/App.tsx`

A navegação é feita por `setPagina("financeiro")` em vez de `react-router-dom`, embora a dependência esteja instalada (`"react-router-dom": "^7.18.3"`).

**Recomendação:** usar `<Routes>` + `<Route>` com `BrowserRouter`, e `<NavLink>` na sidebar para URLs reais (`/clientes`, `/orcamentos/123`). Isso também habilita deep linking, refresh sem perder estado e back/forward do navegador.

### 5.4 — Dashboard com valores hardcoded

**Arquivos:** `Dashboard.tsx`

Os 4 cards de KPI mostram "R$ 0,00" literal e os botões de "Ações rápidas" não têm `onClick`. Não há integração com os dados reais.

**Recomendação:** calcular os KPIs via queries Supabase (ex.: soma de `valor_total` de OS concluídas no mês, contagem de OS pendentes, total de produtos com `estoque <= estoque_minimo`).

### 5.5 — Botões "Financeiro", "Relatórios", "Configurações" são placeholders

**Arquivo:** `App.tsx:89–125`

Os três menus mostram "Módulo em construção". Ou se remove da sidebar, ou se substitui por "Em breve" desabilitado, evitando clique em item sem funcionalidade.

### 5.6 — Acessibilidade: modais sem `role="dialog"` / `aria-modal`

**Arquivos:** todos os componentes com modal

Modais (`Clientes`, `Servicos`, `Produtos`, `Orcamentos`, `OrdensServico`) usam `<div className="fixed inset-0 ...">` mas não informam tecnologias assistivas. Falta também `Escape` para fechar.

**Recomendação:** adicionar `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para o título, e um hook `useEscape(handler)` para fechar com `Esc`.

### 5.7 — Formulários não usam `htmlFor` nos labels

**Arquivos:** todos os formulários

`<label>Nova senha</label>` seguido de `<input>` solto — sem `htmlFor`/`id`. Leitores de tela não associam.

**Recomendação:** `<label htmlFor="nova-senha">…</label><input id="nova-senha" ...>`.

### 5.8 — Falta tratamento de loading/erro global

Em vários componentes (`carregarClientes`, `carregarOrdens`) o `error` é logado e a função retorna silenciosamente. O usuário não vê nada acontecer.

**Recomendação:** estados `erro: string | null` + renderização condicional ("Falha ao carregar — tente novamente").

### 5.9 — `tsconfig.app.json` `verbatimModuleSyntax: true` sem `import type` consistente

**Arquivos:** vários

`verbatimModuleSyntax` exige `import type` para tipos. O código importa `React.FormEvent` direto em alguns lugares (`Cadastro.tsx:15`, `Login.tsx:12`) sem `import type` — pode quebrar em build de produção dependendo da versão do tsc.

**Recomendação:** padronizar `import { useState, type FormEvent } from "react"`.

---

## 6. Achados baixos (limpeza / estilo)

### 6.1 — `App.css` é do template Vite, não utilizado

`App.css` ainda tem `.counter`, `.hero`, `#next-steps`, `#docs`, etc., do template padrão. Não é importado em lugar nenhum do código de aplicação. Removê-lo reduz ruído.

### 6.2 — `src/assets/react.svg` e `src/assets/vite.svg` são do template

Mesmo caso — vieram do template, não são usados.

### 6.3 — `lucide-react@^1.40.0` instalado mas não usado

A sidebar usa glifos Unicode (`⌂`, `♙`, `▤`…) e o resto usa emojis. `lucide-react` foi declarado mas nunca importado.

**Recomendação:** ou usar a biblioteca (mais consistente), ou removê-la do `package.json`.

### 6.4 — Tipos duplicados

`Cliente`, `Servico`, `Produto`, `Orcamento`, `ItemOrcamento`, `OrdemServico`, `ItemOS`, `OrcamentoItem` são redeclarados em vários arquivos (`Clientes.tsx`, `Orcamentos.tsx`, `OrdensServico.tsx`).

**Recomendação:** centralizar em `src/types/` e reexportar.

### 6.5 — `formatarMoeda` duplicada

A função `formatarMoeda(valor)` aparece com a mesma implementação em `Servicos.tsx`, `Produtos.tsx`, `Orcamentos.tsx`, `OrdensServico.tsx`. Mover para `src/lib/format.ts`.

### 6.6 — `id: number` no banco, mas nada garante que o `id` retornado é `number`

Vários lugares fazem `Number(item.id)` ao ler de `orcamento_itens`, mas o tipo declarado localmente é `id: number`. Como o Postgres gera `bigint`, em algum momento pode virar string. Tipar como `number | string` (ou `bigint`/`string` com conversão) é mais robusto.

### 6.7 — README é o boilerplate do Vite

O `README.md` ainda é o do template React + Vite + ESLint. Não descreve o projeto.

**Recomendação:** reescrever com setup, scripts, variáveis de ambiente necessárias e diagrama básico.

### 6.8 — Inconsistência de botões primários

A maioria usa `bg-[#FFD60A] text-[#0D1B2A]`, mas o `Orcamentos.tsx` usa `bg-blue-600 hover:bg-blue-700 text-white` para "Novo orçamento" e "Salvar". Misturar a cor primária prejudica a identidade visual.

---

## 7. Dependências e versões

| Pacote              | Versão declarada | Observação |
|---------------------|------------------|------------|
| `react` / `react-dom` | `^19.2.8`     | OK, Vite 8 + plugin suportam |
| `vite`              | `^8.2.2`        | Versão avançada — confirmar compatibilidade do plugin |
| `typescript`        | `~6.0.2`        | TS 6 ainda em pré-lançamento em muitas toolchains — validar build |
| `tailwindcss`       | `^4.3.3`        | Tailwind 4 mudou o pipeline — `@tailwindcss/vite` está sendo usado, OK |
| `eslint`            | `^10.9.0`       | OK |
| `lucide-react`      | `^1.40.0`       | Não utilizado |
| `jspdf` / `jspdf-autotable` | `^4.2.1` / `^5.0.8` | OK |
| `@supabase/supabase-js` | `^2.115.0` | OK |

Sugestão: rodar `npm outdated` periodicamente e travar versões com `npm ci` no CI.

---

## 8. Recomendações priorizadas

1. **(Crítico)** Auditar e habilitar RLS em todas as tabelas no Supabase.
2. **(Crítico)** Adicionar `.eq("user_id", user.id)` em `ordens_servico` (mutações).
3. **(Crítico)** Mover geração de número de orçamento/OS para o banco (sequence/trigger).
4. **(Alto)** Tipar `usuario` com `User` e ligar `strict: true` no `tsconfig.app.json`.
5. **(Alto)** Substituir a detecção de recovery por evento do `onAuthStateChange`.
6. **(Médio)** Migrar a navegação para `react-router-dom` (já instalado).
7. **(Médio)** Construir dashboard com KPIs reais e remover placeholders.
8. **(Médio)** Implementar acessibilidade dos modais (role, aria, escape).
9. **(Baixo)** Deduplicar tipos e helpers de formatação.
10. **(Baixo)** Substituir `alert/confirm` por toasts/dialogs.

---

## 9. Observações de leitura

- O código é coerente no estilo (Tailwind, classes utilitárias, mesma paleta `#0D1B2A`/`#FFD60A`).
- Há boa cobertura de fluxos (criar/editar/excluir, filtros, busca).
- A geração de PDF é razoavelmente completa e bem-feita (cores, cabeçalho, tabela, totais, observações).
- Pontos de risco estão concentrados em três lugares: Supabase RLS, geração de número sequencial, e roteamento único por `useState`.

A auditoria foi feita por leitura estática; testes dinâmicos (typecheck real, build, lint, exec) não foram executados nesta passada.

---

## 10. Pré-requisitos RLS no Supabase (pendente do operador)

Como o front depende de RLS para isolar dados por usuário, e o operador não tem acesso ao painel para aplicar políticas, liste abaixo o **mínimo** que precisa existir no banco para o app ser seguro. Cada bloco é uma tabela + as policies esperadas — basta rodar cada `create policy` no SQL editor do Supabase.

```sql
-- Habilitar RLS em todas as tabelas
alter table clientes enable row level security;
alter table servicos enable row level security;
alter table produtos enable row level security;
alter table orcamentos enable row level security;
alter table orcamento_itens enable row level security;
alter table ordens_servico enable row level security;
alter table ordem_servico_itens enable row level security;

-- Policies (template: SELECT/INSERT/UPDATE/DELETE auth.uid() = user_id)
-- clientes
create policy "clientes_select" on clientes for select using (auth.uid() = user_id);
create policy "clientes_insert" on clientes for insert with check (auth.uid() = user_id);
create policy "clientes_update" on clientes for update using (auth.uid() = user_id);
create policy "clientes_delete" on clientes for delete using (auth.uid() = user_id);

-- servicos
create policy "servicos_select" on servicos for select using (auth.uid() = user_id);
create policy "servicos_insert" on servicos for insert with check (auth.uid() = user_id);
create policy "servicos_update" on servicos for update using (auth.uid() = user_id);
create policy "servicos_delete" on servicos for delete using (auth.uid() = user_id);

-- produtos
create policy "produtos_select" on produtos for select using (auth.uid() = user_id);
create policy "produtos_insert" on produtos for insert with check (auth.uid() = user_id);
create policy "produtos_update" on produtos for update using (auth.uid() = user_id);
create policy "produtos_delete" on produtos for delete using (auth.uid() = user_id);

-- orcamentos
create policy "orcamentos_select" on orcamentos for select using (auth.uid() = user_id);
create policy "orcamentos_insert" on orcamentos for insert with check (auth.uid() = user_id);
create policy "orcamentos_update" on orcamentos for update using (auth.uid() = user_id);
create policy "orcamentos_delete" on orcamentos for delete using (auth.uid() = user_id);

-- orcamento_itens
create policy "orcamento_itens_select" on orcamento_itens for select using (auth.uid() = user_id);
create policy "orcamento_itens_insert" on orcamento_itens for insert with check (auth.uid() = user_id);
create policy "orcamento_itens_update" on orcamento_itens for update using (auth.uid() = user_id);
create policy "orcamento_itens_delete" on orcamento_itens for delete using (auth.uid() = user_id);

-- ordens_servico
create policy "ordens_servico_select" on ordens_servico for select using (auth.uid() = user_id);
create policy "ordens_servico_insert" on ordens_servico for insert with check (auth.uid() = user_id);
create policy "ordens_servico_update" on ordens_servico for update using (auth.uid() = user_id);
create policy "ordens_servico_delete" on ordens_servico for delete using (auth.uid() = user_id);

-- ordem_servico_itens
create policy "ordem_servico_itens_select" on ordem_servico_itens for select using (auth.uid() = user_id);
create policy "ordem_servico_itens_insert" on ordem_servico_itens for insert with check (auth.uid() = user_id);
create policy "ordem_servico_itens_update" on ordem_servico_itens for update using (auth.uid() = user_id);
create policy "ordem_servico_itens_delete" on ordem_servico_itens for delete using (auth.uid() = user_id);
```

### Também recomendado (não-crítico)

- `unique(user_id, numero)` em `orcamentos` e `ordens_servico` para impedir a race condition do item 3.3 mesmo sem sequence/trigger.
- Função/trigger `before insert` que faça `numero = coalesce(max(numero), 0) + 1` em transação — substitui o cálculo atual do front.

## 11. Correções aplicadas (auditoria 04/09/2026 — escopo "correções seguras")

Aplicadas nesta revisão:

| Achado | Correção | Arquivo |
|---|---|---|
| 3.4 | Validação de env vars com erro explícito | [src/supabase.ts](src/supabase.ts) |
| 3.2 | `.eq("user_id", user.id)` em editar/concluir/reabrir/excluir de O.S. | [src/components/OrdensServico.tsx](src/components/OrdensServico.tsx) |
| 4.5 | `carregarImagem` extraída para `getLogo()` em escopo de módulo, com cache (uma única carga de `/logo.png`) | [src/components/Orcamentos.tsx](src/components/Orcamentos.tsx) |
| 4.6 | `useState<any>` → `useState<User \| null>` em App, Clientes, Servicos, Produtos, Orcamentos | [src/App.tsx](src/App.tsx), [src/components/Clientes.tsx](src/components/Clientes.tsx), [src/components/Servicos.tsx](src/components/Servicos.tsx), [src/components/Produtos.tsx](src/components/Produtos.tsx), [src/components/Orcamentos.tsx](src/components/Orcamentos.tsx) |
| Novo | Importação de `type FormEvent` em vez de `React.FormEvent` (corrige erro com `verbatimModuleSyntax`) | [src/pages/Login.tsx](src/pages/Login.tsx), [src/pages/Cadastro.tsx](src/pages/Cadastro.tsx), [src/pages/NovaSenha.tsx](src/pages/NovaSenha.tsx), [src/components/Clientes.tsx](src/components/Clientes.tsx), [src/components/Servicos.tsx](src/components/Servicos.tsx), [src/components/Produtos.tsx](src/components/Produtos.tsx) |
| 3.1 | Documentação das policies RLS esperadas | esta seção acima |
