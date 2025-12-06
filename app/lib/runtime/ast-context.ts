import type Parser from 'web-tree-sitter';

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'javascript',
  css: 'css',
  html: 'html',
  json: 'json',
  py: 'python',
  rs: 'rust',
  go: 'go',
};

export const ENABLE_AST_MATCHING =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.ENABLE_AST_MATCHING === 'true'
    : false;

let parserInstance: Parser | null = null;
const languageCache = new Map<string, Parser.Language>();

async function getParser(): Promise<Parser> {
  if (parserInstance) {
    return parserInstance;
  }

  const parserModule = (await import('web-tree-sitter')).default;
  await parserModule.init();
  parserInstance = new parserModule();

  return parserInstance;
}

export function getLanguageFromPath(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (!ext) {
    return null;
  }

  return LANGUAGE_MAP[ext] ?? null;
}

async function loadLanguage(langName: string): Promise<Parser.Language> {
  if (languageCache.has(langName)) {
    return languageCache.get(langName)!;
  }

  const parser = await getParser();
  const wasmPath = `/parsers/tree-sitter-${langName}.wasm`;
  const language = await (parser as any).constructor.Language.load(wasmPath);
  languageCache.set(langName, language);

  return language;
}

export async function getAstContext(filePath: string, code: string): Promise<Parser.Tree | null> {
  if (!ENABLE_AST_MATCHING) {
    return null;
  }

  const lang = getLanguageFromPath(filePath);

  if (!lang) {
    return null;
  }

  try {
    const parser = await getParser();
    const language = await loadLanguage(lang);
    parser.setLanguage(language);

    return parser.parse(code);
  } catch (error) {
    console.warn('AST parsing failed', error);
    return null;
  }
}
