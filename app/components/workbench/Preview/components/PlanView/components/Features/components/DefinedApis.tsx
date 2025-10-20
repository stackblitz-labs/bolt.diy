import { type AppFeature } from '~/lib/persistence/messageAppSummary';
import { formatPascalCaseName } from '~/utils/names';

interface DefinedApisProps {
  feature: AppFeature;
}

const DefinedApis = ({ feature }: DefinedApisProps) => {
  return (
    <div className="border-t border-bolt-elements-borderColor border-opacity-50">
      <div className="p-4">
        <div className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-4 bg-bolt-elements-background-depth-2 bg-opacity-30 px-2 py-1 rounded-md inline-block">
          Defined APIs ({feature?.definedAPIs?.length})
        </div>
        <div className="space-y-3">
          {feature?.definedAPIs?.map((api, apiIdx) => (
            <div
              key={apiIdx}
              className="bg-bolt-elements-background-depth-2 rounded-xl p-4 border border-bolt-elements-borderColor shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01] group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full shadow-sm"></div>
                <span className="font-mono text-sm font-semibold text-bolt-elements-textPrimary">
                  {formatPascalCaseName(api.name)}
                </span>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-50 text-orange-700 rounded-lg border border-orange-200 shadow-sm">
                  {api.kind}
                </span>
              </div>

              {api.description && <div className="text-xs text-bolt-elements-textSecondary">{api.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DefinedApis;
