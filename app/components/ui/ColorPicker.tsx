import React, { useState, useEffect } from 'react';
import { hslToHex, hexToHsl } from '~/lib/theme/iframeUtils';

interface ColorPickerProps {
  label: string;
  lightValue: string;
  darkValue?: string;
  onLightChange: (value: string) => void;
  onDarkChange: (value: string) => void;
  onHover?: (value: string) => void;
  onHoverEnd?: () => void;
  onLightFocus?: () => void;
  onDarkFocus?: () => void;
  onLightBlur?: () => void;
  onDarkBlur?: () => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  lightValue,
  darkValue,
  onLightChange,
  onDarkChange,
  onHover,
  onHoverEnd,
  onLightFocus,
  onDarkFocus,
  onLightBlur,
  onDarkBlur,
}) => {
  const [lightHslValue, setLightHslValue] = useState(lightValue);
  const [darkHslValue, setDarkHslValue] = useState(darkValue || lightValue);

  useEffect(() => {
    setLightHslValue(lightValue);
  }, [lightValue]);

  useEffect(() => {
    setDarkHslValue(darkValue || lightValue);
  }, [darkValue, lightValue]);

  const handleLightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLightHslValue(newValue);
    onLightChange(newValue);
  };

  const handleDarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDarkHslValue(newValue);
    onDarkChange(newValue);
  };

  const handleLightColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const newHsl = hexToHsl(hex);
    setLightHslValue(newHsl);
    onLightChange(newHsl);
  };

  const handleDarkColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const newHsl = hexToHsl(hex);
    setDarkHslValue(newHsl);
    onDarkChange(newHsl);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-bolt-elements-textSecondary">{label}</label>
      <div className="grid grid-cols-1 @[500px]:grid-cols-2 gap-2">
        {/* Light Mode */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div
              className="w-full h-full rounded border border-bolt-elements-borderColor cursor-pointer"
              style={{ backgroundColor: `hsl(${lightHslValue})` }}
            />
            <input
              type="color"
              value={hslToHex(lightHslValue)}
              onChange={handleLightColorPickerChange}
              onFocus={onLightFocus}
              onBlur={onLightBlur}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Click to pick light mode color"
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <span className="text-xs text-bolt-elements-textSecondary mb-1">Light</span>
            <input
              type="text"
              value={lightHslValue}
              onChange={handleLightChange}
              onMouseEnter={() => onHover?.(lightHslValue)}
              onMouseLeave={onHoverEnd}
              onFocus={() => {
                onHover?.(lightHslValue);
                onLightFocus?.();
              }}
              onBlur={() => {
                onHoverEnd?.();
                onLightBlur?.();
              }}
              className="px-2 py-1.5 text-xs bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary w-full"
              placeholder="0 0% 0%"
            />
          </div>
        </div>
        {/* Dark Mode */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div
              className="w-full h-full rounded border border-bolt-elements-borderColor cursor-pointer"
              style={{ backgroundColor: `hsl(${darkHslValue})` }}
            />
            <input
              type="color"
              value={hslToHex(darkHslValue)}
              onChange={handleDarkColorPickerChange}
              onFocus={onDarkFocus}
              onBlur={onDarkBlur}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Click to pick dark mode color"
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <span className="text-xs text-bolt-elements-textSecondary mb-1">Dark</span>
            <input
              type="text"
              value={darkHslValue}
              onChange={handleDarkChange}
              onMouseEnter={() => onHover?.(darkHslValue)}
              onMouseLeave={onHoverEnd}
              onFocus={() => {
                onHover?.(darkHslValue);
                onDarkFocus?.();
              }}
              onBlur={() => {
                onHoverEnd?.();
                onDarkBlur?.();
              }}
              className="px-2 py-1.5 text-xs bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary w-full"
              placeholder="0 0% 0%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
