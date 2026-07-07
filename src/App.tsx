import { Dropzone } from './components/Dropzone';
import { ProgressBar } from './components/ProgressBar';
import { ResultPanel } from './components/ResultPanel';
import { useConverter } from './hooks/useConverter';

export default function App() {
  const conv = useConverter();

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-logo" role="img" aria-label="Pracontar Contabilidade Digital" />
        <h1>Conversor de Extrato → Excel</h1>
        <p>Transforme o extrato ModoBank (PDF) em planilha .xlsx pronta para uso.</p>
      </header>

      <main className="card">
        {conv.status === 'idle' && <Dropzone onFile={conv.convert} />}

        {conv.status === 'parsing' && (
          <ProgressBar page={conv.page} total={conv.total} onCancel={conv.cancel} />
        )}

        {conv.status === 'done' && conv.stats && (
          <ResultPanel stats={conv.stats} onDownload={conv.download} onReset={conv.reset} />
        )}

        {conv.status === 'error' && (
          <div className="error">
            <div className="result-icon">⚠️</div>
            <h2>Falha na conversão</h2>
            <p className="err-msg">{conv.error}</p>
            <button className="btn ghost" onClick={conv.reset}>
              Tentar novamente
            </button>
          </div>
        )}
      </main>

      <footer className="foot">
        <span>🔒 Processado 100% no seu navegador · Pracontar Contabilidade Digital</span>
      </footer>
    </div>
  );
}
