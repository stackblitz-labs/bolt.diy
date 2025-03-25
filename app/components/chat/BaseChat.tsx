/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { Message } from 'ai';
import React, { type RefCallback, useEffect, useState, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import { APIKeyManager, getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import { toast } from 'react-toastify';

import styles from './BaseChat.module.scss';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';

import FilePreview from './FilePreview';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import type { ProviderInfo } from '~/types/model';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert } from '~/types/actions';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import type { ActionRunner } from '~/lib/runtime/action-runner';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import { WebSearchResults } from './WebSearchResults';
import type { WebSearchResult } from '~/lib/hooks/useWebSearch';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  ref?: RefCallback<HTMLDivElement>;
  input: string;
  showChat: boolean;
  chatStarted: boolean;
  isStreaming: boolean;
  onStreamingChange: ((streaming: boolean) => void) | undefined;
  enhancingPrompt: boolean;
  _promptEnhanced: boolean;
  sendMessage?: (message: string) => void;
  model?: string;
  setModel?: (model: string) => void;
  provider?: any;
  setProvider?: (provider: any) => void;
  providerList?: any[];
  _isLoadingModels?: boolean;
  _isLoadingProviders?: boolean;
  _isLoadingChat?: boolean;
  messages: Message[];
  messageRef?: any;
  scrollRef?: any;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleStop?: () => void;
  _handleSendMessage?: (event: React.MouseEvent<HTMLButtonElement>, input: string) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  _handleResetChat: () => void;
  _handleRegenerate?: () => void;
  _handleClearChat?: () => void;
  _handleExportChat?: () => void;
  _handleImportChat?: (file: File) => void;
  _handleImportChatFromText?: (text: string) => void;
  _handleImportChatFromUrl?: (url: string) => void;
  _handleSelectModel?: (model: string) => void;
  _handleSelectProvider?: (provider: any) => void;
  _handleSpeechRecognition?: () => void;
  _handleSaveScreenshot?: () => void;
  _handleCancelScreenshot?: () => void;
  _handleSaveScreenshotToClipboard?: () => void;
  _handleSaveScreenshotToFile?: () => void;
  _handleSaveScreenshotToServer?: () => void;
  _handleSelectStarterTemplate?: (template: any) => void;
  _handleCloneRepo?: (repo: string) => void;
  _handleRunAction?: (action: string) => void;
  _models?: ModelInfo[];
  _description?: string;
  clearAlert?: () => void;
  importChat?: any;
  exportChat?: any;
  enhancePrompt?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  _actionAlert?: ActionAlert | null;
  data?: any;
  _handleSearch?: (query: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  searchResults?: WebSearchResult | null;
  onClearSearchResults?: () => void;
  isSearching?: boolean;
  onSearch?: (query: string) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      input,
      showChat,
      chatStarted,
      isStreaming,
      onStreamingChange,
      enhancingPrompt,
      _promptEnhanced,
      sendMessage,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      _isLoadingModels,
      _isLoadingProviders,
      _isLoadingChat,
      messages,
      messageRef,
      scrollRef,
      handleInputChange,
      handleStop,
      _handleSendMessage,
      handleKeyDown,
      _handleResetChat,
      _handleRegenerate,
      _handleClearChat,
      _handleExportChat,
      _handleImportChat,
      _handleImportChatFromText,
      _handleImportChatFromUrl,
      _handleSelectModel,
      _handleSelectProvider,
      _handleSpeechRecognition,
      _handleSaveScreenshot,
      _handleCancelScreenshot,
      _handleSaveScreenshotToClipboard,
      _handleSaveScreenshotToFile,
      _handleSaveScreenshotToServer,
      _handleSelectStarterTemplate,
      _handleCloneRepo,
      _handleRunAction,
      _models,
      _description,
      clearAlert,
      importChat,
      exportChat,
      enhancePrompt,
      uploadedFiles,
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      _actionAlert,
      data,
      textareaRef,
      searchResults,
      onClearSearchResults,
      isSearching,
      onSearch,
    },
    forwardedRef,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const [dataState, setDataState] = useState<any>(data || []);
    const [uploadedFilesState, setUploadedFilesState] = useState<File[]>(uploadedFiles || []);
    const [alertStateLocal, setAlertStateLocal] = useState<any>(null);
    const [actionRunnerLocal, setActionRunnerLocal] = useState<any>(null);
    const [screenshotStateLocal, setScreenshotStateLocal] = useState<any>(null);
    const [providersLocal, setProvidersLocal] = useState<any[]>([]);
    const defaultTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Use the passed ref or the default one
    const finalTextareaRef = textareaRef || defaultTextareaRef;

    useEffect(() => {
      if (alertStateLocal) {
        setAlertStateLocal(alertStateLocal);
      }

      if (actionRunnerLocal) {
        setActionRunnerLocal(actionRunnerLocal);
      }

      if (screenshotStateLocal) {
        setScreenshotStateLocal(screenshotStateLocal);
      }

      if (providersLocal) {
        setProvidersLocal(providersLocal);
      }
    }, [alertStateLocal, actionRunnerLocal, screenshotStateLocal, providersLocal]);

    useEffect(() => {
      if (dataState) {
        const progressList = dataState.filter(
          (x: unknown) => typeof x === 'object' && x !== null && (x as { type: string }).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [dataState]);

    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    useEffect(() => {
      if (dataState.length > 0) {
        console.log('Data updated');
      }
    }, [dataState]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg, image/gif';
      input.multiple = true;

      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;

        if (!target.files) {
          return;
        }

        for (let i = 0; i < target.files.length; i++) {
          const file = target.files[i];
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFilesState((files: File[]) => [...files, file]);

            if (setImageDataList) {
              const updatedImages = [...imageDataList, base64Image];
              setImageDataList(updatedImages);
            }
          };

          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));

      if (imageItems.length > 0) {
        for (const item of imageItems) {
          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFilesState((files: File[]) => [...files, file]);

              if (setImageDataList) {
                const updatedImages = [...imageDataList, base64Image];
                setImageDataList(updatedImages);
              }
            };

            reader.readAsDataURL(file);
          }
        }

        return;
      }

      // ... rest of the function
    };

    // Update the parent component when uploadedFilesState changes
    useEffect(() => {
      if (setUploadedFiles && uploadedFilesState !== uploadedFiles) {
        setUploadedFiles(uploadedFilesState);
      }
    }, [uploadedFilesState, uploadedFiles, setUploadedFiles]);

    // Update local state when props change
    useEffect(() => {
      if (uploadedFiles && JSON.stringify(uploadedFiles) !== JSON.stringify(uploadedFilesState)) {
        setUploadedFilesState(uploadedFiles);
      }
    }, [uploadedFiles]);

    // Update local data state when props change
    useEffect(() => {
      if (data) {
        setDataState(data);
      }
    }, [data]);

    const baseChat = (
      <div
        ref={forwardedRef}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-chat mx-auto text-center px-4 lg:px-0">
                <h1 className="text-3xl lg:text-6xl font-bold text-bolt-elements-textPrimary mb-4 animate-fade-in">
                  Where ideas begin
                </h1>
                <p className="text-md lg:text-xl mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200">
                  Bring ideas to life in seconds or get help on existing projects.
                </p>
              </div>
            )}
            <div
              className={classNames('pt-6 px-2 sm:px-6', {
                'h-full flex flex-col': chatStarted,
              })}
              ref={scrollRef}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt mb-6', {
                  'sticky bottom-2': chatStarted,
                })}
              >
                <div className="bg-bolt-elements-background-depth-2">
                  {alertStateLocal && (
                    <ChatAlert
                      alert={alertStateLocal}
                      clearAlert={() => clearAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.(message);
                        clearAlert?.();
                      }}
                    />
                  )}
                </div>
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                <div
                  className={classNames(
                    'bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat mx-auto z-prompt',

                    /*
                     * {
                     *   'sticky bottom-2': chatStarted,
                     * },
                     */
                  )}
                >
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
                        <stop offset="0%" stopColor="#b44aff" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#b44aff" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#b44aff" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="#b44aff" stopOpacity="0%"></stop>
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
                        <div className={isModelSettingsCollapsed ? 'hidden' : ''}>
                          <ModelSelector
                            key={provider?.name + ':' + modelList.length}
                            model={model}
                            setModel={setModel}
                            modelList={modelList}
                            provider={provider}
                            setProvider={setProvider}
                            providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                            apiKeys={apiKeys}
                            modelLoading={isModelLoading}
                          />
                          {(providerList || []).length > 0 &&
                            provider &&
                            (!LOCAL_PROVIDERS.includes(provider.name) || 'OpenAILike') && (
                              <APIKeyManager
                                provider={provider}
                                apiKey={apiKeys[provider.name] || ''}
                                setApiKey={(key) => {
                                  onApiKeysChange(provider.name, key);
                                }}
                              />
                            )}
                        </div>
                      )}
                    </ClientOnly>
                  </div>
                  <FilePreview
                    files={uploadedFilesState}
                    imageDataList={imageDataList || []}
                    onRemove={(index: number) => {
                      setUploadedFilesState((files: File[]) => files.filter((_, i) => i !== index));

                      if (setImageDataList) {
                        const updatedImages = imageDataList.filter((_, i) => i !== index);
                        setImageDataList(updatedImages);
                      }
                    }}
                  />
                  <ClientOnly>
                    {() => (
                      <ScreenshotStateManager
                        setUploadedFiles={setUploadedFiles}
                        setImageDataList={setImageDataList}
                        uploadedFiles={uploadedFilesState}
                        imageDataList={imageDataList}
                      />
                    )}
                  </ClientOnly>
                  <div
                    className={classNames(
                      'relative shadow-xs border border-bolt-elements-borderColor backdrop-blur rounded-lg',
                    )}
                  >
                    <textarea
                      ref={finalTextareaRef}
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
                              setUploadedFilesState((files: File[]) => [...files, file]);

                              if (setImageDataList) {
                                const updatedImages = [...imageDataList, base64Image];
                                setImageDataList(updatedImages);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                      }}
                      onKeyDown={(event) => {
                        if (handleKeyDown) {
                          handleKeyDown(event);
                          return;
                        }

                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          if (sendMessage) {
                            sendMessage(input);

                            // Check if the input starts with @search
                            if (input.trim().startsWith('@search') && onSearch) {
                              const searchQuery = input.trim().substring('@search'.length).trim();

                              if (searchQuery) {
                                onSearch(searchQuery);
                              }
                            }

                            if (recognition) {
                              recognition.abort();
                              setTranscript('');
                              setIsListening(false);

                              if (handleInputChange) {
                                const syntheticEvent = {
                                  target: { value: '' },
                                } as React.ChangeEvent<HTMLTextAreaElement>;
                                handleInputChange(syntheticEvent);
                              }
                            }
                          }
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      onPaste={handlePaste}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="How can Bolt help you today?"
                      translate="no"
                    />
                    <ClientOnly>
                      {() => (
                        <SendButton
                          show={input.length > 0 || isStreaming || uploadedFilesState.length > 0}
                          isStreaming={isStreaming}
                          disabled={!providerList || providerList.length === 0}
                          onClick={(_event) => {
                            if (isStreaming) {
                              handleStop?.();
                              return;
                            }

                            if (input.length > 0 || uploadedFilesState.length > 0) {
                              if (sendMessage) {
                                sendMessage(input);

                                if (recognition) {
                                  recognition.abort();
                                  setTranscript('');
                                  setIsListening(false);

                                  if (handleInputChange) {
                                    const syntheticEvent = {
                                      target: { value: '' },
                                    } as React.ChangeEvent<HTMLTextAreaElement>;
                                    handleInputChange(syntheticEvent);
                                  }
                                }

                                // Check if the input starts with @search
                                if (input.trim().startsWith('@search') && onSearch) {
                                  const searchQuery = input.trim().substring('@search'.length).trim();

                                  if (searchQuery) {
                                    onSearch(searchQuery);
                                  }
                                }
                              }
                            }
                          }}
                        />
                      )}
                    </ClientOnly>
                    <div className="flex justify-between items-center text-sm p-4 pt-2">
                      <div className="flex gap-1 items-center">
                        <IconButton title="Upload file" className="transition-all" onClick={() => handleFileUpload()}>
                          <div className="i-ph:paperclip text-xl"></div>
                        </IconButton>
                        <IconButton
                          title="Search"
                          className="transition-all opacity-80 hover:opacity-100"
                          onClick={() => {
                            if (onSearch && input.trim()) {
                              onSearch(input.trim());
                              toast.info(`Searching for: "${input.trim()}"`, {
                                autoClose: 2000,
                              });
                            } else {
                              toast.info(
                                'Type something in the input field and click search, or use @search in your message',
                                {
                                  autoClose: 3000,
                                },
                              );
                            }
                          }}
                        >
                          <div className="i-ph:magnifying-glass text-xl"></div>
                        </IconButton>
                        <IconButton
                          title="Enhance prompt"
                          disabled={input.length === 0 || enhancingPrompt}
                          className={classNames('transition-all', enhancingPrompt ? 'opacity-100' : '')}
                          onClick={() => {
                            if (typeof enhancePrompt === 'function') {
                              enhancePrompt();
                            }

                            toast.success('Prompt enhanced!');
                          }}
                        >
                          {enhancingPrompt ? (
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                          ) : (
                            <div className="i-bolt:stars text-xl"></div>
                          )}
                        </IconButton>

                        <SpeechRecognitionButton
                          isListening={isListening}
                          onStart={startListening}
                          onStop={stopListening}
                          disabled={isStreaming}
                        />
                        {chatStarted && <ClientOnly>{() => <ExportChatButton exportChat={exportChat} />}</ClientOnly>}
                        <IconButton
                          title="Model Settings"
                          className={classNames('transition-all flex items-center gap-1', {
                            'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                              isModelSettingsCollapsed,
                            'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault':
                              !isModelSettingsCollapsed,
                          })}
                          onClick={() => setIsModelSettingsCollapsed(!isModelSettingsCollapsed)}
                          disabled={!providerList || providerList.length === 0}
                        >
                          <div className={`i-ph:caret-${isModelSettingsCollapsed ? 'right' : 'down'} text-lg`} />
                          {isModelSettingsCollapsed ? <span className="text-xs">{model || ''}</span> : <span />}
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-5">
              {!chatStarted && (
                <div className="flex justify-center gap-2">
                  {ImportButtons(importChat)}
                  <GitCloneButton importChat={importChat} />
                </div>
              )}
              {!chatStarted &&
                ExamplePrompts((_event, messageInput) => {
                  if (isStreaming) {
                    handleStop?.();
                    return;
                  }

                  if (sendMessage && messageInput) {
                    sendMessage(messageInput);

                    if (recognition) {
                      recognition.abort();
                      setTranscript('');
                      setIsListening(false);

                      if (handleInputChange) {
                        const syntheticEvent = {
                          target: { value: '' },
                        } as React.ChangeEvent<HTMLTextAreaElement>;
                        handleInputChange(syntheticEvent);
                      }
                    }
                  }
                })}
              {!chatStarted && (
                <>
                  <StarterTemplates />
                </>
              )}
              {searchResults && <WebSearchResults results={searchResults} onClose={onClearSearchResults} />}
              {isSearching && !searchResults && (
                <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-4 mb-4 max-w-full overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-medium flex items-center gap-2">
                      <div className="i-svg-spinners:90-ring-with-bg animate-spin" />
                      Searching the web...
                    </h3>
                  </div>
                  <p className="text-sm text-bolt-elements-textSecondary">
                    Looking for information. This may take a moment. Results will appear here and be sent to the chat.
                  </p>
                </div>
              )}
              <ClientOnly>
                {() => (
                  <Workbench
                    actionRunner={actionRunnerLocal ?? ({} as ActionRunner)}
                    chatStarted={chatStarted}
                    isStreaming={isStreaming}
                  />
                )}
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
