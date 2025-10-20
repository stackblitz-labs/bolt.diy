import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useState, type ReactElement } from 'react';
import { classNames } from '~/utils/classNames';
import { DialogTitle, dialogVariants, dialogBackdropVariants } from '~/components/ui/Dialog';
import { X } from '~/components/ui/Icon';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsWindow = ({ open, onClose }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState<string>('');

  const tabs: { id: string; label: string; icon: string; component?: ReactElement }[] = [];

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild onClick={onClose}>
          <motion.div
            className="bg-black/50 fixed inset-0 z-max backdrop-blur-sm"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogBackdropVariants}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content aria-describedby={undefined} asChild>
          <motion.div
            className="fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] border border-bolt-elements-borderColor border-opacity-50 rounded-2xl shadow-2xl hover:shadow-3xl focus:outline-none overflow-hidden backdrop-blur-sm transition-shadow duration-300"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
          >
            <div className="flex flex-col md:flex-row h-full">
              <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-bolt-elements-borderColor border-opacity-50 bg-bolt-elements-background-depth-1 p-4 md:p-6 flex flex-row md:flex-col justify-between">
                <div className="flex-1 md:flex-none">
                  <DialogTitle className="flex-shrink-0 text-xl md:text-2xl font-bold text-bolt-elements-textHeading mb-4 md:mb-8 bg-gradient-to-r from-bolt-elements-textHeading to-bolt-elements-textSecondary bg-clip-text">
                    Settings
                  </DialogTitle>

                  <div className="flex md:flex-col gap-2 md:space-y-2 overflow-x-auto md:overflow-x-visible">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={classNames(
                          'flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl text-left text-xs md:text-sm font-medium transition-all duration-200 group whitespace-nowrap md:w-full',
                          activeTab === tab.id
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg border border-white/20'
                            : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 border border-transparent hover:border-bolt-elements-borderColor border-opacity-30 hover:shadow-sm',
                        )}
                      >
                        <div
                          className={classNames(
                            tab.icon,
                            'text-base md:text-lg transition-transform duration-200 group-hover:scale-110',
                          )}
                        />
                        <span className="transition-transform duration-200 group-hover:scale-105 hidden sm:inline">
                          {tab.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-bolt-elements-background-depth-2 bg-opacity-50 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                  {tabs.find((tab) => tab.id === activeTab)?.component}
                </div>
              </div>
            </div>

            <RadixDialog.Close asChild onClick={onClose}>
              <button className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group">
                <X className="transition-transform duration-200 group-hover:scale-110" size={18} />
              </button>
            </RadixDialog.Close>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
