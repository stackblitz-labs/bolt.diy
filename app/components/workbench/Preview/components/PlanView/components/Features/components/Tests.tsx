import { classNames } from '~/utils/classNames';
import { type AppTest } from '~/lib/persistence/messageAppSummary';

interface TestsProps {
  featureTests: AppTest[];
}

const Tests = ({ featureTests }: TestsProps) => {
  return (
    <div className="border-t border-bolt-elements-borderColor border-opacity-50">
      <div className="p-4">
        <div className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-4 bg-bolt-elements-background-depth-2 bg-opacity-30 px-2 py-1 rounded-md inline-block">
          Feature Tests ({featureTests.length})
        </div>
        <div className="space-y-3">
          {featureTests.map((test, testIdx) => (
            <div
              key={testIdx}
              className="flex items-center gap-3 p-3 bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01] group"
            >
              <div
                className={classNames('w-3 h-3 rounded-full border-2 flex-shrink-0', {
                  'bg-green-500 border-green-500': test.status === 'Pass',
                  'bg-red-500 border-red-500': test.status === 'Fail',
                  'bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor': test.status === 'NotRun',
                })}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-bolt-elements-textPrimary block truncate">{test.title}</span>
              </div>
              <div
                className={classNames('text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 shadow-sm border', {
                  'text-green-700 bg-green-50 border-green-200': test.status === 'Pass',
                  'text-red-700 bg-red-50 border-red-200': test.status === 'Fail',
                  'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor':
                    test.status === 'NotRun',
                })}
              >
                {test.status === 'Pass' && 'PASS'}
                {test.status === 'Fail' && 'FAIL'}
                {test.status === 'NotRun' && 'PENDING'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tests;
