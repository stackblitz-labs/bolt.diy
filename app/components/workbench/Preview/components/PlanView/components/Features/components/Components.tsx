import { type AppFeature, type AppSummary } from '~/lib/persistence/messageAppSummary';
import { formatPascalCaseName } from '~/utils/names';

interface ComponentsProps {
  summary: AppSummary;
  feature: AppFeature;
}

function getComponentDescription(summary: AppSummary, componentName: string) {
  for (const page of summary.pages ?? []) {
    for (const component of page.components ?? []) {
      if (component.name === componentName) {
        return component.description;
      }
    }
  }
  return 'Unknown component';
}

const Components = ({ summary, feature }: ComponentsProps) => {
  return (
    <div className="border-t border-bolt-elements-borderColor border-opacity-50">
      <div className="p-4">
        <div className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-4 bg-bolt-elements-background-depth-2 bg-opacity-30 px-2 py-1 rounded-md inline-block">
          Components ({feature?.componentNames?.length})
        </div>
        <div className="space-y-3">
          {feature?.componentNames?.map((name, idx) => (
            <div
              key={idx}
              className="bg-bolt-elements-background-depth-2 rounded-xl p-4 border border-bolt-elements-borderColor shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01] group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
                <span className="font-mono text-sm font-semibold text-bolt-elements-textPrimary">
                  {formatPascalCaseName(name)}
                </span>
              </div>

              <div className="text-xs text-bolt-elements-textSecondary">{getComponentDescription(summary, name)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Components;
