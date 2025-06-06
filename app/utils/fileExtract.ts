import mammoth from 'mammoth/mammoth.browser';

/*
 * Lazily load pdf.js modules so that server environments don't attempt to
 * resolve them during the initial import of this file. This avoids errors when
 * running in Node.js where the browser-specific build of pdf.js isn't
 * available.
 */
async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  const pdfWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default ?? pdfWorker;

  return pdfjsLib;
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texts.push(content.items.map((item: any) => item.str).join(' '));
    }

    return texts.join('\n');
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    return result.value;
  }

  return file.text();
}
