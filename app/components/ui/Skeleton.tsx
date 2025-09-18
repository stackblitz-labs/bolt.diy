import { classNames } from '~/utils/classNames';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={classNames('bg-bolt-elements-textSecondary animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
