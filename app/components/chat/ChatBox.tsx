import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { APIKeyManager } from './APIKeyManager';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import FilePreview from './FilePreview';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { SendButton } from './SendButton.client';
import styles from './BaseChat.module.scss';
import type { ProviderInfo } from '~/types/model';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';

interface QuickSuggestion {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  prompt: string;
}

const defaultSuggestions: QuickSuggestion[] = [
  {
    id: 'color',
    label: 'Primary color to orange',
    icon: 'i-ph:palette',
    iconColor: 'text-purple-500',
    prompt: 'Change the primary color to orange',
  },
  {
    id: 'font',
    label: 'Use serif font',
    icon: 'i-ph:text-aa',
    iconColor: 'text-blue-500',
    prompt: 'Change the font to a serif typeface',
  },
  {
    id: 'section',
    label: 'Add contact section',
    icon: 'i-ph:plus-circle',
    iconColor: 'text-emerald-500',
    prompt: 'Add a contact section to the website',
  },
];

interface QuickSuggestionsProps {
  onSelect: (prompt: string) => void;
  chatStarted: boolean;
}

function QuickSuggestions({ onSelect, chatStarted }: QuickSuggestionsProps) {
  if (!chatStarted) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {defaultSuggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion.prompt)}
          className="px-3 py-1.5 rounded-lg text-xs text-bolt-elements-textSecondary transition-all duration-200 flex items-center gap-1.5 group"
          style={{
            background: 'var(--bolt-chat-suggestions-bg)',
            border: '1px solid var(--bolt-chat-suggestions-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bolt-chat-suggestions-hover-bg)';
            e.currentTarget.style.borderColor = 'var(--bolt-chat-suggestions-hover-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bolt-chat-suggestions-bg)';
            e.currentTarget.style.borderColor = 'var(--bolt-chat-suggestions-border)';
          }}
        >
          <div className={classNames(suggestion.icon, 'text-sm', suggestion.iconColor)} />
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
}

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const handleSuggestionSelect = (prompt: string) => {
    if (props.handleInputChange) {
      const syntheticEvent = {
        target: { value: prompt },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      props.handleInputChange(syntheticEvent);
    }
  };

  return (
    <div
      className="relative w-full max-w-chat mx-auto z-prompt p-4 pt-2 border-t border-bolt-elements-borderColor"
      style={{ background: 'var(--bolt-elements-bg-depth-1)' }}
    >
      <QuickSuggestions onSelect={handleSuggestionSelect} chatStarted={props.chatStarted} />
      <div className="relative group">
        {/* Glow effect */}
        <div
          className="absolute -inset-1 rounded-2xl blur-md opacity-30 group-hover:opacity-50 transition duration-200"
          style={{ background: 'linear-gradient(to right, var(--bolt-brand-500), var(--bolt-brand-700))' }}
        />
        <div className="relative rounded-xl" style={{ background: 'var(--bolt-elements-bg-depth-1)' }}>
          <svg className={classNames(styles.PromptEffectContainer)}>
            <defs>
              <linearGradient
                id="line-gradient"
                x1="20%"
                y1="0%"
                x2="-14%"
                y2="10%"
                gradientUnits="userSpaceOnUse"
                gradientTransform="rotate(-45)"
              >
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0%"></stop>
                <stop offset="40%" stopColor="#7c3aed" stopOpacity="80%"></stop>
                <stop offset="50%" stopColor="#7c3aed" stopOpacity="80%"></stop>
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0%"></stop>
              </linearGradient>
              <linearGradient id="shine-gradient">
                <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
                <stop offset="40%" stopColor="#ffffff" stopOpacity="80%"></stop>
                <stop offset="50%" stopColor="#ffffff" stopOpacity="80%"></stop>
                <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
              </linearGradient>
            </defs>
            <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
            <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
          </svg>
          <div>
            <ClientOnly>
              {() => (
                <div className={props.isModelSettingsCollapsed ? 'hidden' : ''}>
                  <ModelSelector
                    key={props.provider?.name + ':' + props.modelList.length}
                    model={props.model}
                    setModel={props.setModel}
                    modelList={props.modelList}
                    provider={props.provider}
                    setProvider={props.setProvider}
                    providerList={props.providerList || (PROVIDER_LIST as ProviderInfo[])}
                    apiKeys={props.apiKeys}
                    modelLoading={props.isModelLoading}
                  />
                  {(props.providerList || []).length > 0 &&
                    props.provider &&
                    !LOCAL_PROVIDERS.includes(props.provider.name) && (
                      <APIKeyManager
                        provider={props.provider}
                        apiKey={props.apiKeys[props.provider.name] || ''}
                        setApiKey={(key) => {
                          props.onApiKeysChange(props.provider.name, key);
                        }}
                      />
                    )}
                </div>
              )}
            </ClientOnly>
          </div>
          <FilePreview
            files={props.uploadedFiles}
            imageDataList={props.imageDataList}
            onRemove={(index) => {
              props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
              props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
            }}
          />
          <ClientOnly>
            {() => (
              <ScreenshotStateManager
                setUploadedFiles={props.setUploadedFiles}
                setImageDataList={props.setImageDataList}
                uploadedFiles={props.uploadedFiles}
                imageDataList={props.imageDataList}
              />
            )}
          </ClientOnly>
          {props.selectedElement && (
            <div className="flex mx-1.5 gap-2 items-center justify-between rounded-lg rounded-b-none border border-b-none border-bolt-elements-borderColor text-bolt-elements-textPrimary flex py-1 px-2.5 font-medium text-xs">
              <div className="flex gap-2 items-center lowercase">
                <code className="bg-accent-500 rounded-4px px-1.5 py-1 mr-0.5 text-white">
                  {props?.selectedElement?.tagName}
                </code>
                selected for inspection
              </div>
              <button
                className="bg-transparent text-accent-500 pointer-auto"
                onClick={() => props.setSelectedElement?.(null)}
              >
                Clear
              </button>
            </div>
          )}
          <div
            className={classNames(
              'relative shadow-xs border border-bolt-elements-borderColor backdrop-blur rounded-lg',
            )}
          >
            <textarea
              ref={props.textareaRef}
              className={classNames(
                'w-full pl-4 pt-4 pr-16 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
                'transition-all duration-200',
                'hover:border-bolt-elements-focus',
              )}
              onDragEnter={(e) => {
                e.preventDefault();
                e.currentTarget.style.border = '2px solid #1488fc';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.border = '2px solid #1488fc';
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';

                const files = Array.from(e.dataTransfer.files);
                files.forEach((file) => {
                  if (file.type.startsWith('image/')) {
                    const reader = new FileReader();

                    reader.onload = (e) => {
                      const base64Image = e.target?.result as string;
                      props.setUploadedFiles?.([...props.uploadedFiles, file]);
                      props.setImageDataList?.([...props.imageDataList, base64Image]);
                    };
                    reader.readAsDataURL(file);
                  }
                });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  if (event.shiftKey) {
                    return;
                  }

                  event.preventDefault();

                  if (props.isStreaming) {
                    props.handleStop?.();
                    return;
                  }

                  // ignore if using input method engine
                  if (event.nativeEvent.isComposing) {
                    return;
                  }

                  props.handleSendMessage?.(event);
                }
              }}
              value={props.input}
              onChange={(event) => {
                props.handleInputChange?.(event);
              }}
              onPaste={props.handlePaste}
              style={{
                minHeight: props.TEXTAREA_MIN_HEIGHT,
                maxHeight: props.TEXTAREA_MAX_HEIGHT,
              }}
              placeholder={
                props.chatMode === 'build' ? 'How can HuskIT help you today?' : 'What would you like to discuss?'
              }
              translate="no"
            />
            <ClientOnly>
              {() => (
                <SendButton
                  show={props.input.length > 0 || props.isStreaming || props.uploadedFiles.length > 0}
                  isStreaming={props.isStreaming}
                  disabled={!props.providerList || props.providerList.length === 0}
                  onClick={(event) => {
                    if (props.isStreaming) {
                      props.handleStop?.();
                      return;
                    }

                    if (props.input.length > 0 || props.uploadedFiles.length > 0) {
                      props.handleSendMessage?.(event);
                    }
                  }}
                />
              )}
            </ClientOnly>
            {/* <div className="flex justify-between items-center text-sm p-4 pt-2">
          <div className="flex gap-1 items-center">
            <ColorSchemeDialog designScheme={props.designScheme} setDesignScheme={props.setDesignScheme} />
            <McpTools />
            <IconButton title="Upload file" className="transition-all" onClick={() => props.handleFileUpload()}>
              <div className="i-ph:paperclip text-xl"></div>
            </IconButton>
            <IconButton
              title="Enhance prompt"
              disabled={props.input.length === 0 || props.enhancingPrompt}
              className={classNames('transition-all', props.enhancingPrompt ? 'opacity-100' : '')}
              onClick={() => {
                props.enhancePrompt?.();
                toast.success('Prompt enhanced!');
              }}
            >
              {props.enhancingPrompt ? (
                <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
              ) : (
                <div className="i-bolt:stars text-xl"></div>
              )}
            </IconButton>

            <SpeechRecognitionButton
              isListening={props.isListening}
              onStart={props.startListening}
              onStop={props.stopListening}
              disabled={props.isStreaming}
            />
            {props.chatStarted && (
              <IconButton
                title="Discuss"
                className={classNames(
                  'transition-all flex items-center gap-1 px-1.5',
                  props.chatMode === 'discuss'
                    ? '!bg-bolt-elements-item-backgroundAccent !text-bolt-elements-item-contentAccent'
                    : 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault',
                )}
                onClick={() => {
                  props.setChatMode?.(props.chatMode === 'discuss' ? 'build' : 'discuss');
                }}
              >
                <div className={`i-ph:chats text-xl`} />
                {props.chatMode === 'discuss' ? <span>Discuss</span> : <span />}
              </IconButton>
            )}
            <IconButton
              title="Model Settings"
              className={classNames('transition-all flex items-center gap-1', {
                'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                  props.isModelSettingsCollapsed,
                'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault':
                  !props.isModelSettingsCollapsed,
              })}
              onClick={() => props.setIsModelSettingsCollapsed(!props.isModelSettingsCollapsed)}
              disabled={!props.providerList || props.providerList.length === 0}
            >
              <div className={`i-ph:caret-${props.isModelSettingsCollapsed ? 'right' : 'down'} text-lg`} />
              {props.isModelSettingsCollapsed ? <span className="text-xs">{props.model}</span> : <span />}
            </IconButton>
          </div>
          {props.input.length > 3 ? (
            <div className="text-xs text-bolt-elements-textTertiary">
              Use <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Shift</kbd> +{' '}
              <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Return</kbd> a new line
            </div>
          ) : null}
          <SupabaseConnection />
          <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
        </div> */}
          </div>
        </div>
      </div>
      <div className="text-center mt-2">
        <p className="text-[10px] text-bolt-elements-textTertiary">AI can make mistakes. Review generated content.</p>
      </div>
    </div>
  );
};
