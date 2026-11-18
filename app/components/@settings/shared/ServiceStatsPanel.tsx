import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/Collapsible';
import { classNames } from '~/utils/classNames';

export interface StatItem {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export interface ServiceStatsPanelProps {
  title: string;
  stats: StatItem[];
  isExpanded: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  lastUpdated?: string;
  emptyMessage?: string;
  headerActions?: React.ReactNode;
}

export function ServiceStatsPanel({
  title,
  stats,
  isExpanded,
  onToggle,
  isLoading = false,
  lastUpdated,
  emptyMessage = 'No statistics available',
  headerActions,
}: ServiceStatsPanelProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-bolt-elements-bg-depth-2 transition-colors">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{title}</h3>
              {lastUpdated && <span className="text-xs text-bolt-elements-textSecondary">Updated {lastUpdated}</span>}
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              <ChevronDown
                className={classNames(
                  'w-5 h-5 text-bolt-elements-textSecondary transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-bolt-elements-borderColor"
          >
            {isLoading ? (
              <div className="p-6">
                <div className="flex items-center justify-center py-8">
                  <div className="i-ph:spinner animate-spin text-2xl text-bolt-elements-textSecondary" />
                </div>
              </div>
            ) : stats.length === 0 ? (
              <div className="p-6">
                <p className="text-center text-bolt-elements-textSecondary">{emptyMessage}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-bolt-elements-bg-depth-2 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-bolt-elements-textSecondary">{stat.label}</p>
                      {stat.icon && (
                        <div className={classNames(stat.icon, 'text-lg text-bolt-elements-textSecondary')} />
                      )}
                    </div>
                    <p className="text-2xl font-semibold text-bolt-elements-textPrimary">{stat.value}</p>
                    {stat.trend && stat.trendValue && (
                      <div
                        className={classNames(
                          'flex items-center gap-1 mt-1 text-xs',
                          stat.trend === 'up' && 'text-green-500',
                          stat.trend === 'down' && 'text-red-500',
                          stat.trend === 'neutral' && 'text-bolt-elements-textSecondary',
                        )}
                      >
                        {stat.trend === 'up' && <span className="i-ph:arrow-up" />}
                        {stat.trend === 'down' && <span className="i-ph:arrow-down" />}
                        <span>{stat.trendValue}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
