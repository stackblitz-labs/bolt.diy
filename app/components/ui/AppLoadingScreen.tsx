import { motion } from 'framer-motion';

interface AppLoadingScreenProps {
  appId?: string;
}

export const AppLoadingScreen = ({ appId }: AppLoadingScreenProps) => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-bolt-elements-background-depth-1">
      <div className="flex flex-col items-center space-y-6 max-w-md mx-auto px-6">
        <motion.div
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <img src="/logo-styled.svg" alt="Nut.new" className="w-6 h-6" />
        </motion.div>

        <div className="text-center space-y-2">
          <motion.h2
            className="text-xl font-semibold text-bolt-elements-textHeading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Loading your app
          </motion.h2>
          <motion.p
            className="text-bolt-elements-textSecondary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {appId ? `Fetching project ${appId.slice(0, 8)}...` : 'Preparing your workspace...'}
          </motion.p>
        </div>

        <div className="flex space-x-2">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: index * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
