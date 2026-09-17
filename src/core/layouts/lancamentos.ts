// Layout "Lançamentos": uma linha por transação, 8 colunas.
// Cabeçalho: Descrição | Valor | Saldo na conta | Tipo | Debitado | Creditado |
//            Referência | Data/Hora

import type { ExtractedTable, PageLines, TransactionRow } from '../../types';
import { formatDescricao, parseCurrencyToNumber, parseDataHora } from '../normalize.ts';
import { reconcileLancamentos } from '../validate.ts';
import {
  DATE_RE,
  FURNITURE,
  type Bucket,
  centerOf,
  deriveAnchors,
  findHeaderLine,
  joinCell,
  nearestCol,
  newBucket,
} from '../grid.ts';
import type { LayoutModule } from './types.ts';

/**
 * Centros X (px) de cada coluna, calibrados no template ModoBank (página 792x612).
 * Usados como fallback; quando o cabeçalho da página é detectado, as âncoras são
 * recalibradas a partir dele.
 */
const DEFAULT_ANCHORS = [30.5, 247, 301.5, 350, 425, 525, 592, 759];
const N_COLS = 8;
const COL = {
  DESCRICAO: 0,
  VALOR: 1,
  SALDO: 2,
  TIPO: 3,
  DEBITADO: 4,
  CREDITADO: 5,
  REFERENCIA: 6,
  DATA_HORA: 7,
} as const;

const HEADERS = [
  'Descrição',
  'Valor',
  'Saldo na conta',
  'Tipo',
  'Debitado',
  'Creditado',
  'Referência',
  'Data/Hora',
];

/** Formato da coluna Data/Hora, idêntico à planilha-modelo (o valor mantém os segundos). */
const DATE_FMT = 'm/d/yy h:mm';

/** Regex que identifica a linha de cabeçalho deste layout. */
const HEADER_RE = [/Descri/i, /Data\/?\s?Hora/i, /Saldo/i];
const matchesHeader = (text: string) => HEADER_RE.every((re) => re.test(text));

/** Cabeçalho repetido no corpo (quando a linha escapa do corte por Y). */
const HEADER_FURNITURE = /Descri[çc][ãa]o\s+Valor\s+Saldo/i;

function finalizeRecord(b: Bucket): TransactionRow {
  const descRaw = joinCell(b[COL.DESCRICAO], ' ');
  const isSaldo = /^(Saldo Anterior|SALDO )/i.test(descRaw.trim());

  const valor = joinCell(b[COL.VALOR], ' ');
  const saldoText = joinCell(b[COL.SALDO], ' ');
  const tipo = joinCell(b[COL.TIPO], ' ');
  const debitado = joinCell(b[COL.DEBITADO], '\n');
  const creditado = joinCell(b[COL.CREDITADO], '\n');
  // Referência: reconcatena o código quebrado num único token contínuo.
  const referencia = joinCell(b[COL.REFERENCIA], '').replace(/\s+/g, '');
  const dataText = joinCell(b[COL.DATA_HORA], ' ');

  return {
    descricao: formatDescricao(descRaw),
    valor: valor || (isSaldo ? '---' : ''),
    saldo: parseCurrencyToNumber(saldoText),
    tipo: tipo || (isSaldo ? 'Saldo' : ''),
    debitado: debitado || (isSaldo ? '---' : ''),
    creditado: creditado || (isSaldo ? '---' : ''),
    referencia: referencia || (isSaldo ? '---' : ''),
    dataHora: parseDataHora(dataText),
  };
}

/**
 * Reconstrói o grid a partir das linhas visuais de todas as páginas. Estratégia:
 *  1. por página, detecta o cabeçalho -> âncoras de coluna + corte da moldura;
 *  2. roteia cada fragmento à coluna pela âncora mais próxima (centro X);
 *  3. segmenta registros pela sub-linha que traz a Data/Hora na coluna Data/Hora,
 *     absorvendo as sub-linhas de continuação (nomes/#número/referência quebrados).
 */
export function assembleRows(pages: PageLines[]): TransactionRow[] {
  const rows: TransactionRow[] = [];
  let anchors = DEFAULT_ANCHORS;
  let current: Bucket | null = null;

  for (const { lines } of pages) {
    const header = findHeaderLine(lines, matchesHeader);
    if (header) anchors = deriveAnchors(header, DEFAULT_ANCHORS);
    const cutY = header ? header.y : Infinity;

    for (const line of lines) {
      if (!line.text) continue;
      // Descarta moldura: acima/na linha do cabeçalho, ou texto de furniture.
      if (line.y >= cutY || FURNITURE.test(line.text) || HEADER_FURNITURE.test(line.text)) continue;

      // Nova transação começa na sub-linha que traz a Data/Hora na coluna Data/Hora.
      const startsRecord = line.items.some(
        (it) => DATE_RE.test(it.text) && nearestCol(centerOf(it), anchors) === COL.DATA_HORA,
      );
      if (startsRecord) {
        if (current) rows.push(finalizeRecord(current));
        current = newBucket(N_COLS);
      }
      if (!current) continue; // continuação órfã antes de qualquer início -> ignora

      for (const it of line.items) {
        const col = nearestCol(centerOf(it), anchors);
        current[col].push({ y: line.y, x: it.x, text: it.text });
      }
    }
  }

  if (current) rows.push(finalizeRecord(current));
  return rows;
}

function toTable(pages: PageLines[]): ExtractedTable {
  const records = assembleRows(pages);
  return {
    layout: 'lancamentos',
    label: 'Lançamentos',
    headers: HEADERS,
    rows: records.map((r) => [
      r.descricao,
      r.valor,
      r.saldo,
      r.tipo,
      r.debitado,
      r.creditado,
      r.referencia,
      r.dataHora,
    ]),
    dateFormats: { [COL.DATA_HORA]: DATE_FMT },
    reconciliation: reconcileLancamentos(records),
    highlights: [
      { label: 'créditos', value: records.filter((r) => /cr[ée]dito/i.test(r.tipo)).length },
      { label: 'débitos', value: records.filter((r) => /d[ée]bito/i.test(r.tipo)).length },
    ],
  };
}

export const lancamentosLayout: LayoutModule = {
  id: 'lancamentos',
  label: 'Lançamentos',
  matchesHeader,
  extract: toTable,
};
