import { motion } from 'framer-motion';
import { Wrench, Hammer, Zap } from 'lucide-react';

export function ToolsIcon() {
  return (
    <motion.div
      className="bg-card rounded-lg p-4 w-full max-w-sm mx-auto overflow-hidden flex flex-col items-center justify-center space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Main tools with consistent animation */}
      <motion.div
        className="flex items-center space-x-2"
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 2, 0, -2, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      >
        <Wrench className="h-6 w-6 text-bolt-elements-textPrimary mb-8" />
        <Hammer className="h-6 w-6 text-bolt-elements-textPrimary mb-8" />
      </motion.div>

      {/* Sparks effect */}
      <div className="flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute"
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
              x: [0, (i - 1) * 20, (i - 1) * 30],
              y: [0, -10, -20],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          >
            <Zap className="h-3 w-3 text-yellow-500" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
