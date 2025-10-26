import { motion } from 'framer-motion';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { genericMemo } from '~/utils/react';

export type SliderOptions<T> = {
  left: { value: T; text: string };
  middle?: { value: T; text: string };
  right: { value: T; text: string };
};

interface SliderProps<T> {
  selected: T;
  options: SliderOptions<T>;
  setSelected?: (selected: T) => void;
}

export const Slider = genericMemo(<T,>({ selected, options, setSelected }: SliderProps<T>) => {
  const hasMiddle = !!options.middle;
  const isLeftSelected = hasMiddle ? selected === options.left.value : selected === options.left.value;
  const isMiddleSelected = hasMiddle && options.middle ? selected === options.middle.value : false;

  return (
    <div className="flex items-center flex-wrap shrink-0 gap-1 bg-bolt-elements-background-depth-1 overflow-hidden rounded-full p-1">
      <SliderButton selected={isLeftSelected} setSelected={() => setSelected?.(options.left.value)}>
        {options.left.text}
      </SliderButton>

      {options.middle && (
        <SliderButton selected={isMiddleSelected} setSelected={() => setSelected?.(options.middle!.value)}>
          {options.middle.text}
        </SliderButton>
      )}

      <SliderButton
        selected={!isLeftSelected && !isMiddleSelected}
        setSelected={() => setSelected?.(options.right.value)}
      >
        {options.right.text}
      </SliderButton>
    </div>
  );
});

interface SliderButtonProps {
  selected: boolean;
  children: string | JSX.Element | Array<JSX.Element | string>;
  setSelected: () => void;
}

const SliderButton = memo(({ selected, children, setSelected }: SliderButtonProps) => {
  return (
    <button
      onClick={setSelected}
      className={classNames(
        'bg-transparent text-sm px-2.5 py-0.5 rounded-full relative',
        selected
          ? 'text-bolt-elements-item-contentAccent'
          : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
      )}
    >
      <span className="relative z-10">{children}</span>
      {selected && (
        <motion.span
          layoutId="pill-tab"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-bolt-elements-item-backgroundAccent rounded-full"
        ></motion.span>
      )}
    </button>
  );
});
