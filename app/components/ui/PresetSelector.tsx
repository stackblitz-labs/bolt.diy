import React from 'react';
import { classNames } from '~/utils/classNames';

interface PresetOption {
  value: number;
  label: string;
  previewRadius?: string;
}

interface PresetSelectorProps {
  title: string;
  icon?: React.ReactNode;
  presets: PresetOption[];
  currentValue: number;
  onChange: (value: number) => void;
  columns?: 3 | 4;
  renderPreview?: (preset: PresetOption) => React.ReactNode;
  renderSubLabel?: (preset: PresetOption) => React.ReactNode;
  defaultOpen?: boolean;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  title,
  presets,
  currentValue,
  onChange,
  columns = 3,
  renderPreview,
}) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-bolt-elements-textPrimary">{title}</h3>
      <div className={classNames('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={classNames(
              'flex flex-col items-center justify-center p-3 rounded-md border transition-all',
              currentValue === preset.value
                ? 'border-bolt-elements-textPrimary bg-background'
                : 'border-bolt-elements-borderColor bg-background hover:border-bolt-elements-borderColorActive',
            )}
          >
            {renderPreview ? (
              renderPreview(preset)
            ) : (
              <div className="w-12 h-12 mb-2 flex items-center justify-center">
                <div
                  className="w-10 h-10 border border-bolt-elements-textPrimary"
                  style={{ borderRadius: preset.previewRadius || '0' }}
                />
              </div>
            )}
            <span className="text-xs font-medium text-bolt-elements-textPrimary">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Specialized preset selectors with built-in preview renderers

interface RadiusSelectorProps {
  title?: string;
  currentValue: number;
  onChange: (value: number) => void;
}

export const RadiusSelector: React.FC<RadiusSelectorProps> = ({ title = 'Roundness', currentValue, onChange }) => {
  const presets: PresetOption[] = [
    { value: 0, label: 'None', previewRadius: '0' },
    { value: 0.375, label: 'Small', previewRadius: '4px' },
    { value: 0.5, label: 'Medium', previewRadius: '8px' },
    { value: 0.75, label: 'Large', previewRadius: '12px' },
    { value: 1, label: 'Bubble', previewRadius: '16px' },
    { value: 9999, label: 'Round', previewRadius: '50%' },
  ];

  return (
    <PresetSelector
      title={title}
      presets={presets}
      currentValue={currentValue}
      onChange={onChange}
      columns={3}
      renderPreview={(preset) => (
        <div className="w-12 h-12 mb-2 flex items-center justify-center">
          <div
            className="w-10 h-10 border border-bolt-elements-textPrimary"
            style={{ borderRadius: preset.previewRadius || '0' }}
          />
        </div>
      )}
    />
  );
};

interface SpacingSelectorProps {
  title?: string;
  currentValue: number;
  onChange: (value: number) => void;
}

export const SpacingSelector: React.FC<SpacingSelectorProps> = ({ title = 'Space', currentValue, onChange }) => {
  const presets: PresetOption[] = [
    { value: 4, label: 'Small' },
    { value: 5, label: 'Medium' },
    { value: 6, label: 'Large' },
  ];

  return (
    <PresetSelector
      title={title}
      presets={presets}
      currentValue={currentValue}
      onChange={onChange}
      columns={3}
      renderPreview={(preset) => (
        <div className="w-12 h-12 mb-2 flex items-center justify-center">
          {/* Spacing visual: horizontal lines with gaps */}
          <div className="flex items-center justify-center gap-0.5">
            <div className="w-0.5 h-6 border-l border-dashed border-bolt-elements-textSecondary" />
            <div className="flex items-center justify-center" style={{ width: `${preset.value * 3}px` }}>
              <div className="w-full border-t border-dashed border-bolt-elements-textSecondary" />
            </div>
            <div className="w-0.5 h-6 border-r border-dashed border-bolt-elements-textSecondary" />
          </div>
        </div>
      )}
    />
  );
};

interface BorderWidthSelectorProps {
  title?: string;
  currentValue: number;
  onChange: (value: number) => void;
}

export const BorderWidthSelector: React.FC<BorderWidthSelectorProps> = ({
  title = 'Stroke',
  currentValue,
  onChange,
}) => {
  const presets: PresetOption[] = [
    { value: 0.5, label: 'Thin' },
    { value: 1, label: 'Medium' },
    { value: 2, label: 'Thick' },
  ];

  return (
    <PresetSelector
      title={title}
      presets={presets}
      currentValue={currentValue}
      onChange={onChange}
      columns={3}
      renderPreview={(preset) => (
        <div className="w-12 h-12 mb-2 flex items-center justify-center">
          <div
            className="w-8 h-10 rounded-sm border-bolt-elements-textPrimary"
            style={{ borderWidth: `${preset.value}px`, borderStyle: 'solid' }}
          />
        </div>
      )}
    />
  );
};
