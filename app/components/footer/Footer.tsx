import React from 'react';
import { MessageSquare } from '~/components/ui/Icon';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor border-opacity-50 px-6 h-[40px] flex items-center justify-center">
      <div className="flex items-center justify-center text-xs gap-6">
        <div className="flex items-center">
          <a
            href="https://www.replay.io/discord"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
          >
            <MessageSquare size={14} />
            Join our Discord
          </a>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-bolt-elements-textSecondary">
            Built with <span className="text-red-500">❤️</span> by a team who got tired of going down token-eating
            debugging rabbit holes.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.replay.io/terms-of-service"
            className="text-blue-500 hover:text-blue-600 transition-colors duration-200 hover:underline"
          >
            Terms
          </a>
          <span className="text-bolt-elements-textTertiary">|</span>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.replay.io/privacy-policy"
            className="text-blue-500 hover:text-blue-600 transition-colors duration-200 hover:underline"
          >
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
};
