import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-4',
        secondary:
          'border-transparent bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3',
        destructive: 'border-transparent bg-red-500/10 text-red-500 hover:bg-red-500/20',
        outline: 'border-bolt-elements-borderColor text-bolt-elements-textPrimary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
