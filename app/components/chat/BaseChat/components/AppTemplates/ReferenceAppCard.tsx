import React from 'react';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { classNames } from '~/utils/classNames';
import { assert } from '~/utils/nut';

interface ReferenceAppCardProps {
  appName: string;
  description: string;
  bulletPoints?: string[];
  photo?: string;
  appPath?: string;
  photoOnLeft?: boolean;
  sendMessage: (params: ChatMessageParams) => void;
  className?: string;
}

export const ReferenceAppCard: React.FC<ReferenceAppCardProps> = ({
  appName,
  description,
  bulletPoints = [],
  photo,
  appPath,
  sendMessage,
  className,
}) => {
  const handleCustomize = async () => {
    assert(appPath, 'App path is required');

    sendMessage({
      messageInput: `Build me a new app based on '${appName}'`,
      chatMode: ChatMode.UserMessage,
      referenceAppPath: appPath,
    });
  };

  const displayPhoto = photo || 'https://placehold.co/800x450/1e293b/94a3b8?text=Coming+Soon';
  const isClickable = !!appPath;

  return (
    <div
      className={classNames(
        'group relative overflow-hidden rounded-lg flex flex-col justify-end items-start gap-4 p-4 border block w-full h-[369px] aspect-video border-[var(--base-border,#E5E5E5)] transition-all duration-300',
        className,
      )}
    >
      {/* App Screenshot - Sharp, blurred on hover */}
      <img
        src={displayPhoto}
        alt={appName}
        className="absolute inset-0 w-full h-full object-cover object-top group-hover:blur-[2px] transition-all duration-300"
      />

      {/* Blurred image overlay - only at bottom (default state) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
        <img
          src={displayPhoto}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top blur-[2px]"
          style={{
            maskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 60%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 60%)',
          }}
        />
      </div>

      {/* Background gradient overlays - default state */}
      <div
        className="absolute inset-0 pointer-events-none group-hover:opacity-0 transition-opacity duration-300"
        style={{
          background:
            'linear-gradient(156deg, rgba(255, 255, 255, 0.00) 44.15%, #FFF 95.01%), linear-gradient(236deg, rgba(255, 255, 255, 0.00) 26.51%, rgba(255, 255, 255, 0.60) 84.05%)',
        }}
      />

      {/* Hover state: Gradient overlay with white and pink/red gradients */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'linear-gradient(156deg, rgba(255, 255, 255, 0.00) 44.15%, #FFF 95.01%), linear-gradient(236deg, rgba(0, 0, 0, 0.00) 26.51%, var(--tailwind-colors-slate-500, rgba(240, 45, 94, 0.50)) 84.05%)',
        }}
      />

      {/* Content Section - Positioned at bottom via flexbox, hidden on hover */}
      <div className="flex flex-col relative w-full gap-4 group-hover:opacity-0 transition-opacity duration-300">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <h3
            className="text-lg font-bold leading-none text-black"
            style={{
              textShadow:
                'var(--shadow-sm-1-offset-x, 0) var(--shadow-sm-1-offset-y, 1px) var(--shadow-sm-1-blur-radius, 3px) var(--shadow-sm-1-color, rgba(0, 0, 0, 0.10)), var(--shadow-sm-2-offset-x, 0) var(--shadow-sm-2-offset-y, 1px) var(--shadow-sm-2-blur-radius, 2px) var(--shadow-sm-2-color, rgba(0, 0, 0, 0.10))',
            }}
          >
            {appName}
          </h3>

          {/* Description */}
          <p
            className="text-xs font-normal leading-4 text-black"
            style={{
              textShadow:
                'var(--shadow-sm-1-offset-x, 0) var(--shadow-sm-1-offset-y, 1px) var(--shadow-sm-1-blur-radius, 3px) var(--shadow-sm-1-color, rgba(0, 0, 0, 0.10)), var(--shadow-sm-2-offset-x, 0) var(--shadow-sm-2-offset-y, 1px) var(--shadow-sm-2-blur-radius, 2px) var(--shadow-sm-2-color, rgba(0, 0, 0, 0.10))',
            }}
          >
            {description}
          </p>
        </div>

        {/* Feature Tags */}
        {bulletPoints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bulletPoints.map((badge, index) => (
              <span key={index} className="px-3 py-1.5 text-sm font-medium bg-white text-rose-500 rounded-full">
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover state: Buttons - centered */}
      {isClickable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
          {/* Customize it button */}
          <button
            onClick={handleCustomize}
            className="px-6 py-3 bg-rose-500 text-white font-semibold rounded-full hover:bg-rose-600 transition-colors duration-200 whitespace-nowrap"
          >
            Customize it
          </button>
        </div>
      )}
    </div>
  );
};
