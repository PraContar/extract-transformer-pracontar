import type { Reconciliation, TransactionRow } from '../types';
import { parseCurrencyToNumber } from './normalize.ts';

const isTransaction = (r: TransactionRow) => /cr[ée]dito|d[ée]bito/i.test(r.tipo);
const isSaldoAnterior = (r: TransactionRow) => /^Saldo Anterior/i.test(r.descricao);

/**
 * Reconcilia o saldo corrente: para cada transação, saldo[i] - saldo[i-1] deve
 * igualar o valor lançado (crédito positivo, débito negativo). Ancora no
 * "Saldo Anterior" quando presente. Ignora as linhas de saldo de rodapé.
 *
 * É a rede de segurança contra erros de extração (ex.: fronteira entre páginas,
 * campo perdido) — o mesmo tipo de defeito que a planilha-modelo original tinha.
 */
export function reconcile(rows: TransactionRow[]): Reconciliation {
  const discrepancies: Reconciliation['discrepancies'] = [];
  let prev: number | null = null;
  let checked = 0;

  rows.forEach((r, i) => {
    if (isSaldoAnterior(r)) {
      prev = r.saldo;
      return;
    }
    if (!isTransaction(r)) return; // linhas SALDO EM CONTA / BLOQUEADO / DISPONÍVEL

    const val = parseCurrencyToNumber(r.valor);
    if (prev != null && r.saldo != null && val != null) {
      checked++;
      const delta = Math.round((r.saldo - prev) * 100) / 100;
      if (Math.abs(delta - val) > 0.001) {
        discrepancies.push({ row: i + 2, expected: val, got: delta });
      }
    }
    if (r.saldo != null) prev = r.saldo;
  });

  return { ok: discrepancies.length === 0, checked, discrepancies };
}
