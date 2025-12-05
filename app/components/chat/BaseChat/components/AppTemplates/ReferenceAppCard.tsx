import React, { useState } from 'react';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { classNames } from '~/utils/classNames';
import { assert } from '~/utils/nut';
// import { ExternalLink } from 'lucide-react';

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
  sendMessage,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleCustomize = async () => {
    assert(appPath, 'App path is required');

    sendMessage({
      messageInput: `Build me a new app based on '${appName}'`,
      chatMode: ChatMode.UserMessage,
      referenceAppPath: appPath,
    });
  };

  // const handleViewApplication = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   if (appPath) {
  //     window.open(`/app/${appPath}`, '_blank');
  //   }
  // };

  const isClickable = !!appPath;
  const displayPhoto = photo || 'https://placehold.co/800x450/1e293b/94a3b8?text=Coming+Soon';

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-black shadow-lg flex-shrink-0"
      style={{ width: '600px', height: '370px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* App Screenshot */}
      <img
        src={displayPhoto}
        alt={appName}
        className={classNames('w-full h-full object-cover object-top transition-all duration-300', {
          'blur-sm scale-105': isHovered && isClickable,
        })}
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

      {/* Content Section - Overlaid at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/60 dark:bg-white/40 backdrop-blur-sm">
        {/* Title */}
        <h3 className="text-xl font-bold text-black mb-1">{appName}</h3>

        {/* Description */}
        <p className="text-sm text-gray-900 leading-relaxed mb-4">{description}</p>

        {/* Feature Tags */}
        {bulletPoints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bulletPoints.map((point, index) => (
              <span key={index} className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-gray-200 rounded-full">
                {point}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover Overlay with Buttons */}
      {isClickable && (
        <div
          className={classNames(
            'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 transition-all duration-300',
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* Customize Button */}
          <button
            onClick={handleCustomize}
            className="px-8 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Customize it
          </button>

          {/* View Application Button */}
          {/* <button
            onClick={handleViewApplication}
            className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-full transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            View application
            <ExternalLink size={16} />
          </button> */}
        </div>
      )}
    </div>
  );
};
