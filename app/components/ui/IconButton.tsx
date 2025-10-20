import { memo, forwardRef, type ForwardedRef, createElement } from 'react';
import { classNames } from '~/utils/classNames';
import type { LucideIcon } from 'lucide-react';

type IconSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface BaseIconButtonProps {
  size?: IconSize;
  className?: string;
  iconClassName?: string;
  disabledClassName?: string;
  title?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  style?: React.CSSProperties;
}

type IconButtonWithoutChildrenProps = {
  icon: string | JSX.Element | LucideIcon;
  children?: undefined;
  testId?: string;
} & BaseIconButtonProps;

type IconButtonWithChildrenProps = {
  icon?: undefined;
  children: string | JSX.Element | JSX.Element[];
  testId?: string;
} & BaseIconButtonProps;

type IconButtonProps = IconButtonWithoutChildrenProps | IconButtonWithChildrenProps;

// Componente IconButton com suporte a refs
export const IconButton = memo(
  forwardRef(
    (
      {
        icon,
        size = 'xl',
        className,
        iconClassName,
        disabledClassName,
        disabled = false,
        testId,
        title,
        onClick,
        children,
        style,
      }: IconButtonProps,
      ref: ForwardedRef<HTMLButtonElement>,
    ) => {
      return (
        <button
          ref={ref}
          className={classNames(
            'flex items-center justify-center text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 enabled:hover:text-bolt-elements-textPrimary rounded-xl p-2 enabled:hover:bg-bolt-elements-background-depth-3 disabled:cursor-not-allowed transition-all duration-200 shadow-sm enabled:hover:shadow-md enabled:hover:scale-105 border border-bolt-elements-borderColor group',
            {
              [classNames('opacity-50', disabledClassName)]: disabled,
            },
            className,
          )}
          title={title}
          disabled={disabled}
          data-testid={testId || 'icon-button'}
          onClick={(event) => {
            if (disabled) {
              return;
            }

            onClick?.(event);
          }}
          style={style}
        >
          {children ? (
            children
          ) : typeof icon === 'string' ? (
            <div
              className={classNames(
                icon,
                getIconSize(size),
                'transition-transform duration-200 group-hover:scale-110',
                iconClassName,
              )}
            ></div>
          ) : typeof icon === 'function' ? (
            // Lucide icon as a component
            createElement(icon, {
              className: classNames('transition-transform duration-200 group-hover:scale-110', iconClassName),
              size: getIconSizeNumber(size),
            })
          ) : (
            // JSX element
            icon
          )}
        </button>
      );
    },
  ),
);

function getIconSize(size: IconSize) {
  if (size === 'sm') {
    return 'text-sm';
  } else if (size === 'md') {
    return 'text-base';
  } else if (size === 'lg') {
    return 'text-lg';
  } else if (size === 'xl') {
    return 'text-xl';
  } else {
    return 'text-2xl';
  }
}

function getIconSizeNumber(size: IconSize): number {
  if (size === 'sm') {
    return 14;
  } else if (size === 'md') {
    return 16;
  } else if (size === 'lg') {
    return 18;
  } else if (size === 'xl') {
    return 20;
  } else {
    return 24;
  }
}
