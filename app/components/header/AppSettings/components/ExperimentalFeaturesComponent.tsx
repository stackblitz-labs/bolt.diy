import { useState } from 'react';
import { FlaskConical, ChevronDown } from '~/components/ui/Icon';

export const ExperimentalFeaturesComponent = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        className="w-full flex items-center justify-between p-4 bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor hover:border-bolt-elements-focus/60 hover:bg-bolt-elements-background-depth-3 transition-all duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FlaskConical className="text-bolt-elements-textPrimary" size={18} />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Experimental Features</span>
        </div>
        <ChevronDown
          className={`transition-transform duration-200 text-bolt-elements-textPrimary ${isExpanded ? 'rotate-180' : ''}`}
          size={16}
        />
      </button>

      {isExpanded && (
        <div className="p-4 bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor space-y-3"></div>
      )}
    </div>
  );
};
