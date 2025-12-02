import { classNames } from '~/utils/classNames';
import { AppFeatureStatus, type AppTest } from '~/lib/persistence/messageAppSummary';

interface TestsProps {
  featureTests: AppTest[];
  status: AppFeatureStatus;
}

const Tests = ({ featureTests, status }: TestsProps) => {
  // Helper function to determine test status display based on test status or feature status
  const getTestDisplayStatus = (test: AppTest): 'Pass' | 'Fail' | 'NotRun' | 'InProgress' => {
    if (test.status !== undefined) {
      return test.status;
    }

    // If test.status is undefined, derive from feature status
    if (status === AppFeatureStatus.Implemented) {
      return 'Pass';
    } else if (status === AppFeatureStatus.Failed) {
      return 'Fail';
    } else if (status === AppFeatureStatus.ImplementationInProgress) {
      return 'InProgress';
    } else {
      return 'NotRun';
    }
  };

  return (
    <div className="border-t border-bolt-elements-borderColor border-opacity-50">
      <div className="p-4">
        <div className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-4 bg-bolt-elements-background-depth-2 bg-opacity-30 px-2 py-1 rounded-md inline-block">
          Feature Tests ({featureTests.length})
        </div>
        <div className="space-y-3">
          {featureTests.map((test, testIdx) => {
            const displayStatus = getTestDisplayStatus(test);

            return (
              <div
                key={testIdx}
                className="flex items-center gap-3 p-3 bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01] group"
              >
                {displayStatus === 'InProgress' ? (
                  <div className="w-3 h-3 flex-shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                ) : (
                  <div
                    className={classNames('w-3 h-3 rounded-full border-2 flex-shrink-0', {
                      'bg-green-500 border-green-500': displayStatus === 'Pass',
                      'bg-red-500 border-red-500': displayStatus === 'Fail',
                      'bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor':
                        displayStatus === 'NotRun',
                    })}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-bolt-elements-textPrimary block truncate">{test.title}</span>
                </div>
                <div
                  className={classNames('text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 shadow-sm border', {
                    'text-green-700 bg-green-50 border-green-200': displayStatus === 'Pass',
                    'text-red-700 bg-red-50 border-red-200': displayStatus === 'Fail',
                    'text-blue-700 bg-blue-50 border-blue-200': displayStatus === 'InProgress',
                    'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor':
                      displayStatus === 'NotRun',
                  })}
                >
                  {displayStatus === 'Pass' && 'PASS'}
                  {displayStatus === 'Fail' && 'FAIL'}
                  {displayStatus === 'InProgress' && 'IN PROGRESS'}
                  {displayStatus === 'NotRun' && 'PENDING'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Tests;
