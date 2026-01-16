import { memo, forwardRef, type ForwardedRef } from 'react';
import { classNames } from '~/utils/classNames';
import { Tooltip } from './Tooltip';

type IconSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface BaseIconButtonProps {
  size?: IconSize;
  className?: string;
  iconClassName?: string;
  disabledClassName?: string;
  title?: string;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  'aria-label'?: string;
}

type IconButtonWithoutChildrenProps = {
  icon: string;
  children?: undefined;
} & BaseIconButtonProps;

type IconButtonWithChildrenProps = {
  icon?: undefined;
  children: string | JSX.Element | JSX.Element[];
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
        isLoading = false,
        title,
        onClick,
        children,
        'aria-label': ariaLabel,
      }: IconButtonProps,
      ref: ForwardedRef<HTMLButtonElement>,
    ) => {
      const buttonElement = (
        <button
          ref={ref}
          className={classNames(
            'flex items-center justify-center text-bolt-elements-item-contentDefault bg-transparent enabled:hover:text-bolt-elements-item-contentActive rounded-md p-1 enabled:hover:bg-bolt-elements-item-backgroundActive disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focusRing',
            {
              [classNames('opacity-30', disabledClassName)]: disabled,
            },
            className,
          )}
          disabled={disabled || isLoading}
          aria-label={ariaLabel || title}
          onClick={(event) => {
            if (disabled || isLoading) {
              return;
            }

            onClick?.(event);
          }}
        >
          {isLoading ? (
            <div className="i-svg-spinners:90-ring-with-bg text-xl" />
          ) : children ? (
            children
          ) : (
            <div className={classNames(icon, getIconSize(size), iconClassName)}></div>
          )}
        </button>
      );

      if (title) {
        return <Tooltip content={title}>{buttonElement}</Tooltip>;
      }

      return buttonElement;
    },
  ),
);

function getIconSize(size: IconSize) {
  if (size === 'sm') {
    return 'text-sm';
  } else if (size === 'md') {
    return 'text-md';
  } else if (size === 'lg') {
    return 'text-lg';
  } else if (size === 'xl') {
    return 'text-xl';
  } else {
    return 'text-2xl';
  }
}
