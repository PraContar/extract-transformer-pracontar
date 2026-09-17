import type { ExtractedTable, LayoutId, PageLines } from '../../types';

/**
 * Um layout de relatório ModoBank. Cada layout sabe (a) reconhecer sua linha de
 * cabeçalho — é a "regex" testada na detecção — e (b) extrair a tabela.
 */
export interface LayoutModule {
  id: LayoutId;
  /** Nome exibido na UI. */
  label: string;
  /** Teste de cabeçalho: recebe o texto de uma linha visual. */
  matchesHeader(text: string): boolean;
  extract(pages: PageLines[]): ExtractedTable;
}
