# Portal Elétrico — direção de produto

## Auditoria
React 19 + TypeScript + Vite + Tailwind 4; Supabase mantém autenticação, dados por usuário, armazenamento e RPCs. Navegação atual em estado React. Entidades: clientes, serviços, produtos/estoque, orçamentos/itens, ordens de serviço/itens/histórico, movimentações financeiras e empresa. Ferramentas: oito cálculos elétricos e lista de materiais por cômodo, armazenada localmente. Login, cadastro, recuperação e perfil completam os fluxos.

Padrões a substituir: indicadores com o mesmo peso, caixas coloridas para ícones, busca isolada da tabela, margens duplicadas, formulários longos sem seções e autenticação com brilho/glassmorphism. A implementação anterior do painel e shell é parcial; o botão manual de recolhimento permanece como solicitado.

## Direção
Uma bancada de operação: navegação navy estável, área de trabalho clara, alinhamento preciso e informações reunidas por decisão. Manrope para títulos e corpo; números tabulares para comparações. Branco #ffffff, off-white #f6f7f5, navy #13232d, grafite #1b292f, borda #dfe5e3, âmbar #e9b949. A cor de marca configurada pela empresa continua disponível como acento; estados usam cor com texto, sem decoração.

Painel: prazos de execução como eixo principal, fila de atenção ao lado, leitura financeira subordinada e registro recente. Catálogos: cabeçalho/ação, resumo em linha, busca e tabela integrada, registros empilhados no celular. Financeiro: saldo e livro de movimentações. Relatórios: comparação visual temporal e composição comercial. Ferramentas: seleção de cálculo, entrada e leitura instrumental do resultado. Configurações: seções de empresa e identidade com prévia.

```
Navegação | Contexto da área
          | Título / descrição                         Ação
          | Resumo contínuo com pesos diferentes
          | Filtros conectados ao conteúdo
          | Lista, cronograma ou área de trabalho
```

## Componentes
Tokens primitivos → semânticos → componentes em src/index.css. Padrões product-page/page-header, metric-strip, data-panel/data-toolbar/data-table, record-row, form-section/form-grid, filter-tabs, status-label, botões e Modal compartilhado. Bordas leves, raios 6–12 px por função, sombras apenas para sobreposição. Foco visível, alvos de toque de 44 px, carregamento/erro/vazio claros; movimento breve com reduced-motion.

## Preservação
Não alterar regras de preço, cálculos, payloads, permissões, PDFs, CSVs, estoque, autenticação ou preferências. Estatísticas e filtros baseados na página carregada devem declarar esse alcance. Não inventar técnico/horário/prioridade: O.S. possui apenas datas. Agenda deve usar previsão de conclusão, sem apresentá-la como horário de visita.

## Revisão
Revisar 375, 768, 1024 e 1440 px, shell expandido/recolhido, formulários, filtros e estados com dados/vazio/erro. Build TypeScript/Vite, lint dos arquivos alterados e prova visual local; nenhuma massa fictícia inserida em dados reais.
