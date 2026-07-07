// Funções puras de normalização de campo (De -> Para).
// Implementadas de verdade já na Etapa 1: são testáveis isoladamente e
// de-riscam a Etapa 2 (montagem dos registros).

/**
 * Converte moeda BR impressa em número.
 *   "R$ 418.617,70"  -> 418617.7
 *   "-R$ 40.000,00"  -> -40000
 *   "---" | ""        -> null
 */
export function parseCurrencyToNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.replace(/\s/g, '');
  if (!/\d/.test(s)) return null; // "---", vazio, etc.
  const negative = s.includes('-');
  const digits = s
    .replace(/[^\d.,]/g, '') // remove "R$", "-", espaços
    .replace(/\./g, '') // remove separador de milhar
    .replace(',', '.'); // vírgula decimal -> ponto
  const n = Number(digits);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

/**
 * "01/04/2026 07:55:21" -> Date (horário local).
 * Aceita também apenas a data ("01/04/2026" -> 00:00:00). Retorna null se não casar.
 */
export function parseDataHora(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const m = raw.match(
    /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (!m) return null;
  const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = m;
  return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
}

/**
 * Formata a coluna Descrição preservando o número da transação (decisão do cliente):
 *   "Recebimento Pix (CRÉDITO) - Transação #0000000000"
 *     -> "Recebimento Pix (CRÉDITO)\n#0000000000"
 * Sem "- Transação #", devolve o texto original limpo.
 */
export function formatDescricao(raw: string): string {
  const m = raw.match(/^(.*?)\s*-\s*Transa[çc][ãa]o\s*(#\d+)/i);
  if (m) return `${m[1].trim()}\n${m[2]}`;
  return raw.trim();
}
