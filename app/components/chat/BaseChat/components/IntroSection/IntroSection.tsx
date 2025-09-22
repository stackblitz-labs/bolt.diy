import React from 'react';
import useViewport from '~/lib/hooks/useViewport';

export const IntroSection: React.FC = () => {
  const isSmallViewport = useViewport(800);

  if (isSmallViewport) {
    return (
      <div id="intro" className="max-w-4xl mx-auto text-center px-4 mt-8">
        <h1 className="text-3xl font-bold text-bolt-elements-textHeading mb-4 animate-fade-in leading-tight">
          Build web apps
          <span className="bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent block">
            that work
          </span>
        </h1>

        <p className="text-base mb-6 text-bolt-elements-textSecondary animate-fade-in animation-delay-100 leading-relaxed max-w-lg mx-auto">
          Build, test, and deploy your applications in minutes. From idea to going live with AI — no setup required.
        </p>

        <div className="flex justify-center gap-4 mb-6 animate-fade-in animation-delay-200">
          <div className="flex items-center gap-1.5 text-bolt-elements-textSecondary">
            <div className="w-6 h-6 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <div className="i-ph:hammer text-blue-500 text-sm" />
            </div>
            <span className="text-xs font-medium">Build</span>
          </div>
          <div className="flex items-center gap-1.5 text-bolt-elements-textSecondary">
            <div className="w-6 h-6 bg-green-500/10 rounded-lg flex items-center justify-center">
              <div className="i-ph:flask text-green-500 text-sm" />
            </div>
            <span className="text-xs font-medium">Test</span>
          </div>
          <div className="flex items-center gap-1.5 text-bolt-elements-textSecondary">
            <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <div className="i-ph:rocket-launch text-purple-500 text-sm" />
            </div>
            <span className="text-xs font-medium">Deploy</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="intro" className="max-w-4xl mx-auto text-center px-6 lg:px-8">
      <div className="inline-flex items-center gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-full px-4 py-2 mb-8 animate-fade-in">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-bolt-elements-textSecondary">We’re in BETA</span>
      </div>

      <h1 className="text-4xl lg:text-7xl font-bold text-bolt-elements-textHeading mb-6 animate-fade-in animation-delay-100 leading-tight">
        Build web apps
        <span className="bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent ml-4">
          that work
        </span>
      </h1>

      <p className="text-lg lg:text-xl mb-10 text-bolt-elements-textSecondary animate-fade-in animation-delay-200 leading-relaxed max-w-2xl mx-auto">
        Build, test, and deploy your applications in minutes. From idea to going live with AI — no setup required.
      </p>

      <div className="flex flex-wrap justify-center gap-6 mb-8 animate-fade-in animation-delay-300">
        <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <div className="i-ph:hammer text-blue-500" />
          </div>
          <span className="text-sm font-medium">Automated Build</span>
        </div>
        <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
          <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
            <div className="i-ph:flask text-green-500" />
          </div>
          <span className="text-sm font-medium">Automatic Testing</span>
        </div>
        <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
          <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
            <div className="i-ph:rocket-launch text-purple-500" />
          </div>
          <span className="text-sm font-medium">One-Click Deploy</span>
        </div>
      </div>
    </div>
  );
};
