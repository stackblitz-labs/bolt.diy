import { useStore } from '@nanostores/react';
import { memo, useMemo } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { motion } from 'framer-motion';

interface FileStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const FileStatusIndicator = memo(({ className = '', showDetails = true }: FileStatusIndicatorProps) => {
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);

  const stats = useMemo(() => {
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;

    Object.entries(files).forEach(([_path, dirent]) => {
      if (dirent?.type === 'file') {
        totalFiles++;
        totalSize += dirent.content?.length || 0;
      } else if (dirent?.type === 'folder') {
        totalFolders++;
      }
    });

    return {
      totalFiles,
      totalFolders,
      unsavedCount: unsavedFiles.size,
      totalSize: formatFileSize(totalSize),
      modifiedPercentage: totalFiles > 0 ? Math.round((unsavedFiles.size / totalFiles) * 100) : 0,
    };
  }, [files, unsavedFiles]);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const getStatusColor = () => {
    if (stats.unsavedCount === 0) {
      return 'text-green-500';
    }

    if (stats.modifiedPercentage > 50) {
      return 'text-red-500';
    }

    if (stats.modifiedPercentage > 20) {
      return 'text-yellow-500';
    }

    return 'text-orange-500';
  };

  return (
    <div
      className={classNames(
        'flex items-center gap-4 px-3 py-1.5 rounded-lg',
        'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor',
        'text-xs text-bolt-elements-textTertiary',
        className,
      )}
    >
      {/* Status dot with pulse animation */}
      <div className="flex items-center gap-2">
        <motion.div
          animate={{
            scale: stats.unsavedCount > 0 ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: stats.unsavedCount > 0 ? Infinity : 0,
            repeatType: 'loop',
          }}
          className={classNames(
            'w-2 h-2 rounded-full',
            getStatusColor(),
            stats.unsavedCount > 0 ? 'bg-current' : 'bg-green-500',
          )}
        />
        <span className={getStatusColor()}>
          {stats.unsavedCount === 0 ? 'All saved' : `${stats.unsavedCount} unsaved`}
        </span>
      </div>

      {showDetails && (
        <>
          {/* File count */}
          <div className="flex items-center gap-1.5">
            <div className="i-ph:file-duotone" />
            <span>{stats.totalFiles} files</span>
          </div>

          {/* Folder count */}
          <div className="flex items-center gap-1.5">
            <div className="i-ph:folder-duotone" />
            <span>{stats.totalFolders} folders</span>
          </div>

          {/* Total size */}
          <div className="flex items-center gap-1.5">
            <div className="i-ph:database-duotone" />
            <span>{stats.totalSize}</span>
          </div>

          {/* Progress bar for unsaved files */}
          {stats.unsavedCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs">{stats.modifiedPercentage}% modified</span>
              <div className="w-20 h-1.5 bg-bolt-elements-background-depth-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.modifiedPercentage}%` }}
                  transition={{ duration: 0.3 }}
                  className={classNames(
                    'h-full rounded-full',
                    stats.modifiedPercentage > 50
                      ? 'bg-red-500'
                      : stats.modifiedPercentage > 20
                        ? 'bg-yellow-500'
                        : 'bg-orange-500',
                  )}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

FileStatusIndicator.displayName = 'FileStatusIndicator';
