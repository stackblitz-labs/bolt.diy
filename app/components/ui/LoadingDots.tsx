import { memo, useEffect, useState } from 'react';

interface LoadingDotsProps {
  text: string;
}

export const LoadingDots = memo(({ text }: LoadingDotsProps) => {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prevDotCount) => (prevDotCount + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center items-center h-full">
      <div className="relative">
        <span>{text}</span>
        <span className="absolute left-[calc(100%-12px)]">{'.'.repeat(dotCount)}</span>
        <span className="invisible">...</span>
      </div>
    </div>
  );
});
