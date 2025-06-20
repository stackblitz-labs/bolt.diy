/*
 *!---------------------------------------------------------------------------------------------
 *  Copyright (c) StackBlitz. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------
 */

import {
  type DependencyList,
  type MutableRefObject,
  type RefCallback,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface StickToBottomState {
  scrollTop: number;
  lastScrollTop?: number;
  ignoreScrollToTop?: number;
  targetScrollTop: number;
  calculatedTargetScrollTop: number;
  scrollDifference: number;
  resizeDifference: number;

  animation?: {
    behavior: 'instant' | Required<SpringAnimation>;
    ignoreEscapes: boolean;
    promise: Promise<boolean>;
  };
  lastTick?: number;
  velocity: number;
  accumulated: number;

  escapedFromLock: boolean;
  isAtBottom: boolean;
  isNearBottom: boolean;

  resizeObserver?: ResizeObserver;
}

const DEFAULT_SPRING_ANIMATION = {
  /**
   * A value from 0 to 1, on how much to damp the animation.
   * 0 means no damping, 1 means full damping.
   *
   * @default 0.7
   */
  damping: 0.7,

  /**
   * The stiffness of how fast/slow the animation gets up to speed.
   *
   * @default 0.05
   */
  stiffness: 0.05,

  /**
   * The inertial mass associated with the animation.
   * Higher numbers make the animation slower.
   *
   * @default 1.25
   */
  mass: 1.25,
};

export interface SpringAnimation extends Partial<typeof DEFAULT_SPRING_ANIMATION> {}

export type Animation = ScrollBehavior | SpringAnimation;

export interface ScrollElements {
  scrollElement: HTMLElement;
  contentElement: HTMLElement;
}

export type GetTargetScrollTop = (targetScrollTop: number, context: ScrollElements) => number;

export interface StickToBottomOptions extends SpringAnimation {
  resize?: Animation;
  initial?: Animation | boolean;
  targetScrollTop?: GetTargetScrollTop;
}

export type ScrollToBottomOptions =
  | ScrollBehavior
  | {
      animation?: Animation;

      /**
       * Whether to wait for any existing scrolls to finish before
       * performing this one. Or if a millisecond is passed,
       * it will wait for that duration before performing the scroll.
       *
       * @default false
       */
      wait?: boolean | number;

      /**
       * Whether to prevent the user from escaping the scroll,
       * by scrolling up with their mouse.
       */
      ignoreEscapes?: boolean;

      /**
       * Only scroll to the bottom if we're already at the bottom.
       *
       * @default false
       */
      preserveScrollPosition?: boolean;

      /**
       * The extra duration in ms that this scroll event should persist for.
       * (in addition to the time that it takes to get to the bottom)
       *
       * Not to be confused with the duration of the animation -
       * for that you should adjust the animation option.
       *
       * @default 0
       */
      duration?: number | Promise<void>;
    };

export type ScrollToBottom = (scrollOptions?: ScrollToBottomOptions) => Promise<boolean> | boolean;
export type StopScroll = () => void;

const STICK_TO_BOTTOM_OFFSET_PX = 70;
const SIXTY_FPS_INTERVAL_MS = 1000 / 60;
const RETAIN_ANIMATION_DURATION_MS = 350;

let mouseDown = false;

globalThis.document?.addEventListener('mousedown', () => {
  mouseDown = true;
});

globalThis.document?.addEventListener('mouseup', () => {
  mouseDown = false;
});

globalThis.document?.addEventListener('click', () => {
  mouseDown = false;
});

export const useStickToBottom = (options: StickToBottomOptions = {}) => {
  const [escapedFromLock, updateEscapedFromLock] = useState(false);
  const [isAtBottom, updateIsAtBottom] = useState(options.initial !== false);
  const [isNearBottom, setIsNearBottom] = useState(false);

  const optionsRef = useRef<StickToBottomOptions>(null!);
  optionsRef.current = options;

  const isSelecting = useCallback(() => {
    if (!mouseDown) {
      return false;
    }

    const selection = window.getSelection();

    if (!selection || !selection.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);

    return (
      range.commonAncestorContainer.contains(scrollRef.current) ||
      scrollRef.current?.contains(range.commonAncestorContainer)
    );
  }, []);

  const setIsAtBottom = useCallback((isAtBottom: boolean) => {
    state.isAtBottom = isAtBottom;
    updateIsAtBottom(isAtBottom);
  }, []);

  const setEscapedFromLock = useCallback((escapedFromLock: boolean) => {
    state.escapedFromLock = escapedFromLock;
    updateEscapedFromLock(escapedFromLock);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: not needed
  const state = useMemo<StickToBottomState>(() => {
    let lastCalculation: { targetScrollTop: number; calculatedScrollTop: number } | undefined;

    return {
      escapedFromLock,
      isAtBottom,
      resizeDifference: 0,
      accumulated: 0,
      velocity: 0,
      listeners: new Set(),

      get scrollTop() {
        return scrollRef.current?.scrollTop ?? 0;
      },
      set scrollTop(scrollTop: number) {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollTop;
          state.ignoreScrollToTop = scrollRef.current.scrollTop;
        }
      },

      get targetScrollTop() {
        if (!scrollRef.current || !contentRef.current) {
          return 0;
        }

        return scrollRef.current.scrollHeight - 1 - scrollRef.current.clientHeight;
      },
      get calculatedTargetScrollTop() {
        if (!scrollRef.current || !contentRef.current) {
          return 0;
        }

        const { targetScrollTop } = this;

        if (!options.targetScrollTop) {
          return targetScrollTop;
        }

        if (lastCalculation?.targetScrollTop === targetScrollTop) {
          return lastCalculation.calculatedScrollTop;
        }

        const calculatedScrollTop = Math.max(
          Math.min(
            options.targetScrollTop(targetScrollTop, {
              scrollElement: scrollRef.current,
              contentElement: contentRef.current,
            }),
            targetScrollTop,
          ),
          0,
        );

        lastCalculation = { targetScrollTop, calculatedScrollTop };

        requestAnimationFrame(() => {
          lastCalculation = undefined;
        });

        return calculatedScrollTop;
      },

      get scrollDifference() {
        return this.calculatedTargetScrollTop - this.scrollTop;
      },

      get isNearBottom() {
        return this.scrollDifference <= STICK_TO_BOTTOM_OFFSET_PX;
      },
    };
  }, []);

  const scrollToBottom = useCallback<ScrollToBottom>(
    (scrollOptions = {}) => {
      if (typeof scrollOptions === 'string') {
        scrollOptions = { animation: scrollOptions };
      }

      if (!scrollOptions.preserveScrollPosition) {
        setIsAtBottom(true);
      }

      const waitElapsed = Date.now() + (Number(scrollOptions.wait) || 0);
      const behavior = mergeAnimations(optionsRef.current, scrollOptions.animation);
      const { ignoreEscapes = false } = scrollOptions;

      let durationElapsed: number;
      let startTarget = state.calculatedTargetScrollTop;

      if (scrollOptions.duration instanceof Promise) {
        scrollOptions.duration.finally(() => {
          durationElapsed = Date.now();
        });
      } else {
        durationElapsed = waitElapsed + (scrollOptions.duration ?? 0);
      }

      const next = async (): Promise<boolean> => {
        const promise = new Promise(requestAnimationFrame).then(() => {
          if (!state.isAtBottom) {
            state.animation = undefined;

            return false;
          }

          const { scrollTop } = state;
          const tick = performance.now();
          const tickDelta = (tick - (state.lastTick ?? tick)) / SIXTY_FPS_INTERVAL_MS;
          state.animation ||= { behavior, promise, ignoreEscapes };

          if (state.animation.behavior === behavior) {
            state.lastTick = tick;
          }

          if (isSelecting()) {
            return next();
          }

          if (waitElapsed > Date.now()) {
            return next();
          }

          if (scrollTop < Math.min(startTarget, state.calculatedTargetScrollTop)) {
            if (state.animation?.behavior === behavior) {
              if (behavior === 'instant') {
                state.scrollTop = state.calculatedTargetScrollTop;
                return next();
              }

              state.velocity =
                (behavior.damping * state.velocity + behavior.stiffness * state.scrollDifference) / behavior.mass;
              state.accumulated += state.velocity * tickDelta;
              state.scrollTop += state.accumulated;

              if (state.scrollTop !== scrollTop) {
                state.accumulated = 0;
              }
            }

            return next();
          }

          if (durationElapsed > Date.now()) {
            startTarget = state.calculatedTargetScrollTop;

            return next();
          }

          state.animation = undefined;

          /**
           * If we're still below the target, then queue
           * up another scroll to the bottom with the last
           * requested animatino.
           */
          if (state.scrollTop < state.calculatedTargetScrollTop) {
            return scrollToBottom({
              animation: mergeAnimations(optionsRef.current, optionsRef.current.resize),
              ignoreEscapes,
              duration: Math.max(0, durationElapsed - Date.now()) || undefined,
            });
          }

          return state.isAtBottom;
        });

        return promise.then((isAtBottom) => {
          requestAnimationFrame(() => {
            if (!state.animation) {
              state.lastTick = undefined;
              state.velocity = 0;
            }
          });

          return isAtBottom;
        });
      };

      if (scrollOptions.wait !== true) {
        state.animation = undefined;
      }

      if (state.animation?.behavior === behavior) {
        return state.animation.promise;
      }

      return next();
    },
    [setIsAtBottom, isSelecting, state],
  );

  const stopScroll = useCallback(() => {
    setEscapedFromLock(true);
    setIsAtBottom(false);
  }, [setEscapedFromLock, setIsAtBottom]);

  const handleScroll = useCallback(
    ({ target }: Event) => {
      if (target !== scrollRef.current) {
        return;
      }

      const { scrollTop, ignoreScrollToTop } = state;
      let { lastScrollTop = scrollTop } = state;

      state.lastScrollTop = scrollTop;
      state.ignoreScrollToTop = undefined;

      if (ignoreScrollToTop && ignoreScrollToTop > scrollTop) {
        /**
         * When the user scrolls up while the animation plays, the `scrollTop` may
         * not come in separate events; if this happens, to make sure `isScrollingUp`
         * is correct, set the lastScrollTop to the ignored event.
         */
        lastScrollTop = ignoreScrollToTop;
      }

      setIsNearBottom(state.isNearBottom);

      /**
       * Scroll events may come before a ResizeObserver event,
       * so in order to ignore resize events correctly we use a
       * timeout.
       *
       * @see https://github.com/WICG/resize-observer/issues/25#issuecomment-248757228
       */
      setTimeout(() => {
        /**
         * When theres a resize difference ignore the resize event.
         */
        if (state.resizeDifference || scrollTop === ignoreScrollToTop) {
          return;
        }

        if (isSelecting()) {
          setEscapedFromLock(true);
          setIsAtBottom(false);

          return;
        }

        const isScrollingDown = scrollTop > lastScrollTop;
        const isScrollingUp = scrollTop < lastScrollTop;

        if (state.animation?.ignoreEscapes) {
          state.scrollTop = lastScrollTop;
          return;
        }

        if (isScrollingUp) {
          setEscapedFromLock(true);
          setIsAtBottom(false);
        }

        if (isScrollingDown) {
          setEscapedFromLock(false);
        }

        if (!state.escapedFromLock && state.isNearBottom) {
          setIsAtBottom(true);
        }
      }, 1);
    },
    [setEscapedFromLock, setIsAtBottom, isSelecting, state],
  );

  const handleWheel = useCallback(
    ({ target, deltaY }: WheelEvent) => {
      let element = target as HTMLElement;

      while (!['scroll', 'auto'].includes(getComputedStyle(element).overflow)) {
        if (!element.parentElement) {
          return;
        }

        element = element.parentElement;
      }

      /**
       * The browser may cancel the scrolling from the mouse wheel
       * if we update it from the animation in meantime.
       * To prevent this, always escape when the wheel is scrolled up.
       */
      if (
        element === scrollRef.current &&
        deltaY < 0 &&
        scrollRef.current.scrollHeight > scrollRef.current.clientHeight &&
        !state.animation?.ignoreEscapes
      ) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
      }
    },
    [setEscapedFromLock, setIsAtBottom, state],
  );

  const scrollRef = useRefCallback((scroll) => {
    scrollRef.current?.removeEventListener('scroll', handleScroll);
    scrollRef.current?.removeEventListener('wheel', handleWheel);
    scroll?.addEventListener('scroll', handleScroll, { passive: true });
    scroll?.addEventListener('wheel', handleWheel, { passive: true });
  }, []);

  const contentRef = useRefCallback((content) => {
    state.resizeObserver?.disconnect();

    if (!content) {
      return;
    }

    let previousHeight: number | undefined;

    state.resizeObserver = new ResizeObserver(([entry]) => {
      const { height } = entry.contentRect;
      const difference = height - (previousHeight ?? height);

      state.resizeDifference = difference;

      /**
       * Sometimes the browser can overscroll past the target,
       * so check for this and adjust appropriately.
       */
      if (state.scrollTop > state.targetScrollTop) {
        state.scrollTop = state.targetScrollTop;
      }

      setIsNearBottom(state.isNearBottom);

      if (difference >= 0) {
        /**
         * If it's a positive resize, scroll to the bottom when
         * we're already at the bottom.
         */
        const animation = mergeAnimations(
          optionsRef.current,
          previousHeight ? optionsRef.current.resize : optionsRef.current.initial,
        );

        scrollToBottom({
          animation,
          wait: true,
          preserveScrollPosition: true,
          duration: animation === 'instant' ? undefined : RETAIN_ANIMATION_DURATION_MS,
        });
      } else {
        /**
         * Else if it's a negative resize, check if we're near the bottom
         * if we are want to un-escape from the lock, because the resize
         * could have caused the container to be at the bottom.
         */
        if (state.isNearBottom) {
          setEscapedFromLock(false);
          setIsAtBottom(true);
        }
      }

      previousHeight = height;

      /**
       * Reset the resize difference after the scroll event
       * has fired. Requires a rAF to wait for the scroll event,
       * and a setTimeout to wait for the other timeout we have in
       * resizeObserver in case the scroll event happens after the
       * resize event.
       */
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (state.resizeDifference === difference) {
            state.resizeDifference = 0;
          }
        }, 1);
      });
    });

    state.resizeObserver?.observe(content);
  }, []);

  return {
    contentRef,
    scrollRef,
    scrollToBottom,
    stopScroll,
    isAtBottom: isAtBottom || isNearBottom,
    isNearBottom,
    escapedFromLock,
    state,
  };
};

function useRefCallback<T extends (ref: HTMLElement | null) => any>(callback: T, deps: DependencyList) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: not needed
  const result = useCallback((ref: HTMLElement | null) => {
    result.current = ref;
    return callback(ref);
  }, deps) as any as MutableRefObject<HTMLElement | null> & RefCallback<HTMLElement>;

  return result;
}

const animationCache = new Map<string, Readonly<Required<SpringAnimation>>>();

function mergeAnimations(...animations: (Animation | boolean | undefined)[]) {
  const result = { ...DEFAULT_SPRING_ANIMATION };
  let instant = false;

  for (const animation of animations) {
    if (animation === 'instant') {
      instant = true;
      continue;
    }

    if (typeof animation !== 'object') {
      continue;
    }

    instant = false;

    result.damping = animation.damping ?? result.damping;
    result.stiffness = animation.stiffness ?? result.stiffness;
    result.mass = animation.mass ?? result.mass;
  }

  const key = JSON.stringify(result);

  if (!animationCache.has(key)) {
    animationCache.set(key, Object.freeze(result));
  }

  return instant ? 'instant' : animationCache.get(key)!;
}
