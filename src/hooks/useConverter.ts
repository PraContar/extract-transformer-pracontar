import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversionStats, WorkerOut } from '../types';

export type Status = 'idle' | 'parsing' | 'done' | 'error';

interface State {
  status: Status;
  page: number;
  total: number;
  stats: ConversionStats | null;
  error: string | null;
}

const initial: State = {
  status: 'idle',
  page: 0,
  total: 0,
  stats: null,
  error: null,
};

/**
 * Ponte React <-> Web Worker. Encapsula o ciclo de vida do worker, o estado
 * (máquina idle -> parsing -> done | error) e a entrega do arquivo gerado.
 */
export function useConverter() {
  const workerRef = useRef<Worker | null>(null);
  const resultRef = useRef<{ blob: Blob; name: string } | null>(null);
  const [state, setState] = useState<State>(initial);

  // Encerra o worker se o componente desmontar durante o processamento.
  useEffect(() => () => workerRef.current?.terminate(), []);

  const convert = useCallback((file: File) => {
    workerRef.current?.terminate();
    resultRef.current = null;
    setState({ ...initial, status: 'parsing' });

    const worker = new Worker(
      new URL('../workers/converter.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setState((s) => ({ ...s, page: msg.page, total: msg.total }));
      } else if (msg.type === 'done') {
        const blob = new Blob([msg.xlsx], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const name = msg.fileName.replace(/\.pdf$/i, '') + '.xlsx';
        resultRef.current = { blob, name };
        setState((s) => ({ ...s, status: 'done', stats: msg.stats }));
        worker.terminate();
      } else {
        setState((s) => ({
          ...s,
          status: 'error',
          error: msg.message || 'Erro desconhecido durante a conversão.',
        }));
        worker.terminate();
      }
    };

    worker.onerror = (e) =>
      setState((s) => ({
        ...s,
        status: 'error',
        error: e.message || 'Falha ao inicializar o processador (Web Worker).',
      }));

    // Lê o arquivo e transfere o ArrayBuffer (zero-copy) para o worker.
    file.arrayBuffer().then((buffer) => {
      worker.postMessage({ type: 'convert', buffer, fileName: file.name }, [buffer]);
    });
  }, []);

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(initial);
  }, []);

  const download = useCallback(() => {
    const r = resultRef.current;
    if (!r) return;
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const reset = useCallback(() => {
    resultRef.current = null;
    setState(initial);
  }, []);

  return { ...state, convert, cancel, download, reset };
}
