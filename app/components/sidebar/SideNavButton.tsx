import * as React from 'react';
import { cn } from '~/lib/utils';

interface SideNavButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  isSelected?: boolean;
}

/**
 * SideNavButton - Navigation button for the sidebar
 *
 * States:
 * - Unselected + Idle: transparent background, subtle shadow
 * - Unselected + Hover: light gray background (#F3F4F6)
 * - Unselected + Focus: transparent background, 3px focus ring
 * - Unselected + Disabled: transparent, muted opacity
 * - Selected + Idle: white background, 1px border, shadow
 * - Selected + Hover: gradient overlay on background
 * - Selected + Focus: white background, focus ring
 */
export const SideNavButton = React.forwardRef<HTMLButtonElement, SideNavButtonProps>(
  ({ icon, label, isSelected = false, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // Base styles - 56x56, flex column, centered
          'group relative flex flex-col items-center justify-center',
          'w-14 h-14 gap-2 rounded-lg',
          'text-sm font-medium transition-all duration-200',

          // Typography
          'text-foreground',

          // Default shadow (xs shadow from Figma)
          'shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]',

          // Focus styles - 3px ring
          'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',

          // Disabled state
          'disabled:pointer-events-none disabled:opacity-50',

          // Unselected state
          !isSelected && ['bg-transparent', 'hover:bg-muted/50', 'active:bg-muted/70'],

          // Selected state
          isSelected && [
            'bg-background',
            'border border-input',
            'shadow-sm',
            'hover:bg-gradient-to-t hover:from-primary/5 hover:to-transparent',
          ],

          className,
        )}
        {...props}
      >
        {/* Icon container */}
        <span
          className={cn(
            'flex items-center justify-center w-5 h-5',
            'transition-colors duration-200',
            !isSelected && 'text-muted-foreground group-hover:text-foreground',
            isSelected && 'text-foreground',
          )}
        >
          {icon}
        </span>

        {/* Label */}
        <span
          className={cn(
            'text-[11px] leading-none font-medium',
            'transition-colors duration-200',
            !isSelected && 'text-muted-foreground group-hover:text-foreground',
            isSelected && 'text-foreground',
          )}
        >
          {label}
        </span>
      </button>
    );
  },
);

SideNavButton.displayName = 'SideNavButton';
