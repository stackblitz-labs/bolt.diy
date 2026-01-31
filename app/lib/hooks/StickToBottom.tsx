/*
 *!---------------------------------------------------------------------------------------------
 *  Copyright (c) StackBlitz. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------
 */

import * as React from 'react';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  type GetTargetScrollTop,
  type ScrollToBottom,
  type StickToBottomOptions,
  type StickToBottomState,
  type StopScroll,
  useStickToBottom,
} from './useStickToBottom';

export interface StickToBottomContext {
  contentRef: React.MutableRefObject<HTMLElement | null> & React.RefCallback<HTMLElement>;
  scrollRef: React.MutableRefObject<HTMLElement | null> & React.RefCallback<HTMLElement>;
  scrollToBottom: ScrollToBottom;
  stopScroll: StopScroll;
  isAtBottom: boolean;
  escapedFromLock: boolean;
  get targetScrollTop(): GetTargetScrollTop | null;
  set targetScrollTop(targetScrollTop: GetTargetScrollTop | null);
  state: StickToBottomState;
}

const StickToBottomContext = createContext<StickToBottomContext | null>(null);

export interface StickToBottomProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    StickToBottomOptions {
  contextRef?: React.Ref<StickToBottomContext>;
  instance?: ReturnType<typeof useStickToBottom>;
  children: ((context: StickToBottomContext) => ReactNode) | ReactNode;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function StickToBottom({
  instance,
  children,
  resize,
  initial,
  mass,
  damping,
  stiffness,
  targetScrollTop: currentTargetScrollTop,
  contextRef,
  ...props
}: StickToBottomProps) {
  const customTargetScrollTop = useRef<GetTargetScrollTop | null>(null);

  const targetScrollTop = React.useCallback<GetTargetScrollTop>(
    (target, elements) => {
      const get = context?.targetScrollTop ?? currentTargetScrollTop;
      return get?.(target, elements) ?? target;
    },
    [currentTargetScrollTop],
  );

  const defaultInstance = useStickToBottom({
    mass,
    damping,
    stiffness,
    resize,
    initial,
    targetScrollTop,
  });

  const { scrollRef, contentRef, scrollToBottom, stopScroll, isAtBottom, escapedFromLock, state } =
    instance ?? defaultInstance;

  const context = useMemo<StickToBottomContext>(
    () => ({
      scrollToBottom,
      stopScroll,
      scrollRef,
      isAtBottom,
      escapedFromLock,
      contentRef,
      state,
      get targetScrollTop() {
        return customTargetScrollTop.current;
      },
      set targetScrollTop(targetScrollTop: GetTargetScrollTop | null) {
        customTargetScrollTop.current = targetScrollTop;
      },
    }),
    [scrollToBottom, isAtBottom, contentRef, scrollRef, stopScroll, escapedFromLock, state],
  );

  useImperativeHandle(contextRef, () => context, [context]);

  useIsomorphicLayoutEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    if (getComputedStyle(scrollRef.current).overflow === 'visible') {
      scrollRef.current.style.overflow = 'auto';
    }
  }, []);

  return (
    <StickToBottomContext.Provider value={context}>
      <div {...props}>{typeof children === 'function' ? children(context) : children}</div>
    </StickToBottomContext.Provider>
  );
}

export interface StickToBottomContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ((context: StickToBottomContext) => ReactNode) | ReactNode;
}

function Content({ children, ...props }: StickToBottomContentProps) {
  const context = useStickToBottomContext();

  return (
    <div ref={context.scrollRef} className="w-full h-auto">
      <div {...props} ref={context.contentRef}>
        {typeof children === 'function' ? children(context) : children}
      </div>
      {/* Blur effect overlay */}
    </div>
  );
}

StickToBottom.Content = Content;

/**
 * Use this hook inside a <StickToBottom> component to gain access to whether the component is at the bottom of the scrollable area.
 */
export function useStickToBottomContext() {
  const context = useContext(StickToBottomContext);

  if (!context) {
    throw new Error('use-stick-to-bottom component context must be used within a StickToBottom component');
  }

  return context;
}
