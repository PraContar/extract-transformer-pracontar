import type { DailySummaryRow, Reconciliation, TransactionRow } from '../types';
import { parseCurrencyToNumber } from './normalize.ts';

const isTransaction = (r: TransactionRow) => /cr[ée]dito|d[ée]bito/i.test(r.tipo);
const isSaldoAnterior = (r: TransactionRow) => /^Saldo Anterior/i.test(r.descricao);

/** Duas quantias monetárias são iguais a menos de arredondamento de centavo. */
const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Layout "Lançamentos" — reconcilia o saldo corrente: para cada transação,
 * saldo[i] - saldo[i-1] deve igualar o valor lançado (crédito positivo, débito
 * negativo). Ancora no "Saldo Anterior" quando presente. Ignora as linhas de
 * saldo de rodapé.
 *
 * É a rede de segurança contra erros de extração (ex.: fronteira entre páginas,
 * campo perdido) — o mesmo tipo de defeito que a planilha-modelo original tinha.
 */
export function reconcileLancamentos(rows: TransactionRow[]): Reconciliation {
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
      const delta = round2(r.saldo - prev);
      if (!eq(delta, val)) {
        discrepancies.push({ row: i + 2, expected: val, got: delta });
      }
    }
    if (r.saldo != null) prev = r.saldo;
  });

  return { ok: discrepancies.length === 0, checked, discrepancies };
}

/**
 * Layout "Extrato Consolidado" — reconcilia o resumo diário em três frentes:
 *  1. saldo final = saldo inicial + entradas - saídas (identidade do dia);
 *  2. saldo inicial do dia = saldo final do dia anterior (continuidade);
 *  3. linha TOTAIS = soma das entradas/saídas dos dias.
 */
export function reconcileConsolidado(rows: DailySummaryRow[]): Reconciliation {
  const discrepancies: Reconciliation['discrepancies'] = [];
  let checked = 0;
  let prevFinal: number | null = null;
  let somaEntradas = 0;
  let somaSaidas = 0;

  rows.forEach((r, i) => {
    const line = i + 2; // 1 = cabeçalho

    if (r.data == null) {
      // Linha de fechamento: confere os totais contra a soma dos dias.
      if (r.entradas != null) {
        checked++;
        if (!eq(r.entradas, somaEntradas)) {
          discrepancies.push({ row: line, expected: round2(somaEntradas), got: r.entradas });
        }
      }
      if (r.saidas != null) {
        checked++;
        if (!eq(r.saidas, somaSaidas)) {
          discrepancies.push({ row: line, expected: round2(somaSaidas), got: r.saidas });
        }
      }
      return;
    }

    if (r.entradas != null) somaEntradas += r.entradas;
    if (r.saidas != null) somaSaidas += r.saidas;

    if (r.saldoInicial != null && r.entradas != null && r.saidas != null && r.saldoFinal != null) {
      checked++;
      const esperado = round2(r.saldoInicial + r.entradas - r.saidas);
      if (!eq(esperado, r.saldoFinal)) {
        discrepancies.push({ row: line, expected: esperado, got: r.saldoFinal });
      }
    }

    if (prevFinal != null && r.saldoInicial != null) {
      checked++;
      if (!eq(prevFinal, r.saldoInicial)) {
        discrepancies.push({ row: line, expected: prevFinal, got: r.saldoInicial });
      }
    }
    if (r.saldoFinal != null) prevFinal = r.saldoFinal;
  });

  return { ok: discrepancies.length === 0, checked, discrepancies };
}
