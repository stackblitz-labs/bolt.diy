export const getLanguageFromExtension = (ext: string): string => {
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    html: 'html',
    css: 'css',
    py: 'python',
    java: 'java',
    rb: 'ruby',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    swift: 'swift',
    md: 'plaintext',
    sh: 'bash',
  };
  return map[ext] || 'typescript';
};
