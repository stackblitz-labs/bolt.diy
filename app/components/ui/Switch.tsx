import { memo } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { classNames } from '~/utils/classNames';

interface SwitchProps {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (event: boolean) => void;
}

export const Switch = memo(({ className, onCheckedChange, checked }: SwitchProps) => {
  return (
    <SwitchPrimitive.Root
      className={classNames(
        'relative h-7 w-12 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Unchecked state - neutral with stronger border
        'bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor border-opacity-60 hover:border-bolt-elements-borderColor',
        // Checked state - vibrant gradient with stronger colors
        'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-indigo-600',
        'data-[state=checked]:border-blue-500/80 data-[state=checked]:hover:border-blue-600',
        'data-[state=checked]:ring-2 data-[state=checked]:ring-blue-500/20',
        className,
      )}
      checked={checked}
      onCheckedChange={(e) => onCheckedChange?.(e)}
    >
      <SwitchPrimitive.Thumb
        className={classNames(
          'block h-5 w-5 rounded-full bg-white border transition-all duration-300 ease-in-out',
          'shadow-lg shadow-black/30 hover:shadow-xl',
          'translate-x-0.5 border-bolt-elements-borderColor border-opacity-30',
          'data-[state=checked]:translate-x-[1.375rem] data-[state=checked]:border-white/60',
          'data-[state=checked]:shadow-lg data-[state=checked]:shadow-white/30',
          'will-change-transform scale-100 hover:scale-105',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
