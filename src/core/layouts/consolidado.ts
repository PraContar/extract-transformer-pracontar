// Layout "Extrato Consolidado": uma linha por dia + linha de TOTAIS, 6 colunas.
// Cabeçalho: Data | Saldo inicial | Entradas | Saídas | Saldo do dia | Saldo final

import type { DailySummaryRow, ExtractedTable, PageLines } from '../../types';
import { parseCurrencyToNumber, parseDataHora } from '../normalize.ts';
import { reconcileConsolidado } from '../validate.ts';
import {
  DATE_RE,
  FURNITURE,
  centerOf,
  deriveAnchors,
  findHeaderLine,
  joinCell,
  nearestCol,
  newBucket,
} from '../grid.ts';
import type { LayoutModule } from './types.ts';

/** Centros X (px) das colunas, calibrados no template (página 792x612). */
const DEFAULT_ANCHORS = [23.5, 343.6, 439, 532.5, 612.8, 706.3];
const N_COLS = 6;
const COL = {
  DATA: 0,
  SALDO_INICIAL: 1,
  ENTRADAS: 2,
  SAIDAS: 3,
  SALDO_DIA: 4,
  SALDO_FINAL: 5,
} as const;

const HEADERS = ['Data', 'Saldo inicial', 'Entradas', 'Saídas', 'Saldo do dia', 'Saldo final'];

/** Coluna Data traz apenas a data (sem hora) neste relatório. */
const DATE_FMT = 'm/d/yy';

/** Regex que identifica a linha de cabeçalho deste layout. */
const HEADER_RE = [/\bData\b/i, /Saldo\s+inicial/i, /Entradas/i, /Sa[íi]das/i, /Saldo\s+final/i];
const matchesHeader = (text: string) => HEADER_RE.every((re) => re.test(text));

/** Rótulo da linha de fechamento do período. */
const TOTAIS_RE = /^TOTAIS\b/i;

/**
 * Cada dia ocupa exatamente uma linha visual: basta rotear os fragmentos pela
 * âncora mais próxima. A segmentação é por linha (não há continuação).
 */
export function assembleDailyRows(pages: PageLines[]): DailySummaryRow[] {
  const rows: DailySummaryRow[] = [];
  let anchors = DEFAULT_ANCHORS;

  for (const { lines } of pages) {
    const header = findHeaderLine(lines, matchesHeader);
    if (header) anchors = deriveAnchors(header, DEFAULT_ANCHORS);
    const cutY = header ? header.y : Infinity;

    for (const line of lines) {
      if (!line.text) continue;
      if (line.y >= cutY || FURNITURE.test(line.text)) continue;

      const bucket = newBucket(N_COLS);
      for (const it of line.items) {
        bucket[nearestCol(centerOf(it), anchors)].push({ y: line.y, x: it.x, text: it.text });
      }

      // A 1ª coluna define se a linha é um dia ("dd/mm/aaaa") ou o fechamento ("TOTAIS").
      const dataText = joinCell(bucket[COL.DATA], ' ');
      const isDay = DATE_RE.test(dataText);
      const isTotals = TOTAIS_RE.test(dataText);
      if (!isDay && !isTotals) continue;

      rows.push({
        data: isDay ? parseDataHora(dataText) : null,
        rotulo: isDay ? '' : 'TOTAIS',
        saldoInicial: parseCurrencyToNumber(joinCell(bucket[COL.SALDO_INICIAL], ' ')),
        entradas: parseCurrencyToNumber(joinCell(bucket[COL.ENTRADAS], ' ')),
        saidas: parseCurrencyToNumber(joinCell(bucket[COL.SAIDAS], ' ')),
        saldoDia: parseCurrencyToNumber(joinCell(bucket[COL.SALDO_DIA], ' ')),
        saldoFinal: parseCurrencyToNumber(joinCell(bucket[COL.SALDO_FINAL], ' ')),
      });
    }
  }

  return rows;
}

function toTable(pages: PageLines[]): ExtractedTable {
  const records = assembleDailyRows(pages);
  return {
    layout: 'consolidado',
    label: 'Extrato Consolidado',
    headers: HEADERS,
    rows: records.map((r) => [
      r.data ?? r.rotulo,
      r.saldoInicial,
      r.entradas,
      r.saidas,
      r.saldoDia,
      r.saldoFinal,
    ]),
    dateFormats: { [COL.DATA]: DATE_FMT },
    reconciliation: reconcileConsolidado(records),
    highlights: [{ label: 'dias', value: records.filter((r) => r.data != null).length }],
  };
}

export const consolidadoLayout: LayoutModule = {
  id: 'consolidado',
  label: 'Extrato Consolidado',
  matchesHeader,
  extract: toTable,
};
