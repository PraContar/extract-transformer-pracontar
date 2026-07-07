export function ProgressBar({
  page,
  total,
  onCancel,
}: {
  page: number;
  total: number;
  onCancel: () => void;
}) {
  const pct = total > 0 ? Math.round((page / total) * 100) : 0;
  return (
    <div className="progress">
      <div className="progress-head">
        <span>
          Processando… página {page} de {total || '—'}
        </span>
        <span className="pct">{pct}%</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <button className="btn ghost" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
