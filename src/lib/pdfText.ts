import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Piece {
  str: string;
  x: number;
  y: number;
}

/** Extrai o texto do PDF reconstruindo as linhas pela posição (equivale ao modo "layout"), para não perder a coluna dos valores. */
export async function pdfToText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pieces: Piece[] = [];
    for (const it of content.items) {
      if ("str" in it && it.str.trim() !== "") pieces.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
    }
    pieces.sort((a, b) => b.y - a.y || a.x - b.x);
    let line: Piece[] = [];
    let lineY: number | null = null;
    const flush = () => {
      if (line.length) out.push(line.sort((a, b) => a.x - b.x).map((l) => l.str).join("   "));
      line = [];
    };
    for (const piece of pieces) {
      if (lineY !== null && Math.abs(piece.y - lineY) > 3) flush();
      if (line.length === 0) lineY = piece.y;
      line.push(piece);
    }
    flush();
    out.push("");
  }
  return out.join("\n");
}
