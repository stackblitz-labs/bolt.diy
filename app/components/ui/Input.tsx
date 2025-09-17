import { forwardRef } from 'react';
import { classNames } from '~/utils/classNames';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={classNames(
        'flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-bg-depth-1 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-bolt-elements-textSecondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bolt-elements-focus-ring-offset disabled:cursor-not-allowed disabled:opacity-50 hover:border-bolt-elements-borderColorActive transition-colors',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
