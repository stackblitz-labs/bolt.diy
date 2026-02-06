import { useStore } from '@nanostores/react';
import { memo, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as Tabs from '@radix-ui/react-tabs';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from '~/lib/stores/files';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE, TerminalTabs } from './terminal/TerminalTabs';
import { workbenchStore } from '~/lib/stores/workbench';
import { Search } from './Search'; // <-- Ensure Search is imported
import { classNames } from '~/utils/classNames'; // <-- Import classNames if not already present
import { LockManager } from './LockManager'; // <-- Import LockManager

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    fileHistory,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      if (!editorDocument || !unsavedFiles) {
        return false;
      }

      // Make sure unsavedFiles is a Set before calling has()
      return unsavedFiles instanceof Set && unsavedFiles.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    const lockState = useMemo(() => {
      if (!editorDocument) {
        return { locked: false, lockedBy: undefined as string | undefined };
      }

      return workbenchStore.isFileLocked(editorDocument.filePath);
    }, [editorDocument, files]);

    const isLockedByFolder = Boolean(
      editorDocument && lockState.locked && lockState.lockedBy && lockState.lockedBy !== editorDocument.filePath,
    );

    const toggleFileLock = () => {
      if (!editorDocument) {
        return;
      }

      if (lockState.locked) {
        const success = workbenchStore.unlockFile(editorDocument.filePath);
        toast[success ? 'success' : 'error'](success ? 'File unlocked' : 'Failed to unlock file');

        return;
      }

      const success = workbenchStore.lockFile(editorDocument.filePath);
      toast[success ? 'success' : 'error'](success ? 'File locked' : 'Failed to lock file');
    };

    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15} collapsible className="border-r border-bolt-elements-borderColor">
              <div className="h-full">
                <Tabs.Root defaultValue="files" className="flex flex-col h-full">
                  <PanelHeader className="w-full text-sm font-medium text-bolt-elements-textSecondary px-1">
                    <div className="h-full flex-shrink-0 flex items-center justify-between w-full">
                      <Tabs.List className="h-full flex-shrink-0 flex items-center">
                        <Tabs.Trigger
                          value="files"
                          className={classNames(
                            'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                          )}
                        >
                          Files
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="search"
                          className={classNames(
                            'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                          )}
                        >
                          Search
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="locks"
                          className={classNames(
                            'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                          )}
                        >
                          Locks
                        </Tabs.Trigger>
                      </Tabs.List>
                    </div>
                  </PanelHeader>

                  <Tabs.Content value="files" className="flex-grow overflow-auto focus-visible:outline-none">
                    <FileTree
                      className="h-full"
                      files={files}
                      hideRoot
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      rootFolder={WORK_DIR}
                      selectedFile={selectedFile}
                      onFileSelect={onFileSelect}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="search" className="flex-grow overflow-auto focus-visible:outline-none">
                    <Search />
                  </Tabs.Content>

                  <Tabs.Content value="locks" className="flex-grow overflow-auto focus-visible:outline-none">
                    <LockManager />
                  </Tabs.Content>
                </Tabs.Root>
              </div>
            </Panel>

            <PanelResizeHandle />
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              <PanelHeader className="overflow-x-auto">
                {activeFileSegments?.length && (
                  <div className="flex items-center flex-1 text-sm">
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                    <div className="flex gap-1 ml-auto -mr-1.5">
                      <PanelHeaderButton
                        onClick={toggleFileLock}
                        disabled={!editorDocument || isLockedByFolder}
                        title={isLockedByFolder ? 'Locked by folder' : lockState.locked ? 'Unlock file' : 'Lock file'}
                      >
                        <div className={lockState.locked ? 'i-ph:lock-simple-duotone' : 'i-ph:lock-key-open-duotone'} />
                        {lockState.locked ? 'Unlock' : 'Lock'}
                      </PanelHeaderButton>
                      {activeFileUnsaved && (
                        <>
                          <PanelHeaderButton onClick={onFileSave}>
                            <div className="i-ph:floppy-disk-duotone" />
                            Save
                          </PanelHeaderButton>
                          <PanelHeaderButton onClick={onFileReset}>
                            <div className="i-ph:clock-counter-clockwise-duotone" />
                            Reset
                          </PanelHeaderButton>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </PanelHeader>
              <div className="h-full flex-1 overflow-hidden modern-scrollbar">
                <CodeMirrorEditor
                  theme={theme}
                  editable={!isStreaming && editorDocument !== undefined}
                  settings={editorSettings}
                  doc={editorDocument}
                  autoFocusOnDocumentChange={!isMobile()}
                  onScroll={onEditorScroll}
                  onChange={onEditorChange}
                  onSave={onFileSave}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <TerminalTabs />
      </PanelGroup>
    );
  },
);
