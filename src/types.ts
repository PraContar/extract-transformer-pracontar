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

/** Registro canônico = 1 linha da planilha de saída (colunas A..H). */
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
  creditos: number;
  debitos: number;
  reconciliation: Reconciliation;
}

/** Mensagens Worker -> Main. */
export type WorkerOut =
  | { type: 'progress'; page: number; total: number }
  | { type: 'done'; xlsx: ArrayBuffer; stats: ConversionStats; fileName: string }
  | { type: 'error'; message: string };
