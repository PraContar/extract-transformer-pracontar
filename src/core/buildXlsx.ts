import * as XLSX from 'xlsx';
import type { CellValue, ConversionStats, ExtractedTable } from '../types';

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
 * Monta a planilha final (SheetJS) a partir da tabela extraída — qualquer que
 * seja o layout de origem. Valores numéricos saem como número (formato General)
 * e datas como data tipada com o formato do layout. Devolve o ArrayBuffer +
 * estatísticas (incluindo a reconciliação).
 */
export function buildWorkbook(
  table: ExtractedTable,
  pageCount: number,
): { xlsx: ArrayBuffer; stats: ConversionStats } {
  const wb = XLSX.utils.book_new();

  // Datas ficam como null aqui; são preenchidas como serial numérico abaixo.
  const aoa: (string | number | null)[][] = [table.headers];
  for (const row of table.rows) {
    aoa.push(row.map((v) => (v instanceof Date ? null : (v as string | number | null))));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Colunas de data: serial do Excel + formato do layout (sem drift de fuso).
  for (const [key, fmt] of Object.entries(table.dateFormats)) {
    const c = Number(key);
    table.rows.forEach((row: CellValue[], i) => {
      const v = row[c];
      if (!(v instanceof Date)) return;
      const addr = XLSX.utils.encode_cell({ r: i + 1, c });
      ws[addr] = { t: 'n', v: toExcelSerial(v), z: fmt };
    });
  }

  // Nome da aba no padrão do modelo: "Table001 (Page 1-N)".
  XLSX.utils.book_append_sheet(wb, ws, `Table001 (Page 1-${pageCount})`);

  const xlsx = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const stats: ConversionStats = {
    pages: pageCount,
    totalRows: table.rows.length,
    layout: table.layout,
    layoutLabel: table.label,
    highlights: table.highlights,
    reconciliation: table.reconciliation,
  };

  return { xlsx, stats };
}
