import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CollectionPage } from './CollectionPage';
import type { CollectionPageIndexEntry, LandingPageIndexEntry } from '~/lib/replay/ReferenceApps';

interface CollectionModalProps {
  collection: CollectionPageIndexEntry | null;
  referenceApps: LandingPageIndexEntry[];
  onClose: () => void;
  onAppClick: (app: LandingPageIndexEntry) => void;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({ collection, referenceApps, onClose, onAppClick }) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (collection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [collection]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && collection) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [collection, onClose]);

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 300,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
      transition: { duration: 0.2 },
    },
  };

  return (
    <AnimatePresence>
      {collection && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-5xl mx-4 h-[95vh] overflow-y-auto rounded-xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <CollectionPage
              collection={collection}
              referenceApps={referenceApps}
              onClose={onClose}
              onAppClick={onAppClick}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
