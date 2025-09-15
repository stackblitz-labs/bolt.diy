import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServerIcon, PuzzleIcon, ToolsIcon, ClockIcon } from './components';

const messages = [
  'Spinning up the server',
  'Connecting the puzzle pieces',
  'Tightening a few nuts (and bolts)',
  'Getting closer',
];

const loadingStates = [
  { component: ServerIcon, duration: 3000 },
  { component: PuzzleIcon, duration: 3000 },
  { component: ToolsIcon, duration: 3500 },
  { component: ClockIcon, duration: 4000 },
];

const PreviewLoad = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % loadingStates.length);
    }, loadingStates[currentIndex].duration);

    return () => clearInterval(timer);
  }, [currentIndex]);

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, loadingStates[messageIndex]?.duration || 3000);

    return () => clearInterval(messageTimer);
  }, [messageIndex]);

  const CurrentComponent = loadingStates[currentIndex].component;
  const currentMessage = messages[messageIndex];

  return (
    <div className="w-full h-full relative bg-bolt-elements-background-depth-1">
      {/* Animated rainbow gradient border */}
      <div className="absolute inset-0 p-[3px] animate-focus-border opacity-60 rounded-b-xl">
        <div className="w-full h-full bg-bolt-elements-background-depth-2 rounded-b-[9px]" />
      </div>

      {/* Content container */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Icon Component - constrained to 30% of viewport width */}
        <div className="w-full flex justify-center" style={{ maxWidth: '30vw', minWidth: '320px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -30 }}
              transition={{
                duration: 0.7,
                ease: [0.4, 0.0, 0.2, 1],
              }}
            >
              <CurrentComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Text positioned below the icons with 30px margin */}
        <div className="w-full flex flex-col items-center mt-4">
          {/* Rainbow Gradient Text */}
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={messageIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.5,
                  ease: [0.4, 0.0, 0.2, 1],
                }}
                className="relative"
              >
                <div
                  className="bg-gradient-to-r from-yellow-400 via-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent"
                  style={{ fontSize: '1.75rem', fontWeight: 500, lineHeight: 1.5 }}
                >
                  {currentMessage}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes rainbow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
};

export default PreviewLoad;
