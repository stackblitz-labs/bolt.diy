// Utility to import Figma designs and convert them to basic React components
import type { Message } from 'ai';
import { generateId } from './fileUtils';
import { escapeBoltTags } from './projectCommands';

/**
 * Extract the file key from a Figma URL
 */
function extractFileKey(url: string): string {
  const match = url.match(/file\/(\w+)/);

  if (!match) {
    throw new Error('Invalid Figma URL');
  }

  return match[1];
}

interface GeneratedComponent {
  name: string;
  code: string;
}

/**
 * Recursively collect frame nodes from the Figma document
 */
function collectFrames(node: any, frames: any[]) {
  if (node.type === 'FRAME') {
    frames.push(node);
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child: any) => collectFrames(child, frames));
  }
}

function figmaFramesToComponents(frames: any[]): GeneratedComponent[] {
  return frames.map((frame) => {
    const name = frame.name.replace(/[^a-zA-Z0-9]/g, '') || 'Component';
    const code = `export function ${name}() {\n  return <div>${frame.name}</div>;\n}`;

    return { name, code };
  });
}

/**
 * Create chat messages from a Figma design
 */
export async function createChatFromFigma(figmaUrl: string, token: string): Promise<Message[]> {
  const fileKey = extractFileKey(figmaUrl);
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { 'X-Figma-Token': token },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Figma file: ${res.status}`);
  }

  const data = (await res.json()) as { document: unknown };
  const frames: any[] = [];
  collectFrames((data as any).document, frames);

  const components = figmaFramesToComponents(frames);
  const componentActions = components
    .map(
      (c) => `<boltAction type="file" filePath="app/components/${c.name}.tsx">${escapeBoltTags(c.code)}</boltAction>`,
    )
    .join('\n');

  const assistantMessage: Message = {
    role: 'assistant',
    content: `Converted Figma design from ${figmaUrl} to React components.\n<boltArtifact id="figma-components" title="Figma Components" type="bundled">${componentActions}</boltArtifact>`,
    id: generateId(),
    createdAt: new Date(),
  };

  const userMessage: Message = {
    role: 'user',
    content: `Import design from ${figmaUrl}`,
    id: generateId(),
    createdAt: new Date(),
  };

  return [userMessage, assistantMessage];
}
