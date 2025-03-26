import type { ProviderInfo } from '~/types/model';
import { useEffect, useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';
import * as React from 'react';

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelLoading?: string;
}

export const ModelSelector = ({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
  modelLoading,
}: ModelSelectorProps) => {
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter models based on search query
  const filteredModels = [...modelList]
    .filter((e) => e.provider === provider?.name && e.name)
    .filter(
      (model) =>
        model.label.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()),
    );

  // Reset focused index when search query changes or dropdown opens/closes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [modelSearchQuery, isModelDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isModelDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isModelDropdownOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isModelDropdownOpen) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev + 1;

          if (next >= filteredModels.length) {
            return 0;
          }

          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev - 1;

          if (next < 0) {
            return filteredModels.length - 1;
          }

          return next;
        });
        break;

      case 'Enter':
        e.preventDefault();

        if (focusedIndex >= 0 && focusedIndex < filteredModels.length) {
          const selectedModel = filteredModels[focusedIndex];
          setModel?.(selectedModel.name);
          setIsModelDropdownOpen(false);
          setModelSearchQuery('');
        }

        break;

      case 'Escape':
        e.preventDefault();
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
        break;

      case 'Tab':
        if (!e.shiftKey && focusedIndex === filteredModels.length - 1) {
          setIsModelDropdownOpen(false);
        }

        break;
    }
  };

  // Focus the selected option
  useEffect(() => {
    if (focusedIndex >= 0 && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // Update enabled providers when cookies change
  useEffect(() => {
    // If current provider is disabled, switch to first enabled provider
    if (providerList.length === 0) {
      return;
    }

    if (provider && !providerList.map((p) => p.name).includes(provider.name)) {
      const firstEnabledProvider = providerList[0];
      setProvider?.(firstEnabledProvider);

      // Also update the model to the first available one for the new provider
      const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);

      if (firstModel) {
        setModel?.(firstModel.name);
      }
    }
  }, [providerList, provider, setProvider, modelList, setModel]);

  if (providerList.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary">
        <p className="text-center">
          No providers are currently enabled. Please enable at least one provider in the settings to start using the
          chat.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 flex gap-2 flex-col sm:flex-row">
      <select
        value={provider?.name ?? ''}
        onChange={(e) => {
          const newProvider = providerList.find((p: ProviderInfo) => p.name === e.target.value);

          if (newProvider && setProvider) {
            setProvider(newProvider);
          }

          const firstModel = [...modelList].find((m) => m.provider === e.target.value);

          if (firstModel && setModel) {
            setModel(firstModel.name);
          }
        }}
        className="flex-1 p-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus transition-all"
      >
        {providerList.map((provider: ProviderInfo) => (
          <option key={provider.name} value={provider.name}>
            {provider.name} {provider.name === 'Pollinations' ? '(Free, No API Key Required)' : ''}
          </option>
        ))}
      </select>

      <div className="relative flex-1 lg:max-w-[70%]" onKeyDown={handleKeyDown} ref={dropdownRef}>
        <div
          className={classNames(
            'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
            'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
            'transition-all cursor-pointer',
            isModelDropdownOpen ? 'ring-2 ring-bolt-elements-focus' : undefined,
          )}
          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsModelDropdownOpen(!isModelDropdownOpen);
            }
          }}
          role="combobox"
          aria-expanded={isModelDropdownOpen}
          aria-controls="model-listbox"
          aria-haspopup="listbox"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <div className="truncate">{modelList.find((m) => m.name === model)?.label || 'Select model'}</div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75',
                isModelDropdownOpen ? 'rotate-180' : undefined,
              )}
            />
          </div>
        </div>

        {isModelDropdownOpen && (
          <div
            className="absolute z-10 w-full mt-1 py-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2  shadow-lg"
            role="listbox"
            id="model-listbox"
          >
            <div className="px-2 pb-2">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className={classNames(
                    'w-full pl-8 pr-3 py-1.5 rounded-md text-sm',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                    'transition-all',
                  )}
                  onClick={(e) => e.stopPropagation()}
                  role="searchbox"
                  aria-label="Search models"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
                </div>
              </div>
            </div>

            <div
              className={classNames(
                'max-h-60 overflow-y-auto',
                'sm:scrollbar-none',
                '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2',
                '[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor',
                '[&::-webkit-scrollbar-thumb]:hover:bg-bolt-elements-borderColorHover',
                '[&::-webkit-scrollbar-thumb]:rounded-full',
                '[&::-webkit-scrollbar-track]:bg-bolt-elements-background-depth-2',
                '[&::-webkit-scrollbar-track]:rounded-full',
                'sm:[&::-webkit-scrollbar]:w-1.5 sm:[&::-webkit-scrollbar]:h-1.5',
                'sm:hover:[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor/50',
                'sm:hover:[&::-webkit-scrollbar-thumb:hover]:bg-bolt-elements-borderColor',
                'sm:[&::-webkit-scrollbar-track]:bg-transparent',
              )}
            >
              {modelLoading === 'all' || modelLoading === provider?.name ? (
                <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">Loading...</div>
              ) : filteredModels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">No models found</div>
              ) : (
                filteredModels.map((modelOption, index) => (
                  <div
                    ref={(el) => (optionsRef.current[index] = el)}
                    key={index}
                    role="option"
                    aria-selected={model === modelOption.name}
                    className={classNames(
                      'px-3 py-2 text-sm cursor-pointer',
                      'hover:bg-bolt-elements-background-depth-3',
                      'text-bolt-elements-textPrimary',
                      'outline-none',
                      model === modelOption.name || focusedIndex === index
                        ? 'bg-bolt-elements-background-depth-2'
                        : undefined,
                      focusedIndex === index ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModel?.(modelOption.name);
                      setIsModelDropdownOpen(false);
                      setModelSearchQuery('');
                    }}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    {modelOption.label}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
