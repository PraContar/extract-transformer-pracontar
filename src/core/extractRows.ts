import type { PageLines, PositionedText, TransactionRow, VisualLine } from '../types';
import { formatDescricao, parseCurrencyToNumber, parseDataHora } from './normalize.ts';

/** Item cru do pdf.js (desacoplado dos tipos internos da lib). */
type RawItem = { str?: string; transform?: number[]; width?: number };

/** Tolerância vertical (pt) para considerar dois fragmentos na mesma linha. */
const Y_TOL = 3;

/**
 * Centros X (px) de cada coluna, calibrados no template ModoBank (página 792x612).
 * Ordem: Descrição, Valor, Saldo, Tipo, Debitado, Creditado, Referência, Data/Hora.
 * Usados como fallback; quando o cabeçalho da página é detectado, as âncoras são
 * recalibradas a partir dele (resiliência a pequenos deslocamentos/escala).
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

/**
 * Início de um registro: a sub-linha que carrega a Data/Hora na coluna Data/Hora.
 * Cada lançamento tem exatamente uma data na sua 1ª sub-linha — critério robusto e
 * independente do tipo de descrição (Recebimento Pix, Ticket, Serviços, Saldo, etc.).
 */
const DATE_RE = /\b\d{2}\/\d{2}\/\d{4}\b/;
/** Linhas de "moldura" da página (cabeçalho/rodapé) a ignorar. */
const FURNITURE =
  /(ModoBank|Cliente:|P[áa]g\.|Descri[çc][ãa]o\s+Valor\s+Saldo|Ouvidoria|Gerado em)/i;

// ---------------------------------------------------------------------------
// Estágio 1 — clustering por linha visual
// ---------------------------------------------------------------------------

/**
 * Agrupa os fragmentos de texto de UMA página em "linhas visuais",
 * clusterizando por coordenada Y e ordenando por X.
 */
export function clusterPageLines(page: number, items: RawItem[]): VisualLine[] {
  const positioned: PositionedText[] = [];
  for (const it of items) {
    const text = it.str;
    if (!text || !text.trim() || !it.transform) continue;
    positioned.push({ x: it.transform[4], y: it.transform[5], w: it.width ?? 0, text });
  }
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: VisualLine[] = [];
  for (const t of positioned) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - t.y) <= Y_TOL) {
      last.items.push(t);
    } else {
      lines.push({ page, y: t.y, items: [t], text: '' });
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim();
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Estágio 2 — reconstrução do grid + montagem dos registros
// ---------------------------------------------------------------------------

const centerOf = (it: PositionedText) => it.x + it.w / 2;

function nearestCol(cx: number, anchors: number[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const d = Math.abs(anchors[i] - cx);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function findHeaderLine(lines: VisualLine[]): VisualLine | undefined {
  return lines.find(
    (l) => /Descri/i.test(l.text) && /Data\/?Hora/i.test(l.text) && /Saldo/i.test(l.text),
  );
}

/** Recalibra as âncoras a partir do cabeçalho detectado (span min..max por coluna). */
function deriveAnchors(header: VisualLine): number[] {
  const minx = new Array<number>(N_COLS).fill(Infinity);
  const maxx = new Array<number>(N_COLS).fill(-Infinity);
  const seen = new Array<boolean>(N_COLS).fill(false);
  for (const it of header.items) {
    const col = nearestCol(centerOf(it), DEFAULT_ANCHORS);
    minx[col] = Math.min(minx[col], it.x);
    maxx[col] = Math.max(maxx[col], it.x + it.w);
    seen[col] = true;
  }
  return DEFAULT_ANCHORS.map((def, i) => (seen[i] ? (minx[i] + maxx[i]) / 2 : def));
}

type Frag = { y: number; x: number; text: string };

/** Junta fragmentos de uma célula: mesma sub-linha por espaço; sub-linhas por `lineSep`. */
function joinCell(frags: Frag[], lineSep: string): string {
  if (frags.length === 0) return '';
  const byLine = new Map<number, Frag[]>();
  for (const f of frags) {
    const key = Math.round(f.y);
    const arr = byLine.get(key);
    if (arr) arr.push(f);
    else byLine.set(key, [f]);
  }
  const ys = [...byLine.keys()].sort((a, b) => b - a);
  return ys
    .map((y) =>
      byLine
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((f) => f.text)
        .join(' '),
    )
    .join(lineSep)
    .trim();
}

/** Registro em construção: fragmentos acumulados por coluna. */
type Bucket = Frag[][];
const newBucket = (): Bucket => Array.from({ length: N_COLS }, () => []);

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
 * Reconstrói o grid a partir das linhas visuais de todas as páginas e devolve
 * os registros (linhas da planilha). Estratégia:
 *  1. por página, detecta o cabeçalho -> âncoras de coluna + corte da moldura;
 *  2. roteia cada fragmento à coluna pela âncora mais próxima (centro X);
 *  3. segmenta registros por âncora textual (rótulo de início na col. Descrição),
 *     absorvendo as sub-linhas de continuação (nomes/#número/referência quebrados).
 */
export function assembleRows(pages: PageLines[]): TransactionRow[] {
  const rows: TransactionRow[] = [];
  let anchors = DEFAULT_ANCHORS;
  let current: Bucket | null = null;

  for (const { lines } of pages) {
    const header = findHeaderLine(lines);
    if (header) anchors = deriveAnchors(header);
    const cutY = header ? header.y : Infinity;

    for (const line of lines) {
      if (!line.text) continue;
      // Descarta moldura: acima/na linha do cabeçalho, ou texto de furniture.
      if (line.y >= cutY || FURNITURE.test(line.text)) continue;

      // Nova transação começa na sub-linha que traz a Data/Hora na coluna Data/Hora.
      const startsRecord = line.items.some(
        (it) => DATE_RE.test(it.text) && nearestCol(centerOf(it), anchors) === COL.DATA_HORA,
      );
      if (startsRecord) {
        if (current) rows.push(finalizeRecord(current));
        current = newBucket();
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
