import { useState, useEffect } from 'react';

/**
 * Determine the current viewport width in both browser and server contexts.
 * When `window` is not available (e.g. during SSR), a fallback width is used.
 */
const getWidth = (fallback: number): number => (typeof window !== 'undefined' ? window.innerWidth : fallback);

/**
 * Returns `true` if the viewport width is less than the provided threshold.
 * A `fallbackWidth` can be supplied for server environments where `window`
 * is undefined.
 */
const useViewport = (threshold = 1024, fallbackWidth = 1024) => {
  const [isSmallViewport, setIsSmallViewport] = useState(getWidth(fallbackWidth) < threshold);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleResize = (): void => {
      setIsSmallViewport(window.innerWidth < threshold);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [threshold]);

  return isSmallViewport;
};

export default useViewport;
