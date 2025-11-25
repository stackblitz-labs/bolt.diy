import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
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
  icon,
  presets,
  currentValue,
  onChange,
  columns = 3,
  renderPreview,
  renderSubLabel,
  defaultOpen = true,
}) => {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{title}</h3>
          </div>
          <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className={classNames('grid gap-2 mt-3', columns === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              className={classNames(
                'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
                currentValue === preset.value
                  ? 'border-green-500 bg-bolt-elements-background-depth-2 ring-2 ring-green-500/20'
                  : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2',
              )}
            >
              {renderPreview ? (
                renderPreview(preset)
              ) : (
                <div className="w-10 h-10 mb-2 flex items-center justify-center">
                  <div
                    className="w-8 h-8 border-2 border-bolt-elements-textPrimary"
                    style={{ borderRadius: preset.previewRadius || '0' }}
                  />
                </div>
              )}
              <span className="text-xs font-medium text-bolt-elements-textPrimary">{preset.label}</span>
              {renderSubLabel && renderSubLabel(preset)}
            </button>
          ))}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Specialized preset selectors with built-in preview renderers

interface RadiusSelectorProps {
  title?: string;
  icon?: React.ReactNode;
  currentValue: number;
  onChange: (value: number) => void;
  defaultOpen?: boolean;
}

export const RadiusSelector: React.FC<RadiusSelectorProps> = ({
  title = 'Border Radius',
  icon,
  currentValue,
  onChange,
  defaultOpen = true,
}) => {
  const presets: PresetOption[] = [
    { value: 0, label: 'None', previewRadius: '0' },
    { value: 0.375, label: 'SM', previewRadius: '4px' },
    { value: 0.5, label: 'MD', previewRadius: '8px' },
    { value: 0.75, label: 'LG', previewRadius: '10px' },
    { value: 1, label: 'XL', previewRadius: '12px' },
    { value: 9999, label: 'Full', previewRadius: '100%' },
  ];

  return (
    <PresetSelector
      title={title}
      icon={icon}
      presets={presets}
      currentValue={currentValue}
      onChange={onChange}
      columns={3}
      defaultOpen={defaultOpen}
    />
  );
};

interface SpacingSelectorProps {
  title?: string;
  icon?: React.ReactNode;
  currentValue: number;
  onChange: (value: number) => void;
  defaultOpen?: boolean;
}

export const SpacingSelector: React.FC<SpacingSelectorProps> = ({
  title = 'Spacing Unit',
  icon,
  currentValue,
  onChange,
  defaultOpen = true,
}) => {
  const presets: PresetOption[] = [
    { value: 4, label: 'Small' },
    { value: 5, label: 'Medium' },
    { value: 6, label: 'Large' },
  ];

  return (
    <PresetSelector
      title={title}
      icon={icon}
      presets={presets}
      currentValue={currentValue}
      onChange={onChange}
      columns={3}
      defaultOpen={defaultOpen}
      renderPreview={(preset) => (
        <div className="w-10 h-10 mb-2 flex items-center justify-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-bolt-elements-textPrimary rounded-sm"
              style={{
                width: `${Math.max(2, preset.value * 0.75)}px`,
                height: `${preset.value * 3}px`,
              }}
            />
          ))}
        </div>
      )}
      renderSubLabel={(preset) => <span className="text-xs text-bolt-elements-textSecondary">{preset.value}px</span>}
    />
  );
};

interface BorderWidthSelectorProps {
  title?: string;
  icon?: React.ReactNode;
  currentValue: number;
  onChange: (value: number) => void;
  defaultOpen?: boolean;
}

export const BorderWidthSelector: React.FC<BorderWidthSelectorProps> = ({
  title = 'Border Width',
  icon,
  currentValue,
  onChange,
  defaultOpen = true,
}) => {
  const presets: PresetOption[] = [
    { value: 0.5, label: 'Thin' },
    { value: 1, label: 'Medium' },
    { value: 2, label: 'Thick' },
    { value: 4, label: 'Extra' },
  ];

  return (
    <PresetSelector
      title={title}
      icon={icon}
      presets={presets}
      currentValue={currentValue}
      onChange={onChange}
      columns={4}
      defaultOpen={defaultOpen}
      renderPreview={(preset) => (
        <div className="w-10 h-10 mb-2 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded border-bolt-elements-textPrimary"
            style={{ borderWidth: `${preset.value}px`, borderStyle: 'solid' }}
          />
        </div>
      )}
    />
  );
};
