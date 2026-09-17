# Conversor de Extrato ModoBank → Excel

Aplicação **100% client-side** (frontend-only) que converte o extrato bancário
ModoBank em PDF para uma planilha `.xlsx`. Nada é enviado a servidores — todo o
processamento acontece no navegador, dentro de um **Web Worker**, para não
travar a interface mesmo com PDFs de centenas de páginas.

## Formatos suportados

A mesma área de upload aceita os dois relatórios do ModoBank — o formato é
**detectado automaticamente** (não há seleção manual):

| Layout | Cabeçalho | Saída |
| --- | --- | --- |
| **Lançamentos** | Descrição · Valor · Saldo na conta · Tipo · Debitado · Creditado · Referência · Data/Hora | 1 linha por transação |
| **Extrato Consolidado** | Data · Saldo inicial · Entradas · Saídas · Saldo do dia · Saldo final | 1 linha por dia + TOTAIS |

A detecção pontua cada layout pelo nº de páginas em que seu cabeçalho casa e só
aceita o vencedor se a extração realmente render linhas; se nenhum cabeçalho for
reconhecido, todos são tentados e vence o que extrair mais linhas
(`src/core/layouts/index.ts`).

## Stack

- **Vite + React + TypeScript** — SPA estática (deploy na Vercel, preset "Vite").
- **pdf.js (`pdfjs-dist`)** — leitura do PDF com coordenadas (x, y) de cada texto.
- **SheetJS (`xlsx`)** — geração do `.xlsx` com células tipadas (número/data).
- **Web Worker** — parsing + extração + montagem do arquivo fora da UI thread.

## Scripts

```bash
npm install       # instala dependências
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção -> dist/
npm run preview   # pré-visualiza o build
npm run typecheck # checagem de tipos
```

## Arquitetura

```
src/
  App.tsx                     UI por estado (idle -> parsing -> done | error)
  hooks/useConverter.ts       ponte React <-> Worker (máquina de estados)
  workers/converter.worker.ts pdf.js + extração + xlsx (fora da UI thread)
  core/
    grid.ts                   coordenadas -> linhas visuais -> células (comum)
    layouts/index.ts          detecção do layout (qual regex reconhece o PDF)
    layouts/lancamentos.ts    layout transacional (8 colunas)
    layouts/consolidado.ts    layout de resumo diário (6 colunas)
    normalize.ts              limpeza por campo (moeda, data, descrição)
    validate.ts               reconciliação de saldo por layout
    buildXlsx.ts              tabela extraída -> workbook (.xlsx)
  components/                 Dropzone, ProgressBar, ResultPanel
reference/                    PDF de amostra + planilha-modelo (fixtures)
```

## Roadmap

- [x] **Etapa 1 — Setup + esqueleto do pipeline.** Projeto, Web Worker, UI,
      progresso, download; núcleo de normalização implementado.
- [x] **Etapa 2 — Extração (core).** Reconstrução do grid pelo centro X dos
      fragmentos (âncoras do cabeçalho), segmentação por âncora textual, absorção
      de linhas de continuação, mapeamento De → Para completo. Verificado contra
      o PDF real (`scripts/verify-core.ts`).
- [x] **Etapa 3 — Fidelidade e validação.** Células fiéis ao modelo (Data/Hora
      `m/d/yy h:mm` via serial UTC — sem drift de fuso; Saldo numérico General;
      aba `Table001 (Page 1-N)`), reconciliação de saldo exibida na UI, migração
      para o build oficial do SheetJS (0 vulnerabilidades).
- [x] **Etapa 4 — Multi-layout.** Núcleo de grid separado dos layouts, detecção
      automática na mesma área de upload e suporte ao "Extrato Consolidado"
      (resumo diário), com reconciliação própria (identidade do dia, continuidade
      entre dias e conferência da linha TOTAIS).
- [ ] **Validação final.** Rodar com o PDF real de 275 páginas para conferir as
      linhas de Saldo (anterior/fechamento) e a fronteira entre páginas.
