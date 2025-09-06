import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { toast } from 'react-toastify';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';

interface ImportProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (files: Map<string, string>) => void;
}

interface FileStructure {
  [path: string]: string | ArrayBuffer;
}

interface ImportStats {
  totalFiles: number;
  totalSize: number;
  fileTypes: Map<string, number>;
  directories: Set<string>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per file
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB max total

const IGNORED_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /\.next\//,
  /dist\//,
  /build\//,
  /\.cache\//,
  /\.vscode\//,
  /\.idea\//,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /\.env\.local$/,
  /\.env\.production$/,
];

const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

export const ImportProjectDialog: React.FC<ImportProjectDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileStructure>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const resetState = useCallback(() => {
    setSelectedFiles({});
    setImportStats(null);
    setImportProgress(0);
    setErrorMessage(null);
    setIsProcessing(false);
  }, []);

  const shouldIgnoreFile = (path: string): boolean => {
    return IGNORED_PATTERNS.some((pattern) => pattern.test(path));
  };

  const isBinaryFile = (filename: string): boolean => {
    return BINARY_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const processZipFile = async (file: File): Promise<FileStructure> => {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);
    const files: FileStructure = {};
    const stats: ImportStats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: new Map(),
      directories: new Set(),
    };

    const filePromises: Promise<void>[] = [];

    zipData.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && !shouldIgnoreFile(relativePath)) {
        const promise = (async () => {
          try {
            const content = await zipEntry.async(isBinaryFile(relativePath) ? 'arraybuffer' : 'string');
            files[relativePath] = content;

            stats.totalFiles++;

            // Use a safe method to get uncompressed size
            const size = (zipEntry as any)._data?.uncompressedSize || 0;
            stats.totalSize += size;

            const ext = relativePath.split('.').pop() || 'unknown';
            stats.fileTypes.set(ext, (stats.fileTypes.get(ext) || 0) + 1);

            const dir = relativePath.substring(0, relativePath.lastIndexOf('/'));

            if (dir) {
              stats.directories.add(dir);
            }

            setImportProgress((prev) => Math.min(prev + 100 / Object.keys(zipData.files).length, 100));
          } catch (err) {
            console.error(`Failed to process ${relativePath}:`, err);
          }
        })();
        filePromises.push(promise);
      }
    });

    await Promise.all(filePromises);
    setImportStats(stats);

    return files;
  };

  const processFileList = async (fileList: FileList): Promise<FileStructure> => {
    const files: FileStructure = {};
    const stats: ImportStats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: new Map(),
      directories: new Set(),
    };

    let totalSize = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = (file as any).webkitRelativePath || file.name;

      if (shouldIgnoreFile(path)) {
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.warning(`Skipping ${file.name}: File too large (${formatFileSize(file.size)})`);
        continue;
      }

      totalSize += file.size;

      if (totalSize > MAX_TOTAL_SIZE) {
        toast.error('Total size exceeds 200MB limit');
        break;
      }

      try {
        const content = await (isBinaryFile(file.name) ? file.arrayBuffer() : file.text());

        files[path] = content;
        stats.totalFiles++;
        stats.totalSize += file.size;

        const ext = file.name.split('.').pop() || 'unknown';
        stats.fileTypes.set(ext, (stats.fileTypes.get(ext) || 0) + 1);

        const dir = path.substring(0, path.lastIndexOf('/'));

        if (dir) {
          stats.directories.add(dir);
        }

        setImportProgress(((i + 1) / fileList.length) * 100);
      } catch (err) {
        console.error(`Failed to read ${file.name}:`, err);
      }
    }

    setImportStats(stats);

    return files;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setImportProgress(0);

    try {
      let processedFiles: FileStructure = {};

      if (files.length === 1 && files[0].name.endsWith('.zip')) {
        processedFiles = await processZipFile(files[0]);
      } else {
        processedFiles = await processFileList(files);
      }

      if (Object.keys(processedFiles).length === 0) {
        toast.warning('No valid files found to import');
        setIsProcessing(false);

        return;
      }

      setSelectedFiles(processedFiles);
      toast.info(`Ready to import ${Object.keys(processedFiles).length} files`);
    } catch (error) {
      console.error('Error processing files:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process files');
      toast.error('Failed to process files');
    } finally {
      setIsProcessing(false);
      setImportProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;

    if (files.length > 0) {
      const input = fileInputRef.current;

      if (input) {
        const dataTransfer = new DataTransfer();
        Array.from(files).forEach((file) => dataTransfer.items.add(file));
        input.files = dataTransfer.files;
        handleFileSelect({ target: input } as any);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'file';
  };

  const getFileIcon = (filename: string): string => {
    const ext = getFileExtension(filename);
    const iconMap: { [key: string]: string } = {
      js: 'i-vscode-icons:file-type-js',
      jsx: 'i-vscode-icons:file-type-reactjs',
      ts: 'i-vscode-icons:file-type-typescript',
      tsx: 'i-vscode-icons:file-type-reactts',
      css: 'i-vscode-icons:file-type-css',
      scss: 'i-vscode-icons:file-type-scss',
      html: 'i-vscode-icons:file-type-html',
      json: 'i-vscode-icons:file-type-json',
      md: 'i-vscode-icons:file-type-markdown',
      py: 'i-vscode-icons:file-type-python',
      vue: 'i-vscode-icons:file-type-vue',
      svg: 'i-vscode-icons:file-type-svg',
      git: 'i-vscode-icons:file-type-git',
      folder: 'i-vscode-icons:default-folder',
    };

    return iconMap[ext] || 'i-vscode-icons:default-file';
  };

  const handleImportClick = useCallback(async () => {
    if (Object.keys(selectedFiles).length === 0) {
      return;
    }

    setIsProcessing(true);

    try {
      const fileMap = new Map<string, string>();

      for (const [path, content] of Object.entries(selectedFiles)) {
        if (typeof content === 'string') {
          fileMap.set(path, content);
        } else if (content instanceof ArrayBuffer) {
          // Convert ArrayBuffer to base64 string for binary files
          const bytes = new Uint8Array(content);
          const binary = String.fromCharCode(...bytes);
          const base64 = btoa(binary);
          fileMap.set(path, base64);
        }
      }

      if (onImport) {
        // Use the provided onImport callback
        await onImport(fileMap);
      }

      toast.success(`Successfully imported ${importStats?.totalFiles || 0} files`, {
        position: 'bottom-right',
        autoClose: 3000,
      });

      resetState();
      onClose();
    } catch (error) {
      toast.error('Failed to import project', { position: 'bottom-right' });
      setErrorMessage(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFiles, importStats, onImport, onClose, resetState]);

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog className="max-w-3xl" showCloseButton={false}>
        <div className="p-6">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="i-ph:upload-duotone text-3xl text-accent-500" />
            Import Existing Project
          </DialogTitle>
          <DialogDescription>
            Upload your project files or drag and drop them here. Supports individual files, folders, or ZIP archives.
          </DialogDescription>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              {!Object.keys(selectedFiles).length ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    ref={dropZoneRef}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={classNames(
                      'relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200',
                      isDragging
                        ? 'border-accent-500 bg-accent-500/10 scale-[1.02]'
                        : 'border-bolt-elements-borderColor hover:border-accent-400/50',
                      isProcessing ? 'pointer-events-none opacity-50' : '',
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".zip,*"
                      onChange={handleFileSelect}
                      className="hidden"
                      {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                    />

                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <motion.div
                          animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          className="i-ph:cloud-arrow-up-duotone text-6xl text-accent-500"
                        />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                          {isDragging ? 'Drop your project here' : 'Drag & Drop your project'}
                        </h3>
                        <p className="text-sm text-bolt-elements-textSecondary mb-4">
                          Support for folders, multiple files, or ZIP archives
                        </p>
                      </div>

                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessing}
                          className="px-6 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Browse Files
                        </button>
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.zip';

                            input.onchange = (e) => {
                              const target = e.target as HTMLInputElement;

                              if (target.files) {
                                handleFileSelect({ target } as any);
                              }
                            };
                            input.click();
                          }}
                          disabled={isProcessing}
                          className="px-6 py-2.5 bg-transparent border border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Upload ZIP
                        </button>
                      </div>
                    </div>

                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-bolt-elements-background-depth-1/80 rounded-xl">
                        <div className="text-center">
                          <div className="i-svg-spinners:3-dots-scale text-4xl text-accent-500 mb-2" />
                          <p className="text-sm text-bolt-elements-textSecondary">
                            Processing files... {Math.round(importProgress)}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
                    >
                      <p className="text-sm text-red-400">{errorMessage}</p>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {importStats && (
                    <div className="grid grid-cols-3 gap-4 p-4 bg-bolt-elements-item-backgroundActive rounded-lg">
                      <div>
                        <p className="text-xs text-bolt-elements-textSecondary">Total Files</p>
                        <p className="text-lg font-semibold text-bolt-elements-textPrimary">{importStats.totalFiles}</p>
                      </div>
                      <div>
                        <p className="text-xs text-bolt-elements-textSecondary">Total Size</p>
                        <p className="text-lg font-semibold text-bolt-elements-textPrimary">
                          {formatFileSize(importStats.totalSize)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-bolt-elements-textSecondary">Directories</p>
                        <p className="text-lg font-semibold text-bolt-elements-textPrimary">
                          {importStats.directories.size}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
                    <div className="bg-bolt-elements-background-depth-2 px-4 py-2 border-b border-bolt-elements-borderColor">
                      <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Files to Import</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {Object.keys(selectedFiles)
                        .slice(0, 50)
                        .map((path, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-bolt-elements-item-backgroundActive transition-colors"
                          >
                            <div className={getFileIcon(path)} />
                            <span className="text-sm text-bolt-elements-textPrimary truncate">{path}</span>
                          </div>
                        ))}
                      {Object.keys(selectedFiles).length > 50 && (
                        <div className="px-4 py-2 text-sm text-bolt-elements-textSecondary">
                          ... and {Object.keys(selectedFiles).length - 50} more files
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        resetState();
                      }}
                      className="px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm border border-bolt-elements-borderColor rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportClick}
                      disabled={isProcessing}
                      className="px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <span className="i-svg-spinners:3-dots-scale mr-2" />
                          Importing...
                        </>
                      ) : (
                        `Import ${Object.keys(selectedFiles).length} Files`
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
};
