import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MockupCard } from './MockupCard';
import { MockupNavBar } from './MockupNavBar';
import { MockupForm } from './MockupForm';
import { MockupDashboard } from './MockupDashboard';

const messages = [
  'Thinking about your idea...',
  'Jacking into the matrix...',
  'Exploring UI elements...',
  'Sprinkling a bit of magic...',
  'Putting it all together...',
];

const mockupLayouts = [
  { component: MockupCard, duration: 3000 },
  { component: MockupNavBar, duration: 2800 },
  { component: MockupForm, duration: 3200 },
  { component: MockupDashboard, duration: 3500 },
];

const ProgressStatus = () => {
  const [currentLayoutIndex, setCurrentLayoutIndex] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Cycle through mockup layouts and messages with synchronized timing
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLayoutIndex((prev) => (prev + 1) % mockupLayouts.length);
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, mockupLayouts[currentLayoutIndex].duration);

    return () => clearInterval(timer);
  }, [currentLayoutIndex]);

  const CurrentMockup = mockupLayouts[currentLayoutIndex].component;
  const currentMessage = messages[currentMessageIndex];

  return (
    <div className="w-full h-full relative">
      {/* Main content container with flexible centering */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Mockup Layout - responsive positioning */}
        <div className="flex-shrink-0 w-full max-w-[280px] min-w-[240px] mb-8 sm:mb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentLayoutIndex}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -20 }}
              transition={{
                duration: 0.6,
                ease: [0.4, 0.0, 0.2, 1],
              }}
            >
              <CurrentMockup />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Text and dots - responsive spacing */}
        <div className="flex-shrink-0 w-full text-center">
          {/* Animated gradient text */}
          <div className="mb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{
                  duration: 0.5,
                  ease: [0.4, 0.0, 0.2, 1],
                }}
              >
                <div className="animate-focus-text text-lg sm:text-xl font-medium px-4">{currentMessage}</div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Animated loading dots */}
          <div className="flex justify-center space-x-1.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <motion.div
                key={index}
                className="w-1.5 h-1.5 rounded-full bg-bolt-elements-textSecondary/60"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  delay: index * 0.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressStatus;
