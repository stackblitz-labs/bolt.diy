/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { classNames } from '~/utils/classNames';
import { TooltipProvider } from '@radix-ui/react-tooltip';

export const TEXTAREA_MIN_HEIGHT = 76;

interface UnauthorizedProps {
  handleCopyApp: () => void;
  isCopying: boolean;
}

export const Unauthorized = ({ handleCopyApp, isCopying }: UnauthorizedProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={classNames('relative flex h-full w-full overflow-hidden')}>
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg w-full">
            <div className="bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor/30 shadow-lg p-8 text-center backdrop-blur-sm">
              <div className="mb-8">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <div className="i-ph:lock-key-duotone text-white text-2xl"></div>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-bolt-elements-textHeading mb-4">App Access Restricted</h2>
                <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl p-5 mb-6 shadow-sm">
                  <p className="text-bolt-elements-textPrimary leading-relaxed font-medium">
                    This app is owned by another user. You can create a copy to work with it and make your own
                    modifications.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleCopyApp}
                  disabled={isCopying}
                  className={classNames(
                    'inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm w-full sm:w-auto',
                    {
                      'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/20':
                        !isCopying,
                      'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary border border-bolt-elements-borderColor/30 cursor-not-allowed':
                        isCopying,
                    },
                  )}
                >
                  {isCopying ? (
                    <span className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin"></div>
                      Creating Copy...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <div className="i-ph:copy-duotone text-lg"></div>
                      Create a Copy
                    </span>
                  )}
                </button>

                <p className="text-xs text-bolt-elements-textSecondary">
                  Your copy will be independent and you'll have full access to modify it
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
