// Registro de layouts + detecção automática.
//
// O mesmo fluxo de conversão atende a todos os relatórios do ModoBank: em vez de
// escolher o formato na UI, o conversor testa as regras de cada layout contra o
// PDF e usa a que realmente reconhece o documento.

import type { ExtractedTable, PageLines } from '../../types';
import { countHeaderPages } from '../grid.ts';
import { consolidadoLayout } from './consolidado.ts';
import { lancamentosLayout } from './lancamentos.ts';
import type { LayoutModule } from './types.ts';

export type { LayoutModule } from './types.ts';

/** Layouts conhecidos, na ordem de preferência em caso de empate. */
export const LAYOUTS: LayoutModule[] = [lancamentosLayout, consolidadoLayout];

/**
 * Escolhe o layout do PDF e extrai a tabela.
 *
 * 1. pontua cada layout pelo nº de páginas em que seu cabeçalho casa;
 * 2. tenta extrair com os candidatos pontuados (maior nº de páginas primeiro) e
 *    aceita o primeiro que produzir linhas — a regex que "reconhece" o cabeçalho
 *    só vale se a extração de fato render registros;
 * 3. se nenhum casar o cabeçalho (emissão com rótulos diferentes), tenta todos e
 *    fica com o que extrair mais linhas.
 *
 * Lança erro quando nenhum layout consegue extrair uma única linha.
 */
export function extractTable(pages: PageLines[]): ExtractedTable {
  const scored = LAYOUTS.map((layout) => ({
    layout,
    hits: countHeaderPages(pages, layout.matchesHeader),
  })).sort((a, b) => b.hits - a.hits);

  for (const { layout, hits } of scored) {
    if (hits === 0) continue;
    const table = layout.extract(pages);
    if (table.rows.length > 0) return table;
  }

  // Nenhum cabeçalho reconhecido (ou reconhecido mas sem linhas): força a
  // extração com cada layout e fica com o melhor resultado.
  let best: ExtractedTable | null = null;
  for (const layout of LAYOUTS) {
    const table = layout.extract(pages);
    if (table.rows.length > (best?.rows.length ?? 0)) best = table;
  }
  if (best) return best;

  throw new Error(
    `Não foi possível identificar o formato deste PDF. Layouts suportados: ${LAYOUTS.map(
      (l) => l.label,
    ).join(', ')}.`,
  );
}
