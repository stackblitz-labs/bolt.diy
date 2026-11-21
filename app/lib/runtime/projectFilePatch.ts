function splitLines(content: string) {
  return content.split(/(?<=\n)/);
}

export function numberProjectLines(content: string) {
  return splitLines(content).map((line, index) => `${index + 1}: ${line.replace(/\r?\n$/, '')}`);
}

export function replaceProjectLines(content: string, { start, end }: { start: number; end: number }, newText: string) {
  const lines = splitLines(content);

  if (end < start || end > lines.length) {
    throw new Error(
      `Patch conflict: requested lines ${start} through ${end}, but the file has ${lines.length} numbered lines. Read the file again with numbered: true and select lines within its lineCount, inclusive.`,
    );
  }

  const selected = lines.slice(start - 1, end);
  const lineWithEnding = selected.find((line) => line.endsWith('\n')) ?? lines[start - 2];
  const newline = lineWithEnding?.endsWith('\r\n') ? '\r\n' : '\n';
  const finalEnding = lines[end - 1].match(/\r?\n$/)?.[0] ?? '';
  const replacement = newText ? newText.replace(/\r?\n$/, '').replace(/\r?\n/g, newline) + finalEnding : '';

  return lines.slice(0, start - 1).join('') + replacement + lines.slice(end).join('');
}

export function replaceProjectText(content: string, oldText: string, newText: string) {
  const normalized = content.replace(/\r\n/g, '\n');
  const needle = oldText.replace(/\r\n/g, '\n');

  let start = normalized.indexOf(needle);

  if (start === -1) {
    throw new Error(
      'Patch conflict: oldText was not found. Use project_read_file with numbered: true, then use project_replace_lines with the returned revision and the intended lines.',
    );
  }

  if (normalized.indexOf(needle, start + 1) !== -1) {
    throw new Error('Patch conflict: oldText is ambiguous; it must match exactly once.');
  }

  let end = start + needle.length;

  // Translate the matching range back to the original string before splicing.
  for (const { index } of content.matchAll(/\r\n/g)) {
    if (index >= end) {
      break;
    }

    if (index < start) {
      start++;
    }

    end++;
  }

  const originalMatch = content.slice(start, end);
  const newline = originalMatch.match(/\r?\n/)?.[0];
  const replacement = originalMatch !== oldText && newline ? newText.replace(/\r?\n/g, newline) : newText;

  return content.slice(0, start) + replacement + content.slice(end);
}
