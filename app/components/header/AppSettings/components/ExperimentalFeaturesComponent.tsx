import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { Switch } from '~/components/ui/Switch';
import { experimentalFeaturesStore, setExperimentalFeatures } from '~/lib/stores/experimentalFeatures';

export const ExperimentalFeaturesComponent = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const experimentalFeatures = useStore(experimentalFeaturesStore);

  const handleBugReportsToggle = (checked: boolean) => {
    setExperimentalFeatures({
      ...experimentalFeatures,
      bugReports: checked,
    });
  };

  const handleUpFrontPricingToggle = (checked: boolean) => {
    setExperimentalFeatures({
      ...experimentalFeatures,
      upFrontPricing: checked,
    });
  };

  return (
    <div className="space-y-2">
      <button
        className="w-full flex items-center justify-between p-4 bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor hover:border-bolt-elements-focus/60 hover:bg-bolt-elements-background-depth-3 transition-all duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="i-ph:flask-duotone text-bolt-elements-textPrimary" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Experimental Features</span>
        </div>
        <div className={`i-ph:caret-down transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="p-4 bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bolt-elements-textPrimary">Bug Reports</span>
              <span className="text-xs text-bolt-elements-textSecondary">
                Enable experimental bug reporting functionality
              </span>
            </div>
            <Switch checked={experimentalFeatures.bugReports ?? false} onCheckedChange={handleBugReportsToggle} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bolt-elements-textPrimary">Up Front Pricing</span>
              <span className="text-xs text-bolt-elements-textSecondary">
                Enable experimental up front pricing functionality
              </span>
            </div>
            <Switch
              checked={experimentalFeatures.upFrontPricing ?? false}
              onCheckedChange={handleUpFrontPricingToggle}
            />
          </div>
        </div>
      )}
    </div>
  );
};
