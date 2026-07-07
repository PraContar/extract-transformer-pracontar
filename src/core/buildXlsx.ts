import * as XLSX from 'xlsx';
import type { ConversionStats, TransactionRow } from '../types';
import { reconcile } from './validate.ts';

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
const DATA_HORA_COL = 7; // índice 0-based

// Serial do Excel calculado via UTC, tratando os componentes locais como "wall clock".
// Evita o bug do SheetJS em fusos com offset histórico não-inteiro (ex.: Brasil pré-1914,
// UTC-03:06:28), que corromperia os segundos da data.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
function toExcelSerial(d: Date): number {
  const wall = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
  return (wall - EXCEL_EPOCH_UTC) / 86400000;
}

/**
 * Monta a planilha final (SheetJS) a partir dos registros. Saldo sai como número
 * (formato General) e Data/Hora como data tipada com o formato do modelo. Devolve
 * o ArrayBuffer + estatísticas (incluindo a reconciliação de saldo).
 */
export function buildWorkbook(
  rows: TransactionRow[],
  pageCount: number,
): { xlsx: ArrayBuffer; stats: ConversionStats } {
  const wb = XLSX.utils.book_new();

  // Data/Hora fica como null aqui; é preenchida como serial numérico abaixo.
  const aoa: (string | number | null)[][] = [HEADERS];
  for (const r of rows) {
    aoa.push([r.descricao, r.valor, r.saldo, r.tipo, r.debitado, r.creditado, r.referencia, null]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Coluna Data/Hora: serial do Excel + formato do modelo (data tipada, sem drift de fuso).
  for (let i = 0; i < rows.length; i++) {
    const d = rows[i].dataHora;
    if (!d) continue;
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: DATA_HORA_COL });
    ws[addr] = { t: 'n', v: toExcelSerial(d), z: DATE_FMT };
  }

  // Nome da aba no padrão do modelo: "Table001 (Page 1-N)".
  XLSX.utils.book_append_sheet(wb, ws, `Table001 (Page 1-${pageCount})`);

  const xlsx = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const stats: ConversionStats = {
    pages: pageCount,
    totalRows: rows.length,
    creditos: rows.filter((r) => /cr[ée]dito/i.test(r.tipo)).length,
    debitos: rows.filter((r) => /d[ée]bito/i.test(r.tipo)).length,
    reconciliation: reconcile(rows),
  };

  return { xlsx, stats };
}
