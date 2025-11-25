import * as React from 'react';
import { MultiSelect } from '~/components/ui/multiselect';
import type { MultiSelectOption, MultiSelectProps } from '~/components/ui/multiselect';

export interface FontPickerProps extends Omit<MultiSelectProps, 'options' | 'onValueChange' | 'defaultValue'> {
  value: string[];
  onChange: (value: string[]) => void;
  fontOptions: MultiSelectOption[];
  /** Called when hovering over a font option - receives the font name */
  onFontHover?: (fontName: string) => void;
  /** Called when mouse leaves the font options */
  onFontHoverEnd?: () => void;
}

export const FontPicker = React.forwardRef<React.ElementRef<typeof MultiSelect>, FontPickerProps>(
  ({ value, onChange, fontOptions, onFontHover, onFontHoverEnd, ...props }, ref) => {
    return (
      <MultiSelect
        ref={ref}
        options={fontOptions}
        onValueChange={onChange}
        defaultValue={value}
        onOptionHover={onFontHover ? (option) => onFontHover(option.value) : undefined}
        onOptionHoverEnd={onFontHoverEnd}
        {...props}
      />
    );
  },
);

FontPicker.displayName = 'FontPicker';

// Re-export types for convenience
export type { MultiSelectOption, MultiSelectProps };
