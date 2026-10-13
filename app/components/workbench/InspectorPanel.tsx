import { useEffect, useState } from 'react';
import type { ElementInfo } from './Inspector';

const editableStyles = [
  { property: 'color', label: 'Text color', type: 'color' },
  { property: 'background-color', label: 'Background', type: 'color' },
  { property: 'font-size', label: 'Font size', type: 'text' },
  { property: 'font-weight', label: 'Font weight', type: 'text' },
  { property: 'text-align', label: 'Text alignment', type: 'select' },
  { property: 'padding', label: 'Padding', type: 'text' },
  { property: 'margin', label: 'Margin', type: 'text' },
  { property: 'border-radius', label: 'Corner radius', type: 'text' },
  { property: 'width', label: 'Width', type: 'text' },
  { property: 'height', label: 'Height', type: 'text' },
] as const;

const toColorInputValue = (value: string) => {
  if (/^#[\da-f]{6}$/i.test(value)) {
    return value;
  }

  const shortHex = /^#([\da-f]{3})$/i.exec(value);

  if (shortHex) {
    return `#${shortHex[1]
      .split('')
      .map((digit) => digit + digit)
      .join('')}`;
  }

  const rgbMatch = /^rgba?\(([^)]+)\)/i.exec(value);

  if (!rgbMatch) {
    return '#000000';
  }

  const channels = rgbMatch[1]
    .split(/[,/\s]+/)
    .filter(Boolean)
    .slice(0, 3);

  if (channels.length !== 3) {
    return '#000000';
  }

  return `#${channels
    .map((channel) => {
      const parsed = channel.endsWith('%') ? (Number.parseFloat(channel) * 255) / 100 : Number.parseFloat(channel);
      return Math.max(0, Math.min(255, Math.round(parsed)))
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
};

interface InspectorPanelProps {
  selectedElement: ElementInfo | null;
  onStyleChange: (property: string, value: string) => void;
  onTextChange: (value: string) => void;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
  onClose: () => void;
}

export const InspectorPanel = ({
  selectedElement,
  onStyleChange,
  onTextChange,
  onUndo,
  onReset,
  canUndo,
  onClose,
}: InspectorPanelProps) => {
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    setTextValue(selectedElement?.textContent ?? '');
  }, [selectedElement?.displayText, selectedElement?.textContent]);

  if (!selectedElement) {
    return null;
  }

  const currentValue = (property: string) =>
    selectedElement.visualEdits?.find((edit) => edit.property === property)?.value ??
    selectedElement.styles[property] ??
    '';

  return (
    <aside className="absolute right-3 top-14 z-30 flex max-h-[calc(100%-4.25rem)] w-72 flex-col overflow-hidden rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-2xl">
      <header className="flex items-center justify-between border-b border-bolt-elements-borderColor px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Visual edits</h3>
          <p className="truncate font-mono text-xs text-bolt-elements-textTertiary">
            {selectedElement.tagName.toLowerCase()}
            {selectedElement.id
              ? `#${selectedElement.id}`
              : selectedElement.className
                ? `.${selectedElement.className.split(' ')[0]}`
                : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close visual edits"
          className="rounded bg-bolt-elements-background-depth-1 p-1 text-bolt-elements-textSecondary transition-colors hover:bg-bolt-elements-background-depth-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          ×
        </button>
      </header>

      <div className="overflow-y-auto p-3">
        <label className="mb-3 block text-xs font-medium text-bolt-elements-textSecondary">
          Text content
          <input
            value={textValue}
            disabled={selectedElement.hasChildElements}
            onChange={(event) => {
              setTextValue(event.target.value);
              onTextChange(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2 py-1.5 text-sm text-bolt-elements-textPrimary outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Element text content"
          />
          {selectedElement.hasChildElements && (
            <span className="mt-1 block text-[10px] text-bolt-elements-textTertiary">
              Text editing is disabled for elements with nested markup.
            </span>
          )}
        </label>

        <div className="space-y-2.5">
          {editableStyles.map(({ property, label, type }) => {
            const value = currentValue(property);

            return (
              <label
                key={property}
                className="flex items-center justify-between gap-3 text-xs text-bolt-elements-textSecondary"
              >
                <span>{label}</span>
                {type === 'select' ? (
                  <select
                    value={value}
                    onChange={(event) => onStyleChange(property, event.target.value)}
                    className="w-32 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2 py-1.5 text-xs text-bolt-elements-textPrimary"
                    aria-label={label}
                  >
                    <option value="">Default</option>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="justify">Justify</option>
                  </select>
                ) : type === 'color' ? (
                  <div className="flex w-32 items-center gap-1.5">
                    <input
                      type="color"
                      value={toColorInputValue(value)}
                      onChange={(event) => onStyleChange(property, event.target.value)}
                      aria-label={label}
                      className="h-7 w-8 cursor-pointer rounded border border-bolt-elements-borderColor bg-transparent p-0.5"
                    />
                    <span className="truncate font-mono text-[10px]" title={value}>
                      {value || '—'}
                    </span>
                  </div>
                ) : (
                  <input
                    value={value}
                    onChange={(event) => onStyleChange(property, event.target.value)}
                    aria-label={label}
                    className="w-32 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2 py-1.5 font-mono text-xs text-bolt-elements-textPrimary outline-none focus:border-blue-500"
                  />
                )}
              </label>
            );
          })}
        </div>

        {selectedElement.visualEdits?.length ? (
          <p className="mt-3 text-[11px] text-amber-500">
            {selectedElement.visualEdits.length} pending {selectedElement.visualEdits.length === 1 ? 'edit' : 'edits'} —
            send a prompt to apply them to project files.
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-bolt-elements-textTertiary">
            Changes are live in this preview. Send a prompt with this selection to keep them in your code.
          </p>
        )}
      </div>

      <footer className="flex gap-2 border-t border-bolt-elements-borderColor p-2.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-1 appearance-none rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2 py-1.5 text-xs font-medium text-bolt-elements-textPrimary transition-colors hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:text-bolt-elements-textSecondary disabled:opacity-100"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!selectedElement.visualEdits?.length}
          className="flex-1 appearance-none rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2 py-1.5 text-xs font-medium text-bolt-elements-textPrimary transition-colors hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:text-bolt-elements-textSecondary disabled:opacity-100"
        >
          Reset preview
        </button>
      </footer>
    </aside>
  );
};
