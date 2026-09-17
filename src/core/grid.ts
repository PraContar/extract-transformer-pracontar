// Primitivas de reconstrução de tabela a partir das coordenadas do pdf.js.
// São agnósticas ao layout do relatório: cada layout (ver `core/layouts/`)
// fornece suas próprias âncoras de coluna e regras de segmentação.

import type { PageLines, PositionedText, VisualLine } from '../types';

/** Item cru do pdf.js (desacoplado dos tipos internos da lib). */
export type RawItem = { str?: string; transform?: number[]; width?: number };

/** Tolerância vertical (pt) para considerar dois fragmentos na mesma linha. */
const Y_TOL = 3;

/** Data no formato BR — presente em toda linha de lançamento/resumo diário. */
export const DATE_RE = /\b\d{2}\/\d{2}\/\d{4}\b/;

/** Linhas de "moldura" da página (cabeçalho/rodapé) a ignorar em qualquer layout. */
export const FURNITURE = /(ModoBank|Cliente:|P[áa]g\.|Ouvidoria|Gerado em)/i;

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
// Estágio 2 — roteamento de fragmentos para colunas
// ---------------------------------------------------------------------------

export const centerOf = (it: PositionedText) => it.x + it.w / 2;

/** Índice da coluna cuja âncora (centro X) está mais próxima de `cx`. */
export function nearestCol(cx: number, anchors: number[]): number {
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

/**
 * Recalibra as âncoras a partir do cabeçalho detectado (span min..max por coluna),
 * mantendo o padrão para colunas que não apareceram — resiliência a pequenos
 * deslocamentos/escala entre emissões do mesmo relatório.
 */
export function deriveAnchors(header: VisualLine, defaults: number[]): number[] {
  const n = defaults.length;
  const minx = new Array<number>(n).fill(Infinity);
  const maxx = new Array<number>(n).fill(-Infinity);
  const seen = new Array<boolean>(n).fill(false);
  for (const it of header.items) {
    const col = nearestCol(centerOf(it), defaults);
    minx[col] = Math.min(minx[col], it.x);
    maxx[col] = Math.max(maxx[col], it.x + it.w);
    seen[col] = true;
  }
  return defaults.map((def, i) => (seen[i] ? (minx[i] + maxx[i]) / 2 : def));
}

/** Procura, nas linhas da página, a primeira que satisfaz o teste de cabeçalho. */
export function findHeaderLine(
  lines: VisualLine[],
  matches: (text: string) => boolean,
): VisualLine | undefined {
  return lines.find((l) => matches(l.text));
}

/** Quantas páginas têm o cabeçalho deste layout (usado na detecção). */
export function countHeaderPages(
  pages: PageLines[],
  matches: (text: string) => boolean,
): number {
  let n = 0;
  for (const { lines } of pages) if (findHeaderLine(lines, matches)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Estágio 3 — acumulação de fragmentos por célula
// ---------------------------------------------------------------------------

export type Frag = { y: number; x: number; text: string };

/** Registro em construção: fragmentos acumulados por coluna. */
export type Bucket = Frag[][];

export const newBucket = (nCols: number): Bucket =>
  Array.from({ length: nCols }, () => []);

/** Junta fragmentos de uma célula: mesma sub-linha por espaço; sub-linhas por `lineSep`. */
export function joinCell(frags: Frag[], lineSep: string): string {
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
