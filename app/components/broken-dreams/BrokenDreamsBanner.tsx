import useViewport from '~/lib/hooks/useViewport';
import { motion } from 'framer-motion';

const BrokenDreamsBanner = () => {
  const isSmallViewport = useViewport(800);

  return (
    <motion.div
      className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 py-2 px-4"
      animate={{
        background: [
          'linear-gradient(to right, rgb(124 58 237), rgb(219 39 119), rgb(37 99 235))',
          'linear-gradient(to right, rgb(139 92 246), rgb(236 72 153), rgb(59 130 246))',
          'linear-gradient(to right, rgb(124 58 237), rgb(219 39 119), rgb(37 99 235))',
        ],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        <div>
          <p className="text-white font-medium text-sm sm:text-base">
            {!isSmallViewport ? 'Rebuild your vibe-broken apps with Nut.new.' : 'Rebuild your apps with Nut.new.'}
          </p>
        </div>
        <div className="ml-4">
          <a
            href="/rebuild-broken-dreams"
            className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105"
          >
            Learn More
          </a>
        </div>
      </div>
    </motion.div>
  );
};

export default BrokenDreamsBanner;
