// Contrato compartilhado entre a UI (main thread) e o Web Worker de conversão.

/** Mensagem Main -> Worker: iniciar conversão de um PDF. */
export interface ConvertRequest {
  type: 'convert';
  /** Conteúdo do PDF (transferido por referência, zero-copy). */
  buffer: ArrayBuffer;
  fileName: string;
}

/** Fragmento de texto do PDF com sua posição (origem do sistema pdf.js). */
export interface PositionedText {
  /** Borda esquerda (transform[4]). */
  x: number;
  /** Baseline (transform[5]). */
  y: number;
  /** Largura do fragmento (necessária para o centro X = x + w/2). */
  w: number;
  text: string;
}

/** Linha visual reconstruída a partir do clustering por coordenada Y. */
export interface VisualLine {
  page: number;
  y: number;
  /** Fragmentos ordenados por X. */
  items: PositionedText[];
  /** Concatenação dos fragmentos (auxílio de depuração / Etapa 2). */
  text: string;
}

export interface PageLines {
  page: number;
  lines: VisualLine[];
}

/** Registro do layout "Lançamentos" = 1 linha da planilha (colunas A..H). */
export interface TransactionRow {
  descricao: string;
  valor: string;
  saldo: number | null;
  tipo: string;
  debitado: string;
  creditado: string;
  referencia: string;
  dataHora: Date | null;
}

/** Registro do layout "Extrato Consolidado" = 1 linha da planilha (colunas A..F). */
export interface DailySummaryRow {
  /** Data do resumo; `null` na linha de TOTAIS. */
  data: Date | null;
  /** Rótulo exibido na coluna Data quando não há data (ex.: "TOTAIS"). */
  rotulo: string;
  saldoInicial: number | null;
  entradas: number | null;
  saidas: number | null;
  saldoDia: number | null;
  saldoFinal: number | null;
}

/** Layouts de relatório ModoBank reconhecidos pelo conversor. */
export type LayoutId = 'lancamentos' | 'consolidado';

/** Valor de célula já tipado para a planilha. */
export type CellValue = string | number | Date | null;

/**
 * Tabela pronta para virar planilha — saída comum a todos os layouts, para que
 * `buildXlsx` e a UI não precisem conhecer o formato de origem.
 */
export interface ExtractedTable {
  layout: LayoutId;
  /** Nome do layout exibido na UI (ex.: "Extrato Consolidado"). */
  label: string;
  headers: string[];
  rows: CellValue[][];
  /** Colunas de data (índice 0-based) e o formato Excel aplicado a elas. */
  dateFormats: Record<number, string>;
  reconciliation: Reconciliation;
  /** Métricas extras exibidas no painel de resultado. */
  highlights: { label: string; value: number }[];
}

/** Uma divergência encontrada na reconciliação do saldo corrente. */
export interface Discrepancy {
  /** Linha na planilha (1 = cabeçalho). */
  row: number;
  /** Variação esperada (valor da transação). */
  expected: number;
  /** Variação observada (saldo[i] - saldo[i-1]). */
  got: number;
}

export interface Reconciliation {
  ok: boolean;
  /** Quantas transações foram conferidas. */
  checked: number;
  discrepancies: Discrepancy[];
}

export interface ConversionStats {
  pages: number;
  totalRows: number;
  /** Layout detectado no PDF de entrada. */
  layout: LayoutId;
  layoutLabel: string;
  /** Contagens específicas do layout (créditos/débitos, dias, ...). */
  highlights: { label: string; value: number }[];
  reconciliation: Reconciliation;
}

/** Mensagens Worker -> Main. */
export type WorkerOut =
  | { type: 'progress'; page: number; total: number }
  | { type: 'done'; xlsx: ArrayBuffer; stats: ConversionStats; fileName: string }
  | { type: 'error'; message: string };
