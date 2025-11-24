import { useState, useEffect } from 'react';
import { Link, Check, Copy, ExternalLink } from '~/components/ui/Icon';

const DeploymentSuccessful = ({
  result,
  setIsModalOpen,
}: {
  result: any;
  setIsModalOpen: (isOpen: boolean) => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result?.siteURL);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <div className="text-center py-8">
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-lg">
          <div className="text-4xl">🎉</div>
        </div>
        <h2 className="text-4xl font-bold text-bolt-elements-textHeading mb-3 bg-gradient-to-r from-bolt-elements-textHeading to-bolt-elements-textSecondary bg-clip-text">
          Woohoo!
        </h2>
        <p className="text-lg text-bolt-elements-textSecondary max-w-md mx-auto leading-relaxed whitespace-pre-wrap">
          Your application has been successfully deployed and is now live on the web.
        </p>
      </div>

      <div className="mb-8">
        <div className="bg-bolt-elements-background-depth-2 bg-opacity-50 rounded-2xl py-6 px-6 border border-bolt-elements-borderColor border-opacity-50 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Link className="text-bolt-elements-textPrimary" size={18} />
              <span className="text-sm font-semibold text-bolt-elements-textPrimary">Your App's URL:</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor border-opacity-50 shadow-sm">
              <code className="text-sm text-bolt-elements-textPrimary font-mono break-words leading-relaxed block truncate">
                {result?.siteURL}
              </code>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleCopy}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md hover:scale-105 group ${
                  copied
                    ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-700 border border-green-500/20'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor'
                }`}
                title={copied ? 'Copied!' : 'Copy URL'}
              >
                {copied ? (
                  <>
                    <Check
                      className="text-green-500 transition-transform duration-200 group-hover:scale-110"
                      size={18}
                    />
                    <span className="transition-transform duration-200 group-hover:scale-105">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="transition-transform duration-200 group-hover:scale-110" size={18} />
                    <span className="transition-transform duration-200 group-hover:scale-105">Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <a
          href={result?.siteURL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
        >
          <ExternalLink className="transition-transform duration-200 group-hover:scale-110" size={18} />
          <span className="transition-transform duration-200 group-hover:scale-105">Open App</span>
        </a>
        <button
          onClick={() => setIsModalOpen(false)}
          className="px-6 py-3 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor rounded-xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md hover:scale-105 group"
        >
          <span className="transition-transform duration-200 group-hover:scale-105">Close</span>
        </button>
      </div>
    </div>
  );
};

export default DeploymentSuccessful;
