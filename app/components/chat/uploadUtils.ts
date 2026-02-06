export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_ATTACHMENT_TEXT_CHARS = 20000;

export const ACCEPTED_ATTACHMENT_TYPES =
  'image/*,.txt,.md,.markdown,.json,.csv,.ts,.tsx,.js,.jsx,.css,.html,.yml,.yaml,.toml,.env,.log,.pdf';

const ALLOWED_MIME_PREFIXES = ['image/', 'text/'];
const ALLOWED_MIME_TYPES = new Set(['application/json', 'application/pdf']);
const ALLOWED_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'html',
  'yml',
  'yaml',
  'toml',
  'env',
  'log',
  'pdf',
]);

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') {
    return true;
  }

  return file.name.toLowerCase().endsWith('.pdf');
}

export function isSupportedAttachment(file: File): boolean {
  if (ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return true;
  }

  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  return extension ? ALLOWED_EXTENSIONS.has(extension) : false;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsText(file);
  });
}

export async function readPdfAsText(file: File): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = await file.arrayBuffer();
  const loadingTask = getDocument({ data, disableWorker: true } as any);
  const pdf = await loadingTask.promise;
  let text = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str || '').join(' ');
    text += `${pageText}\n`;
  }

  return text.trim();
}
