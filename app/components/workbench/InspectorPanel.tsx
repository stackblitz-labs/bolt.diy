import { useState } from 'react';

interface ElementInfo {
  tagName: string;
  className: string;
  id: string;
  textContent: string;
  styles: Record<string, string>; // Changed from CSSStyleDeclaration
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

interface InspectorPanelProps {
  selectedElement: ElementInfo | null;
  isVisible: boolean;
  onClose: () => void;
}

export const InspectorPanel = ({ selectedElement, isVisible, onClose }: InspectorPanelProps) => {
  const [activeTab, setActiveTab] = useState<'styles' | 'computed' | 'box'>('styles');

  if (!isVisible || !selectedElement) {
    return null;
  }

  const getRelevantStyles = (styles: Record<string, string>) => {
    const relevantProps = [
      'display',
      'position',
      'width',
      'height',
      'margin',
      'padding',
      'border',
      'background',
      'color',
      'font-size',
      'font-family',
      'text-align',
      'flex-direction',
      'justify-content',
      'align-items',
    ];

    return relevantProps.reduce(
      (acc, prop) => {
        const value = styles[prop];

        if (value) {
          acc[prop] = value;
        }

        return acc;
      },
      {} as Record<string, string>,
    );
  };

  return (
    <div className="fixed right-4 top-20 w-80 bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor rounded-lg shadow-lg z-40 max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-bolt-elements-borderColor">
        <h3 className="font-medium text-bolt-elements-textPrimary">Element Inspector</h3>
        <button onClick={onClose} className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
          ✕
        </button>
      </div>

      {/* Element Info */}
      <div className="p-3 border-b border-bolt-elements-borderColor">
        <div className="text-sm">
          <div className="font-mono text-blue-500">
            {selectedElement.tagName.toLowerCase()}
            {selectedElement.id && <span className="text-green-500">#{selectedElement.id}</span>}
            {selectedElement.className && (
              <span className="text-yellow-500">.{selectedElement.className.split(' ')[0]}</span>
            )}
          </div>
          {selectedElement.textContent && (
            <div className="mt-1 text-bolt-elements-textSecondary text-xs truncate">
              "{selectedElement.textContent}"
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-bolt-elements-borderColor">
        {(['styles', 'computed', 'box'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 overflow-y-auto max-h-96">
        {activeTab === 'styles' && (
          <div className="space-y-2">
            {Object.entries(getRelevantStyles(selectedElement.styles)).map(([prop, value]) => (
              <div key={prop} className="flex justify-between text-sm">
                <span className="text-bolt-elements-textSecondary">{prop}:</span>
                <span className="text-bolt-elements-textPrimary font-mono">{value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'box' && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Width:</span>
              <span className="text-bolt-elements-textPrimary">{Math.round(selectedElement.rect.width)}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Height:</span>
              <span className="text-bolt-elements-textPrimary">{Math.round(selectedElement.rect.height)}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Top:</span>
              <span className="text-bolt-elements-textPrimary">{Math.round(selectedElement.rect.top)}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Left:</span>
              <span className="text-bolt-elements-textPrimary">{Math.round(selectedElement.rect.left)}px</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
