/// <reference lib="webworker" />
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import { assembleRows, clusterPageLines } from '../core/extractRows';
import { buildWorkbook } from '../core/buildXlsx';
import type { ConvertRequest, PageLines, WorkerOut } from '../types';

// Worker interno do pdf.js: Vite empacota o worker (?worker) e o pdf.js usa a porta.
// Mais robusto que ?url dentro de um worker (evita 404 / fallback "fake worker").
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerOut, transfer: Transferable[] = []) {
  ctx.postMessage(msg, transfer);
}

ctx.onmessage = async (e: MessageEvent<ConvertRequest>) => {
  const { buffer, fileName } = e.data;
  try {
    const data = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const total = pdf.numPages;

    const pages: PageLines[] = [];
    for (let p = 1; p <= total; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const lines = clusterPageLines(
        p,
        content.items as unknown as { str?: string; transform?: number[]; width?: number }[],
      );
      pages.push({ page: p, lines });
      // Progresso por página -> barra fluida na UI.
      post({ type: 'progress', page: p, total });
    }

    const rows = assembleRows(pages);
    const { xlsx, stats } = buildWorkbook(rows, total);
    post({ type: 'done', xlsx, stats, fileName }, [xlsx]);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
