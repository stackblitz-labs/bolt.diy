import React from 'react';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { classNames } from '~/utils/classNames';
import { assert } from '~/utils/nut';
import {
  CheckCircle,
  Rocket,
  // ExternalLink
} from '~/components/ui/Icon';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';

interface ReferenceAppCardProps {
  appName: string;
  description: string;
  bulletPoints?: string[];
  photo?: string;
  appPath?: string;
  photoOnLeft?: boolean;
  sendMessage: (params: ChatMessageParams) => void;
}

export const ReferenceAppCard: React.FC<ReferenceAppCardProps> = ({
  appName,
  description,
  bulletPoints = [],
  photo,
  appPath,
  photoOnLeft = true,
  sendMessage,
}) => {
  const handleClick = async () => {
    assert(appPath, 'App path is required');

    sendMessage({
      messageInput: `Build me a new app based on '${appName}'`,
      chatMode: ChatMode.UserMessage,
      referenceAppPath: appPath,
    });
  };

  const isClickable = !!appPath;
  const displayPhoto = photo || 'https://placehold.co/800x450/1e293b/94a3b8?text=Coming+Soon';

  // const handleViewDemo = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   if (appPath) {
  //     window.open(`/app/${appPath}`, '_blank');
  //   }
  // };

  return (
    <div
      className={classNames('flex flex-col lg:flex-row gap-6 lg:gap-8', {
        'lg:flex-row-reverse': !photoOnLeft,
      })}
    >
      {/* Photo Section with Border */}
      <div className="relative w-full lg:w-3/5 aspect-video lg:aspect-auto lg:h-auto min-h-[280px] overflow-hidden bg-white dark:bg-bolt-elements-background-depth-2 rounded-2xl shadow-md border border-gray-200 dark:border-bolt-elements-borderColor flex-shrink-0">
        <img
          src={displayPhoto}
          alt={appName}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>

      {/* Content Section - No Border */}
      <div className="flex-1 flex flex-col justify-center">
        <div>
          {/* Title */}
          <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-bolt-elements-textHeading mb-4 leading-tight">
            {appName}
          </h3>

          {/* Description */}
          <p className="text-base lg:text-lg text-gray-600 dark:text-bolt-elements-textSecondary leading-relaxed mb-6">
            {description}
          </p>

          {/* Bullet Points with Checkmarks */}
          {bulletPoints.length > 0 && (
            <ul className="space-y-3 mb-8">
              {bulletPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle
                    className="text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0"
                    size={20}
                    strokeWidth={2.5}
                  />
                  <span className="text-sm lg:text-base text-gray-700 dark:text-bolt-elements-textSecondary leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Buttons */}
        {isClickable && (
          <div className="flex flex-wrap gap-3">
            <TooltipProvider>
              {/* <button
              onClick={handleViewDemo}
              className="flex-1 min-w-[140px] px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <ExternalLink size={18} />
              <span>View Live Demo</span>
            </button> */}
              <WithTooltip tooltip="Start customizing this app">
                <button
                  onClick={handleClick}
                  className="flex items-center justify-center gap-2 w-fit px-6 py-3 bg-white dark:bg-bolt-elements-background-depth-2 border-2 border-gray-300 dark:border-bolt-elements-borderColor text-gray-700 dark:text-bolt-elements-textHeading font-semibold rounded-xl transition-all duration-200 hover:border-gray-400 dark:hover:border-bolt-elements-focus/60 hover:bg-gray-50 dark:hover:bg-bolt-elements-background-depth-3"
                >
                  Customize It!
                  <Rocket className="transition-transform duration-200 group-hover:scale-110" size={18} />
                </button>
              </WithTooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
};
