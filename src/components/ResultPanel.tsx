import type { ConversionStats } from '../types';

function Reconciliation({ rec }: { rec: ConversionStats['reconciliation'] }) {
  if (rec.ok) {
    return (
      <p className="recon ok">
        ✓ Saldos conferidos — {rec.checked.toLocaleString('pt-BR')} transações consistentes
      </p>
    );
  }
  const rowsList = rec.discrepancies
    .slice(0, 5)
    .map((d) => d.row)
    .join(', ');
  const extra = rec.discrepancies.length > 5 ? '…' : '';
  return (
    <p className="recon warn">
      ⚠️ {rec.discrepancies.length.toLocaleString('pt-BR')} divergência(s) de saldo
      {rowsList && <> — verifique a(s) linha(s) {rowsList}{extra}</>}
    </p>
  );
}

export function ResultPanel({
  stats,
  onDownload,
  onReset,
}: {
  stats: ConversionStats;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <div className="result">
      <div className="result-icon">✅</div>
      <h2>Conversão concluída</h2>
      <ul className="stats">
        <li>
          <strong>{stats.totalRows.toLocaleString('pt-BR')}</strong>
          <span>linhas</span>
        </li>
        <li>
          <strong>{stats.creditos.toLocaleString('pt-BR')}</strong>
          <span>créditos</span>
        </li>
        <li>
          <strong>{stats.debitos.toLocaleString('pt-BR')}</strong>
          <span>débitos</span>
        </li>
        <li>
          <strong>{stats.pages.toLocaleString('pt-BR')}</strong>
          <span>páginas</span>
        </li>
      </ul>
      <Reconciliation rec={stats.reconciliation} />
      <div className="actions">
        <button className="btn primary" onClick={onDownload}>
          Baixar .xlsx
        </button>
        <button className="btn ghost" onClick={onReset}>
          Converter outro
        </button>
      </div>
    </div>
  );
}
